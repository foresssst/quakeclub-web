import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getPlacementInfo } from "@/lib/ranking-visibility"
interface RouteParams {
  params: Promise<{
    steamId: string
  }>
}
/**
 * Endpoint para obtener la posición de un jugador en el ranking global
 *
 * GET /api/rankings/player/[steamId]?gameType=ca&ratingType=public
 *
 * Respuesta:
 * {
 *   steamId: "76561198012345678",
 *   gameType: "ca",
 *   elo: 1520,
 *   rank: 15,
 *   totalPlayers: 234
 * }
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { steamId } = await params
    const searchParams = request.nextUrl.searchParams
    const gameType = (searchParams.get("gameType") || "ca").toLowerCase()
    const ratingType = searchParams.get("ratingType") || "public"
    // Obtener el rating del jugador
    const playerRating = await prisma.playerRating.findFirst({
      where: {
        steamId,
        gameType,
        ratingType: ratingType,
      },
      select: {
        rating: true,
        totalGames: true,
      },
    })
    if (!playerRating) {
      return NextResponse.json({
        steamId,
        gameType,
        ratingType,
        elo: null,
        rank: null,
        totalPlayers: 0,
        totalGames: 0,
        minGames: getPlacementInfo(0, gameType, ratingType).minGames,
        gamesRemaining: getPlacementInfo(0, gameType, ratingType).minGames,
        isPlacement: true,
        message: "Player not found in rankings",
      })
    }
    const placementInfo = getPlacementInfo(playerRating.totalGames, gameType, ratingType)
    // Si el jugador no tiene suficientes partidas, no tiene ranking
    if (placementInfo.isPlacement) {
      return NextResponse.json({
        steamId,
        gameType,
        ratingType,
        elo: null,
        rank: null,
        totalPlayers: 0,
        totalGames: placementInfo.totalGames,
        minGames: placementInfo.minGames,
        gamesRemaining: placementInfo.gamesRemaining,
        isPlacement: true,
        message: `Le quedan ${placementInfo.gamesRemaining} partidas para ser rankeado (minimo ${placementInfo.minGames})`,
      })
    }
    // Contar jugadores con rating mayor Y con suficientes partidas para calcular la posición
    const higherRatedCount = await prisma.playerRating.count({
      where: {
        gameType,
        ratingType: ratingType,
        totalGames: { gte: placementInfo.minGames },
        rating: {
          gt: playerRating.rating,
        },
      },
    })
    // Contar total de jugadores en este gametype con suficientes partidas
    const totalPlayers = await prisma.playerRating.count({
      where: {
        gameType,
        ratingType: ratingType,
        totalGames: { gte: placementInfo.minGames },
      },
    })
    const rank = higherRatedCount + 1
    return NextResponse.json({
      steamId,
      gameType,
      elo: Math.round(playerRating.rating),
      rank,
      totalPlayers,
      totalGames: placementInfo.totalGames,
      minGames: placementInfo.minGames,
      gamesRemaining: 0,
      isPlacement: false,
    })
  } catch (error) {
    console.error("[Player Ranking API] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch player ranking",
      },
      { status: 500 }
    )
  }
}
