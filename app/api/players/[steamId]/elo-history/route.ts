import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSteamId } from "@/lib/security"
import { buildPlacementMap, getPlacementFromMap } from "@/lib/ranking-visibility"
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ steamId: string }> }
) {
  try {
    const { steamId } = await params
    const { searchParams } = new URL(request.url)
    const gameType = searchParams.get("gameType") || "all"
    // limit=0 o no especificado = todo el historial
    // Si se especifica un límite > 0, cap en 500 para prevenir DoS
    const limitParam = searchParams.get("limit")
    const requestedLimit = limitParam ? parseInt(limitParam) : 0
    const limit = requestedLimit > 0 ? Math.min(requestedLimit, 500) : 0
    if (!steamId) {
      return NextResponse.json({ error: "Steam ID is required" }, { status: 400 })
    }
    if (!validateSteamId(steamId)) {
      return NextResponse.json({ error: "Invalid Steam ID format" }, { status: 400 })
    }
    // Buscar el jugador
    const player = await prisma.player.findUnique({
      where: { steamId },
    })
    if (!player) {
      return NextResponse.json({
        success: false,
        message: "Player not found",
        history: [],
      })
    }
    const requestedGameType = gameType !== "all" ? gameType.toLowerCase() : null
    const placementRows = await prisma.playerRating.findMany({
      where: {
        steamId,
        ratingType: "public",
        ...(requestedGameType ? { gameType: requestedGameType } : {}),
      },
      select: {
        steamId: true,
        gameType: true,
        totalGames: true,
      },
    })
    const placementMap = buildPlacementMap(placementRows, "public")
    if (requestedGameType) {
      const placementInfo = getPlacementFromMap(placementMap, steamId, requestedGameType, "public")
      if (placementInfo.isPlacement) {
        return NextResponse.json({
          success: true,
          steamId,
          gameType,
          totalEntries: 0,
          history: [],
          gamesRemaining: placementInfo.gamesRemaining,
          minGames: placementInfo.minGames,
          totalGames: placementInfo.totalGames,
        })
      }
    }
    // Obtener historial de ELO
    const whereClause: any = {
      steamId,
    }
    if (gameType !== "all") {
      whereClause.gameType = gameType.toLowerCase()
    }
    // Obtener TODAS las entradas y ordenar por fecha real del match
    // Esto es necesario porque recordedAt puede ser la fecha de recálculo, no la fecha real
    const allEloHistory = await prisma.eloHistory.findMany({
      where: whereClause,
      include: {
        PlayerMatchStats: {
          select: {
            kills: true,
            deaths: true,
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
    // Ordenar por fecha real del match (o recordedAt si no hay match)
    const sortedByMatchDate = allEloHistory.sort((a, b) => {
      const dateA = a.PlayerMatchStats?.Match?.timestamp || a.recordedAt
      const dateB = b.PlayerMatchStats?.Match?.timestamp || b.recordedAt
      return new Date(dateA).getTime() - new Date(dateB).getTime()
    })
    // Tomar las últimas N entradas (las más recientes por fecha de match)
    const chronologicalHistory = limit > 0
      ? sortedByMatchDate.slice(-limit)
      : sortedByMatchDate
    const visibleHistory = chronologicalHistory.filter((entry) => {
      const placementInfo = getPlacementFromMap(placementMap, steamId, entry.gameType, "public")
      return !placementInfo.isPlacement
    })
    // Formatear datos para el gráfico
    // Usar la fecha del match si existe, sino usar recordedAt
    const formattedHistory = visibleHistory.map((entry) => {
      const matchDate = entry.PlayerMatchStats?.Match?.timestamp
      const displayDate = matchDate || entry.recordedAt
      return {
        timestamp: displayDate.toISOString(),
        date: displayDate.toLocaleDateString("es-CL", { timeZone: "America/Santiago" }),
        eloBefore: entry.eloBefore,
        eloAfter: entry.eloAfter,
        change: entry.change,
        gameType: entry.gameType.toUpperCase(),
        rdBefore: entry.rdBefore,
        rdAfter: entry.rdAfter,
        match: entry.PlayerMatchStats && entry.PlayerMatchStats.Match
          ? {
            map: entry.PlayerMatchStats.Match.map,
            gameType: entry.PlayerMatchStats.Match.gameType,
            kills: entry.PlayerMatchStats.kills,
            deaths: entry.PlayerMatchStats.deaths,
            playedAt: entry.PlayerMatchStats.Match.timestamp,
          }
          : null,
      }
    })
    return NextResponse.json({
      success: true,
      steamId,
      gameType,
      totalEntries: formattedHistory.length,
      history: formattedHistory,
    })
  } catch (error) {
    console.error("Error fetching ELO history:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    )
  }
}
