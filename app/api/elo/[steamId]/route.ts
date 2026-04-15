import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSteamId } from "@/lib/security"
interface RouteParams {
  params: Promise<{
    steamId: string
  }>
}
/**
 * GET /api/elo/[steamId]?gameType=ca
 * Endpoint simple para consultar ELO de un jugador
 * Usado por plugins de servidor (!elo command)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { steamId } = await params
    
    if (!validateSteamId(steamId)) {
      return NextResponse.json({ error: "Invalid Steam ID format" }, { status: 400 })
    }
    
    const searchParams = request.nextUrl.searchParams
    const gameType = searchParams.get("gameType") || "overall"
    // Buscar rating del jugador
    if (gameType === "overall" || !gameType) {
      // Overall: promedio de todos los modos
      const allRatings = await prisma.playerRating.findMany({
        where: { steamId, ratingType: 'public' },
        select: {
          gameType: true,
          rating: true,
          deviation: true,
          totalGames: true,
        },
      })
      if (allRatings.length === 0) {
        return NextResponse.json({
          success: true,
          steamId,
          gameType: "overall",
          rating: 900, // Default for new players
          deviation: 350,
          totalGames: 0,
        })
      }
      const avgRating = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length
      const avgDeviation = allRatings.reduce((sum, r) => sum + r.deviation, 0) / allRatings.length
      const totalGames = allRatings.reduce((sum, r) => sum + r.totalGames, 0)
      return NextResponse.json({
        success: true,
        steamId,
        gameType: "overall",
        rating: Math.round(avgRating),
        deviation: Math.round(avgDeviation),
        totalGames,
        ratings: allRatings.map((r) => ({
          gameType: r.gameType,
          rating: Math.round(r.rating),
          games: r.totalGames,
        })),
      })
    }
    // Específico por modo
    const rating = await prisma.playerRating.findUnique({
      where: {
        steamId_gameType_ratingType: {
          steamId,
          gameType: gameType.toLowerCase(),
          ratingType: 'public',
        },
      },
      select: {
        rating: true,
        deviation: true,
        totalGames: true,
        wins: true,
        losses: true,
        draws: true,
      },
    })
    if (!rating) {
      return NextResponse.json({
        success: true,
        steamId,
        gameType: gameType.toLowerCase(),
        rating: 900, // Default for new players
        deviation: 350,
        totalGames: 0,
        wins: 0,
        losses: 0,
        draws: 0,
      })
    }
    return NextResponse.json({
      success: true,
      steamId,
      gameType: gameType.toLowerCase(),
      rating: Math.round(rating.rating),
      deviation: Math.round(rating.deviation),
      totalGames: rating.totalGames,
      wins: rating.wins,
      losses: rating.losses,
      draws: rating.draws,
    })
  } catch (error) {
    console.error("Error fetching ELO:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch ELO",
      },
      { status: 500 },
    )
  }
}
