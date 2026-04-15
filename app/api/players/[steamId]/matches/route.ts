import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildPlacementMap, getPlacementFromMap } from "@/lib/ranking-visibility"
interface RouteParams {
  params: Promise<{
    steamId: string
  }>
}
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { steamId } = await params
    const searchParams = request.nextUrl.searchParams
    const gameType = searchParams.get("gameType") || undefined
    // SEGURIDAD: Limitar el máximo a 1000 para prevenir DoS
    // Si limit=0 o limit=all, devolver todas las partidas (sin límite)
    const limitParam = searchParams.get("limit")
    const requestedLimit = limitParam === "all" ? 0 : parseInt(limitParam || "50")
    const limit = requestedLimit === 0 ? undefined : Math.min(Math.max(1, requestedLimit), 1000)
    // NUEVA ARQUITECTURA: Match + PlayerMatchStats + EloHistory
    // Fuente: PlayerMatchStats
    // 0. Obtener el conteo total de partidas (sin límite)
    const totalCount = await prisma.playerMatchStats.count({
      where: {
        steamId,
        ...(gameType && gameType !== "overall" ? { Match: { gameType } } : {}),
      },
    })
    // 1. Obtener PlayerMatchStats del jugador
    const playerMatches = await prisma.playerMatchStats.findMany({
      where: {
        steamId,
        ...(gameType && gameType !== "overall" ? { Match: { gameType } } : {}),
      },
      include: {
        Match: true,
        EloHistory: true,
        WeaponStats: {
          select: {
            weapon: true,
            kills: true,
            hits: true,
            shots: true,
            damage: true,
            accuracy: true,
          },
        },
      },
      orderBy: {
        Match: {
          timestamp: "desc",
        },
      },
      take: limit,
    })
    const uniqueGameTypes = Array.from(new Set(playerMatches.map((pm) => pm.Match.gameType?.toLowerCase()).filter(Boolean))) as string[]
    const placementRows = await prisma.playerRating.findMany({
      where: {
        steamId,
        ratingType: "public",
        ...(uniqueGameTypes.length > 0 ? { gameType: { in: uniqueGameTypes } } : {}),
      },
      select: {
        steamId: true,
        gameType: true,
        totalGames: true,
      },
    })
    const placementMap = buildPlacementMap(placementRows, "public")
    // 2. Formatear los resultados
    const allMatches = await Promise.all(playerMatches.map(async (pm) => {
      const kdRatio = (pm.kills / Math.max(pm.deaths, 1)).toFixed(2)
      const eloRecord = pm.EloHistory[0] // Debería haber solo 1 por PlayerMatchStats
      const placementInfo = getPlacementFromMap(placementMap, steamId, pm.Match.gameType, "public")
      // Determinar resultado - SIEMPRE W o L, nunca draw/unknown (como XonStats)
      // Lógica: game.winner == player.team → WIN, else → LOSS
      let result: "win" | "loss" = "loss" // Default a loss
      let matchWinner = pm.Match.winner
      // Si winner no está definido, calcularlo desde los scores
      if (matchWinner === null || matchWinner === undefined) {
        const t1Score = pm.Match.team1Score ?? 0
        const t2Score = pm.Match.team2Score ?? 0
        if (t1Score > t2Score) {
          matchWinner = 1
        } else if (t2Score > t1Score) {
          matchWinner = 2
        } else {
          // Scores iguales - determinar por score individual del jugador
          matchWinner = pm.score > 0 ? pm.team : (pm.team === 1 ? 2 : 1)
        }
      }
      // Para modos por equipos (CA, CTF, TDM)
      const isTeamGame = pm.team !== null && pm.team !== undefined && pm.team > 0
      if (isTeamGame) {
        // XonStats: winner == team → WIN, else → LOSS
        result = (matchWinner === pm.team) ? "win" : "loss"
      } else {
        // Para modos sin equipos (duel, FFA)
        const gameType = pm.Match.gameType?.toLowerCase()
        if (gameType === 'duel') {
          // En duel: comparar scores de los 2 jugadores (como XonStat/QLStats)
          // Quien tiene más frags gana (RANK 1 = winner)
          const allMatchStats = await prisma.playerMatchStats.findMany({
            where: { matchId: pm.matchId },
            select: { steamId: true, score: true }
          })
          if (allMatchStats.length === 2) {
            const opponent = allMatchStats.find(s => s.steamId !== steamId)
            if (opponent) {
              result = pm.score > opponent.score ? "win" : "loss"
            }
          } else {
            // Fallback si solo hay 1 jugador registrado
            result = pm.score > 0 ? "win" : "loss"
          }
        } else if (gameType === 'ffa') {
          // FFA: Solo RANK #1 gana, los demás pierden (como XonStat/QLStats)
          const allMatchStats = await prisma.playerMatchStats.findMany({
            where: { matchId: pm.matchId },
            select: { steamId: true, score: true }
          })
          if (allMatchStats.length > 0) {
            const maxScore = Math.max(...allMatchStats.map(s => s.score))
            // Solo el de mayor score gana (RANK 1)
            result = pm.score === maxScore && pm.score > 0 ? "win" : "loss"
          } else {
            result = "loss"
          }
        } else {
          // Otros modos sin equipos: usar score como indicador
          result = pm.score > 0 ? "win" : "loss"
        }
      }
      // Obtener oponente
      let opponent = undefined
      // Para duels: buscar el otro jugador en el match
      if (pm.Match.gameType === "duel") {
        const otherPlayer = await prisma.playerMatchStats.findFirst({
          where: {
            matchId: pm.matchId,
            steamId: { not: steamId },
          },
          select: {
            playerName: true,
          },
        })
        opponent = otherPlayer?.playerName
      }
      // Para team games: buscar el jugador con mayor ELO del equipo contrario
      else if (pm.team !== null && pm.team !== undefined) {
        const enemyTeam = pm.team === 1 ? 2 : 1
        const enemyPlayers = await prisma.playerMatchStats.findMany({
          where: {
            matchId: pm.matchId,
            team: enemyTeam,
          },
          include: {
            EloHistory: {
              select: {
                eloBefore: true,
              },
            },
          },
        })
        // Encontrar el jugador enemigo con mayor ELO
        if (enemyPlayers.length > 0) {
          const topEnemy = enemyPlayers.reduce((top, current) => {
            const topElo = top.EloHistory[0]?.eloBefore || 0
            const currentElo = current.EloHistory[0]?.eloBefore || 0
            return currentElo > topElo ? current : top
          })
          opponent = topEnemy.playerName
        }
      }
      return {
        id: pm.id,
        matchId: pm.Match.matchId, // MATCH_GUID del servidor
        playerName: pm.playerName,
        map: pm.Match.map,
        gameType: pm.Match.gameType,
        kills: pm.kills,
        deaths: pm.deaths,
        kdRatio,
        score: pm.score,
        damageDealt: pm.damageDealt,
        damageTaken: pm.damageTaken,
        team: pm.team,
        flagsCaptured: pm.flagsCaptured,
        flagsReturned: pm.flagsReturned,
        eloChange: placementInfo.isPlacement ? null : (pm.eloDelta ?? eloRecord?.change ?? 0),
        eloBefore: placementInfo.isPlacement ? null : (pm.eloBefore ?? eloRecord?.eloBefore ?? null),
        eloAfter: placementInfo.isPlacement ? null : (pm.eloAfter ?? eloRecord?.eloAfter ?? null),
        playedAt: pm.Match.timestamp.toISOString(),
        result,
        opponent,
        serverName: pm.Match.serverName || "QuakeClub Server",
        gameStatus: pm.Match.gameStatus,
        isRated: pm.Match.ratingProcessed === true,
        isAborted: pm.Match.aborted === true,
        duration: pm.Match.duration,
        weapons: pm.WeaponStats,
        hasFullDetails: true,
      }
    }))
    return NextResponse.json({
      success: true,
      matches: allMatches,
      total: totalCount, // Conteo real de todas las partidas
      showing: allMatches.length,
    })
  } catch (error) {
    console.error("Error fetching player matches:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch player matches",
      },
      { status: 500 },
    )
  }
}
