import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { cache } from "@/lib/cache"
import { getDisplayCountry } from "@/lib/country-detection"
import { getUsersBySteamIds } from "@/lib/auth"
import { getSteamPlayersBatch } from "@/lib/steam"
function cleanQuakeColors(text: string): string {
  if (!text) return text
  return text
    .replace(/\^[0-7]/g, '')
    .replace(/\^x[0-9A-Fa-f]{3}/g, '')
    .replace(/\^./g, '')
    .trim()
}
interface PlayerRanking {
  playerId: string
  steamId: string
  username: string
  avatar?: string | null
  rating: number
  deviation: number
  totalGames: number
  wins: number
  losses: number
  winRate: number
  rank: number
  countryCode?: string
  lastPlayed?: string
  totalKills?: number
  totalDeaths?: number
  avgKD?: number
  clanTag?: string
  clanSlug?: string
  clanAvatarUrl?: string
}
/**
 * Mínimo de partidas requeridas para aparecer en los rankings
 */
function getMinGamesForRanking(gt: string): number { return gt === 'ca' ? 35 : 5 }
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const gameType = searchParams.get("gameType") || "overall"
    // SEGURIDAD: Limitar el máximo a 500 para prevenir DoS
    const requestedLimit = Number.parseInt(searchParams.get("limit") || "100")
    const limit = Math.min(Math.max(1, requestedLimit), 500)
    const cacheKey = `rankings:quakeclub:${gameType}:${limit}:v4`
    const cachedData = cache.get(cacheKey)
    if (cachedData) {
      console.log(`[Cache] Datos encontrados en cache: ${cacheKey}`)
      return NextResponse.json(cachedData, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } })
    }
    console.log(`[Cache] Cache vacio para ${cacheKey}, obteniendo rankings desde base de datos...`)
    // Para "overall" o "all", calcular rating promedio a través de todos los tipos de juego
    if (gameType === "overall" || gameType === "all") {
      // Obtener todos los ratings de jugadores agrupados por steamId
      const allRatings = await prisma.playerRating.findMany({
        where: {
          totalGames: { gte: 5 },
        },
        select: {
          playerId: true,
          steamId: true,
          gameType: true,
          rating: true,
          deviation: true,
          totalGames: true,
          wins: true,
          losses: true,
          draws: true,
          lastPlayed: true,
        },
      })
      // Agrupar por steamId
      const playerMap = new Map<string, any[]>()
      allRatings.forEach((r) => {
        if (!playerMap.has(r.steamId)) {
          playerMap.set(r.steamId, [])
        }
        playerMap.get(r.steamId)!.push(r)
      })
      // Obtener steamIds para búsqueda de estadísticas K/D
      const allSteamIds = Array.from(playerMap.keys())
      // Obtener estadísticas K/D a través de TODOS los tipos de juego para cada jugador
      // Usar PlayerMatchStats (tabla nueva) en lugar de MatchStats (deprecada)
      const kdStats = await prisma.playerMatchStats.groupBy({
        by: ["steamId"],
        where: {
          steamId: { in: allSteamIds },
        },
        _sum: {
          kills: true,
          deaths: true,
        },
      })
      const kdMap = new Map(
        kdStats.map((s) => {
          const kills = s._sum.kills || 0
          const deaths = s._sum.deaths || 0
          const kd = kills / Math.max(deaths, 1)
          return [s.steamId, { kills, deaths, kd }]
        }),
      )
      // Calcular rating promedio para cada jugador
      const overallRankings: PlayerRanking[] = []
      for (const [steamId, ratings] of playerMap.entries()) {
        const avgRating = Math.round(ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length)
        const avgDeviation = Math.round(ratings.reduce((sum, r) => sum + r.deviation, 0) / ratings.length)
        const totalGames = ratings.reduce((sum, r) => sum + r.totalGames, 0)
        const totalWins = ratings.reduce((sum, r) => sum + r.wins, 0)
        const totalLosses = ratings.reduce((sum, r) => sum + r.losses, 0)
        const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0
        // Obtener la fecha lastPlayed más reciente
        const mostRecentDate = ratings.reduce((latest, r) => {
          return !latest || new Date(r.lastPlayed) > new Date(latest) ? r.lastPlayed : latest
        }, null as Date | null)
        // Obtener estadísticas K/D
        const kdData = kdMap.get(steamId)
        overallRankings.push({
          playerId: ratings[0].playerId,
          steamId,
          username: "", // Se obtendrá más adelante
          rating: avgRating,
          deviation: avgDeviation,
          totalGames,
          wins: totalWins,
          losses: totalLosses,
          winRate,
          rank: 0,
          lastPlayed: mostRecentDate?.toISOString(),
          totalKills: kdData?.kills,
          totalDeaths: kdData?.deaths,
          avgKD: kdData ? Math.round(kdData.kd * 100) / 100 : undefined,
        })
      }
      // Ordenar por rating descendente
      overallRankings.sort((a, b) => b.rating - a.rating)
      // Asignar rangos
      overallRankings.forEach((player, index) => {
        player.rank = index + 1
      })
      // Obtener datos de Steam en batch (para los primeros 'limit' jugadores)
      const topPlayers = overallRankings.slice(0, limit)
      const steamIds = topPlayers.map(p => p.steamId)
      const steamData = await getSteamPlayersBatch(steamIds)
      // Obtener información de clan y país para los jugadores
      const [clanMembers, playerCountries] = await Promise.all([
        prisma.clanMember.findMany({
          where: { steamId: { in: steamIds } },
          include: {
            Clan: {
              select: {
                tag: true,
                slug: true,
                avatarUrl: true
              }
            }
          }
        }),
        prisma.player.findMany({
          where: { steamId: { in: steamIds } },
          select: { steamId: true, countryCode: true, realCountryCode: true }
        })
      ])
      const clanMap = new Map(clanMembers.map(cm => [cm.steamId, { tag: cm.Clan.tag, slug: cm.Clan.slug, avatarUrl: cm.Clan.avatarUrl }]))
      const countryMap = new Map(playerCountries.map(p => [p.steamId, { countryCode: p.countryCode, realCountryCode: p.realCountryCode }]))
      // Aplicar datos de Steam a los rankings (con avatares custom)
      const usersMap = getUsersBySteamIds(topPlayers.map(p => p.steamId))
      const rankingsWithSteamData = topPlayers.map((player) => {
        const steam = steamData.get(player.steamId)
        const user = usersMap.get(player.steamId)
        const pc = countryMap.get(player.steamId)
        const clan = clanMap.get(player.steamId)
        return {
          ...player,
          username: steam?.username || player.username || "Unknown",
          avatar: user?.avatar || steam?.avatar || null,
          countryCode: getDisplayCountry(pc?.countryCode, pc?.realCountryCode),
          clanTag: clan?.tag,
          clanSlug: clan?.slug,
          inGameTag: clan?.inGameTag,
          clanAvatarUrl: clan?.avatarUrl
        }
      })
      console.log(`[Rankings] Top 3 jugadores en OVERALL:`)
      rankingsWithSteamData.slice(0, 3).forEach((p) => {
        console.log(`   ${p.rank}. ${p.username} - Rating: ${p.rating} (${p.totalGames} partidas)`)
      })
      const responseData = {
        success: true,
        gameType: "overall",
        limit,
        totalPlayers: overallRankings.length,
        minGames: getMinGamesForRanking("overall"),
        players: rankingsWithSteamData,
        timestamp: Date.now(),
      }
      cache.set(cacheKey, responseData, 60 * 1000)
      return NextResponse.json(responseData, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } })
    }
    // Para tipo de juego específico, consultar PlayerRating directamente
    const playerRatings = await prisma.playerRating.findMany({
      where: {
        gameType: gameType.toLowerCase(),
        totalGames: { gte: getMinGamesForRanking(gameType.toLowerCase()) },
      },
      include: {
        Player: {
          select: {
            username: true,
          },
        },
      },
      orderBy: {
        rating: "desc",
      },
      take: limit,
    })
    console.log(`[Rankings] Encontrados ${playerRatings.length} jugadores calificados para ${gameType.toUpperCase()}`)
    if (playerRatings.length === 0) {
      console.log(`[Rankings] [${gameType.toUpperCase()}] No hay jugadores con ${getMinGamesForRanking(gameType)}+ partidas`)
      const emptyResponse = {
        success: true,
        gameType,
        limit,
        totalPlayers: 0,
        players: [],
        timestamp: Date.now(),
      }
      cache.set(cacheKey, emptyResponse, 60 * 1000)
      return NextResponse.json(emptyResponse, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } })
    }
    // Opcional: Obtener estadísticas K/D para visualización (usando la nueva tabla PlayerMatchStats)
    const steamIds = playerRatings.map((r) => r.steamId)
    // Stats de K/D de PlayerMatchStats
    const matchesForGameType = await prisma.match.findMany({
      where: { gameType: gameType.toLowerCase() },
      select: { id: true },
    })
    const matchIds = matchesForGameType.map((m) => m.id)
    const kdStats = await prisma.playerMatchStats.groupBy({
      by: ["steamId"],
      where: {
        steamId: { in: steamIds },
        matchId: { in: matchIds },
      },
      _sum: {
        kills: true,
        deaths: true,
      },
    })
    const kdMap = new Map(
      kdStats.map((s) => {
        const kills = s._sum.kills || 0
        const deaths = s._sum.deaths || 0
        const kd = kills / Math.max(deaths, 1)
        return [s.steamId, { kills, deaths, kd }]
      }),
    )
    // Construir rankings
    const rankingsWithoutCountry: PlayerRanking[] = playerRatings.map((pr, index) => {
      const winRate = pr.totalGames > 0 ? Math.round((pr.wins / pr.totalGames) * 100) : 0
      const kdData = kdMap.get(pr.steamId)
      return {
        playerId: pr.playerId,
        steamId: pr.steamId,
        username: cleanQuakeColors(pr.Player.username),
        rating: Math.round(pr.rating),
        deviation: Math.round(pr.deviation),
        totalGames: pr.totalGames,
        wins: pr.wins,
        losses: pr.losses,
        winRate,
        rank: index + 1,
        lastPlayed: pr.lastPlayed?.toISOString(),
        totalKills: kdData?.kills,
        totalDeaths: kdData?.deaths,
        avgKD: kdData ? Math.round(kdData.kd * 100) / 100 : undefined,
      }
    })
    // Obtener datos de Steam en batch
    const rankingSteamIds = rankingsWithoutCountry.map(p => p.steamId)
    const steamData = await getSteamPlayersBatch(rankingSteamIds)
    // Obtener información de clan y país para los jugadores
    const [clanMembers, playerCountries2] = await Promise.all([
      prisma.clanMember.findMany({
        where: { steamId: { in: rankingSteamIds } },
        include: {
          Clan: {
            select: {
              tag: true,
              slug: true,
              avatarUrl: true
            }
          }
        }
      }),
      prisma.player.findMany({
        where: { steamId: { in: rankingSteamIds } },
        select: { steamId: true, countryCode: true, realCountryCode: true }
      })
    ])
    const clanMap = new Map(clanMembers.map(cm => [cm.steamId, { tag: cm.Clan.tag, slug: cm.Clan.slug, avatarUrl: cm.Clan.avatarUrl }]))
    const countryMap2 = new Map(playerCountries2.map(p => [p.steamId, { countryCode: p.countryCode, realCountryCode: p.realCountryCode }]))
    // Aplicar datos de Steam a los rankings (con avatares custom)
    const usersMap2 = getUsersBySteamIds(rankingsWithoutCountry.map(p => p.steamId))
    const rankings = rankingsWithoutCountry.map((player) => {
      const steam = steamData.get(player.steamId)
      const user = usersMap2.get(player.steamId)
      const pc = countryMap2.get(player.steamId)
      const clan = clanMap.get(player.steamId)
      return {
        ...player,
        username: steam?.username || player.username || "Unknown",
        avatar: user?.avatar || steam?.avatar || null,
        countryCode: getDisplayCountry(pc?.countryCode, pc?.realCountryCode),
        clanTag: clan?.tag,
        clanSlug: clan?.slug,
        inGameTag: clan?.inGameTag,
        clanAvatarUrl: clan?.avatarUrl
      }
    })
    console.log(`[Rankings] Top 3 jugadores en ${gameType.toUpperCase()}:`)
    rankings.slice(0, 3).forEach((p) => {
      console.log(`   ${p.rank}. ${p.username} - Rating: ${p.rating} (${p.totalGames} partidas, ${p.winRate}% victorias)`)
    })
    const responseData = {
      success: true,
      gameType,
      limit,
      totalPlayers: rankings.length,
      minGames: getMinGamesForRanking(gameType),
      players: rankings,
      timestamp: Date.now(),
    }
    // Cachear por 5 minutos
    cache.set(cacheKey, responseData, 60 * 1000)
    return NextResponse.json(responseData, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } })
  } catch (error) {
    console.error("[Rankings] Error al obtener rankings:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 },
    )
  }
}
