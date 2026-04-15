import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/seasons
 * Lista todas las temporadas de liga
 * Query params:
 * - status: "UPCOMING" | "ACTIVE" | "FINISHED" | "CANCELLED"
 * - gameType: filtrar por tipo de juego soportado
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get("status")
    const gameType = searchParams.get("gameType")

    const where: any = {}

    if (status) {
      where.status = status
    }

    if (gameType) {
      where.gameTypes = { has: gameType.toLowerCase() }
    }

    const seasons = await prisma.season.findMany({
      where,
      orderBy: [
        { status: "asc" }, // ACTIVE primero
        { startDate: "desc" },
      ],
      include: {
        _count: {
          select: {
            ratings: true,
            matches: true,
            tournaments: true,
          },
        },
      },
    })

    // Calcular estadísticas adicionales
    const seasonsWithStats = seasons.map(season => ({
      ...season,
      stats: {
        totalPlayers: season._count.ratings,
        totalMatches: season._count.matches,
        totalTournaments: season._count.tournaments,
      },
      _count: undefined,
    }))

    return NextResponse.json({
      success: true,
      seasons: seasonsWithStats,
    })
  } catch (error: any) {
    console.error("[Seasons API] Error:", error)
    return NextResponse.json(
      { error: "Error al obtener temporadas" },
      { status: 500 }
    )
  }
}
