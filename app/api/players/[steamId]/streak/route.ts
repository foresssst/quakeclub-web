import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
interface RouteParams {
  params: Promise<{
    steamId: string
  }>
}
/**
 * GET /api/players/[steamId]/streak
 *
 * Retorna la racha actual del jugador (wins/losses consecutivos)
 * Usado por el sistema de balance de los servidores de Quake para
 * ajustar el shuffle y distribuir mejor la "suerte"
 *
 * Respuesta:
 * - streak > 0: victorias consecutivas
 * - streak < 0: derrotas consecutivas
 * - streak = 0: sin racha o sin partidas
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { steamId } = await params
    const searchParams = request.nextUrl.searchParams
    const gameType = searchParams.get("gameType") || undefined
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20)
    // Obtener últimas N partidas del jugador (solo partidas rated)
    const recentMatches = await prisma.playerMatchStats.findMany({
      where: {
        steamId,
        Match: {
          ratingProcessed: true,
          aborted: false,
          ...(gameType ? { gameType } : {}),
        },
      },
      include: {
        Match: {
          select: {
            id: true,
            gameType: true,
            winner: true,
            team1Score: true,
            team2Score: true,
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
    // Pre-cargar scores de oponentes para partidas con eloDelta=0 (duel)
    // Esto evita hacer queries individuales dentro del loop
    const zeroEloMatchIds = recentMatches
      .filter(pm => (pm.eloDelta === null || pm.eloDelta === 0) && (!pm.team || pm.team === 0))
      .map(pm => pm.Match.id)
    const opponentScores = new Map<string, number>()
    if (zeroEloMatchIds.length > 0) {
      const opponents = await prisma.playerMatchStats.findMany({
        where: {
          matchId: { in: zeroEloMatchIds },
          steamId: { not: steamId },
        },
        select: { matchId: true, score: true },
      })
      for (const opp of opponents) {
        opponentScores.set(opp.matchId, opp.score)
      }
    }
    // Helper: determinar si el jugador ganó una partida
    const didWin = (pm: typeof recentMatches[number]): boolean => {
      // Si tiene eloDelta != 0, usarlo (más fiable)
      if (pm.eloDelta !== null && pm.eloDelta !== undefined && pm.eloDelta !== 0) {
        return pm.eloDelta > 0
      }
      // Fallback: usar winner + team para juegos de equipo
      let matchWinner = pm.Match.winner
      if (matchWinner === null || matchWinner === undefined) {
        const t1Score = pm.Match.team1Score ?? 0
        const t2Score = pm.Match.team2Score ?? 0
        if (t1Score > t2Score) matchWinner = 1
        else if (t2Score > t1Score) matchWinner = 2
      }
      const isTeamGame = pm.team !== null && pm.team !== undefined && pm.team > 0
      if (isTeamGame) {
        return matchWinner === pm.team
      }
      // Duel/FFA con eloDelta=0: comparar score con oponente
      const oppScore = opponentScores.get(pm.Match.id)
      if (oppScore !== undefined) {
        return pm.score > oppScore
      }
      // Último fallback: score positivo (solo si nada más funciona)
      return pm.score > 0
    }
    if (recentMatches.length === 0) {
      return NextResponse.json({
        steamId,
        streak: 0,
        recentGames: 0,
        message: "No rated matches found",
      })
    }
    // Calcular racha
    let streak = 0
    let lastResult: boolean | null = null
    for (const pm of recentMatches) {
      const won = didWin(pm)
      // Primera iteración: establecer dirección de la racha
      if (lastResult === null) {
        lastResult = won
        streak = won ? 1 : -1
        continue
      }
      // Si el resultado es igual al anterior, extender racha
      if (won === lastResult) {
        streak += won ? 1 : -1
      } else {
        // Racha terminó
        break
      }
    }
    // Calcular winrate de las últimas partidas
    const wins = recentMatches.filter(didWin).length
    const winrate = Math.round((wins / recentMatches.length) * 100)
    return NextResponse.json({
      steamId,
      streak,
      recentGames: recentMatches.length,
      recentWins: wins,
      recentLosses: recentMatches.length - wins,
      winrate,
      gameType: gameType || "all",
    })
  } catch (error) {
    console.error("Error fetching player streak:", error)
    return NextResponse.json(
      {
        steamId: "",
        streak: 0,
        error: "Failed to fetch player streak",
      },
      { status: 500 }
    )
  }
}
