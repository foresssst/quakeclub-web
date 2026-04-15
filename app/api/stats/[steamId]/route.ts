import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ steamId: string }> }
) {
  try {
    const { steamId } = await params
    const { searchParams } = new URL(request.url)
    const gameType = searchParams.get("gameType") || "overall"
    if (!steamId) {
      return NextResponse.json({ error: "Steam ID is required" }, { status: 400 })
    }
    // Construir filtros según el gameType
    const matchFilter: any = gameType !== "overall"
      ? { Match: { gameType: gameType.toLowerCase() } }
      : {}
    // Buscar el jugador en la base de datos
    const player = await prisma.player.findUnique({
      where: { steamId },
      include: {
        PlayerMatchStats: {
          where: matchFilter,
          orderBy: { createdAt: "desc" },
          include: {
            Match: {
              select: {
                map: true,
                gameType: true,
                timestamp: true,
              },
            },
          },
        },
      },
    })
    if (!player) {
      return NextResponse.json({
        success: false,
        message: "Player not found in QuakeClub database",
        weaponStats: null,
        matchStats: null,
      })
    }
    // Obtener IDs de PlayerMatchStats filtrados por región
    const matchStatsIds = player.PlayerMatchStats.map(ms => ms.id)
    // Agregar weapon stats por arma - filtrado por región
    const weaponAggregates = matchStatsIds.length > 0 
      ? await prisma.weaponStats.groupBy({
          by: ["weapon"],
          where: { 
            playerId: player.id,
            playerMatchStatsId: { in: matchStatsIds }
          },
          _sum: {
            hits: true,
            shots: true,
            damage: true,
            kills: true,
          },
          _avg: {
            accuracy: true,
          },
        })
      : []
    const weaponStatsByWeapon = weaponAggregates.reduce((acc, stat) => {
      const totalHits = stat._sum.hits || 0
      const totalShots = stat._sum.shots || 0
      const accuracy = totalShots > 0 ? (totalHits / totalShots) * 100 : 0
      acc[stat.weapon] = {
        weapon: stat.weapon,
        totalHits,
        totalShots,
        totalDamage: stat._sum.damage || 0,
        totalKills: stat._sum.kills || 0,
        accuracy: Math.round(accuracy * 10) / 10,
      }
      return acc
    }, {} as Record<string, any>)
    // Stats generales desde PlayerMatchStats
    const totalMatches = player.PlayerMatchStats.length
    const totalStats = player.PlayerMatchStats.reduce(
      (acc, playerMatch) => {
        acc.kills += playerMatch.kills
        acc.deaths += playerMatch.deaths
        acc.damageDealt += playerMatch.damageDealt
        acc.damageTaken += playerMatch.damageTaken
        acc.playTime += playerMatch.aliveTime || 0
        return acc
      },
      { kills: 0, deaths: 0, damageDealt: 0, damageTaken: 0, playTime: 0 }
    )
    const avgKD = totalStats.kills / Math.max(totalStats.deaths, 1)
    // Obtener ratings por modo de juego
    const ratings = await prisma.playerRating.findMany({
      where: {
        steamId,
        ...(gameType !== "overall" ? { gameType: gameType.toLowerCase() } : {}),
      },
      select: {
        gameType: true,
        rating: true,
        wins: true,
        losses: true,
        draws: true,
        totalGames: true,
      },
    })
    // Calcular ELO promedio y partidas ganadas totales
    const totalWins = ratings.reduce((sum, r) => sum + r.wins, 0)
    const totalLosses = ratings.reduce((sum, r) => sum + r.losses, 0)
    const avgElo = ratings.length > 0
      ? Math.round(ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length)
      : 900
    // Mapa más jugado
    const mapCounts = player.PlayerMatchStats.reduce((acc, playerMatch) => {
      const mapName = playerMatch.Match?.map || "Unknown"
      acc[mapName] = (acc[mapName] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    const favoriteMap = Object.entries(mapCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || "N/A"
    // Calcular totales de medallas
    const medalTotals = player.PlayerMatchStats.reduce(
      (acc, match) => {
        acc.accuracy += match.medalAccuracy
        acc.assists += match.medalAssists
        acc.captures += match.medalCaptures
        acc.combokill += match.medalCombokill
        acc.defends += match.medalDefends
        acc.excellent += match.medalExcellent
        acc.firstfrag += match.medalFirstfrag
        acc.headshot += match.medalHeadshot
        acc.humiliation += match.medalHumiliation
        acc.impressive += match.medalImpressive
        acc.midair += match.medalMidair
        acc.perfect += match.medalPerfect
        acc.perforated += match.medalPerforated
        acc.quadgod += match.medalQuadgod
        acc.rampage += match.medalRampage
        acc.revenge += match.medalRevenge
        return acc
      },
      {
        accuracy: 0,
        assists: 0,
        captures: 0,
        combokill: 0,
        defends: 0,
        excellent: 0,
        firstfrag: 0,
        headshot: 0,
        humiliation: 0,
        impressive: 0,
        midair: 0,
        perfect: 0,
        perforated: 0,
        quadgod: 0,
        rampage: 0,
        revenge: 0,
      }
    )
    return NextResponse.json({
      success: true,
      player: {
        steamId: player.steamId,
        username: player.username,
        totalMatches,
        totalWins,
        totalLosses,
        avgElo,
        favoriteMap,
      },
      weaponStats: weaponStatsByWeapon,
      overallStats: {
        totalKills: totalStats.kills,
        totalDeaths: totalStats.deaths,
        totalDamageDealt: totalStats.damageDealt,
        totalDamageTaken: totalStats.damageTaken,
        averageKD: Math.round(avgKD * 100) / 100,
        totalPlayTimeSeconds: totalStats.playTime,
      },
      ratings,
      medals: medalTotals,
      recentMatches: player.PlayerMatchStats.slice(0, 10).map((playerMatch) => ({
        id: playerMatch.id,
        map: playerMatch.Match?.map || "Unknown",
        gameType: playerMatch.Match?.gameType || "Unknown",
        kills: playerMatch.kills,
        deaths: playerMatch.deaths,
        kdRatio: playerMatch.kills / Math.max(playerMatch.deaths, 1),
        damageDealt: playerMatch.damageDealt,
        damageTaken: playerMatch.damageTaken,
        playedAt: playerMatch.Match?.timestamp || playerMatch.createdAt,
      })),
    })
  } catch (error) {
    console.error("Error fetching custom stats:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    )
  }
}
