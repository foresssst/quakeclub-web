import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { calculateMatchRatings } from "@/lib/rating-calculator"

/**
 * POST /api/admin/reprocess-ladder
 *
 * Reprocesa matches competitivos para generar ladder ratings.
 * Busca matches con serverType='competitive' y genera ratings tipo ladder.
 */
export async function POST(request: NextRequest) {
  try {
    // Auth: session admin OR API key
    const apiKey = request.headers.get("x-api-key")
    const expectedApiKey = process.env.MINQLX_API_KEY
    const session = await getSession()
    if (!session?.user?.isAdmin && (!expectedApiKey || apiKey !== expectedApiKey)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const dryRun = body.dryRun === true

    // Buscar matches competitivos
    const competitiveMatches = await prisma.match.findMany({
      where: { serverType: "competitive" },
      orderBy: { timestamp: "asc" },
    })

    if (competitiveMatches.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No hay matches competitivos para procesar",
        processed: 0,
      })
    }

    const results: Array<{
      matchId: string
      serverName: string
      gameType: string
      players: number
      status: string
    }> = []

    for (const match of competitiveMatches) {
      try {
        // Obtener jugadores del match
        const players = await prisma.playerMatchStats.findMany({
          where: { matchId: match.id },
        })

        if (players.length < 2) {
          results.push({
            matchId: match.matchId,
            serverName: match.serverName || "Unknown",
            gameType: match.gameType,
            players: players.length,
            status: "skipped - insufficient players",
          })
          continue
        }

        // Buscar temporada activa en la fecha del match
        let seasonId: string | null = null
        let isOfficial = false
        try {
          const activeSeason = await prisma.season.findFirst({
            where: {
              status: "ACTIVE",
              startDate: { lte: match.timestamp },
              endDate: { gte: match.timestamp },
              gameTypes: { has: match.gameType },
            },
          })
          if (activeSeason) {
            seasonId = activeSeason.id
            isOfficial = true
          }
        } catch (e) {
          // Ignorar
        }

        const ladderContext = {
          serverType: "competitive" as const,
          seasonId,
          isOfficial,
        }

        const matchContext = {
          matchId: match.id,
          gameType: match.gameType,
          matchDuration: match.duration || undefined,
          mapName: match.map || undefined,
        }

        const matchPlayers = players.map((p) => ({
          steamId: p.steamId,
          kills: p.kills,
          deaths: p.deaths,
          score: p.score || 0,
          team: p.team ?? undefined,
          aliveTime: p.aliveTime || undefined,
          damageDealt: p.damageDealt || undefined,
          damageTaken: p.damageTaken || undefined,
          matchId: p.id,
        }))

        const matchStatsForValidation = {
          GAME_LENGTH: match.duration || 0,
          TSCORE0: match.team1Score || 0,
          TSCORE1: match.team2Score || 0,
          FRAG_LIMIT: match.fragLimit || 0,
          SCORE_LIMIT: match.scoreLimit || 0,
          ROUND_LIMIT: match.roundLimit || 0,
          EXIT_MSG: match.exitMessage || "",
          ABORTED: match.aborted || false,
          INFECTED: false,
          QUADHOG: false,
          TRAINING: false,
          INSTAGIB: false,
          FACTORY: match.factory || "",
          FACTORY_TITLE: match.factoryTitle || "",
        }

        if (!dryRun) {
          await calculateMatchRatings(matchContext, matchPlayers, matchStatsForValidation, ladderContext)
        }

        results.push({
          matchId: match.matchId,
          serverName: match.serverName || "Unknown",
          gameType: match.gameType,
          players: players.length,
          status: dryRun ? "dry-run - would process" : "processed",
        })
      } catch (matchError: any) {
        results.push({
          matchId: match.matchId,
          serverName: match.serverName || "Unknown",
          gameType: match.gameType,
          players: 0,
          status: `error: ${matchError.message}`,
        })
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      totalMatches: competitiveMatches.length,
      results,
    })
  } catch (error: any) {
    console.error("[Admin] Error reprocessing ladder:", error)
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 })
  }
}
