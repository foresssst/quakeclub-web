import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getPlacementInfo } from "@/lib/ranking-visibility"

export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ user: null })
    }

    // Si es un usuario admin sin steamId, retornar solo los datos de sesión
    if (!session.user.steamId || session.user.steamId === '' || session.user.steamId === 'undefined') {
      return NextResponse.json({
        user: {
          ...session.user,
          ratings: [],
          clan: null,
        }
      })
    }

    // Fetch additional user data from database (solo para usuarios Steam)
    const player = await prisma.player.findUnique({
      where: { steamId: session.user.steamId },
      include: {
        PlayerRating: {
          where: {
            ratingType: "public",
          },
          select: {
            gameType: true,
            rating: true,
            totalGames: true,
          }
        },
        ClanMember: {
          take: 1,
          orderBy: { joinedAt: 'desc' },
          include: {
            Clan: {
              select: {
                id: true,
                tag: true,
                slug: true,
                name: true,
                avatarUrl: true,
              }
            }
          }
        }
      }
    })

    // Transform ratings to the expected format
    const ratings = player?.PlayerRating.map(r => {
      const placementInfo = getPlacementInfo(r.totalGames, r.gameType, "public")
      return {
        gameType: r.gameType,
        rating: placementInfo.isPlacement ? null : Math.round(r.rating),
        games: r.totalGames,
        wins: 0, // These would need to be added to the query if needed
        losses: 0,
        draws: 0,
        lastPlayed: new Date().toISOString(),
        gamesRemaining: placementInfo.gamesRemaining,
        minGames: placementInfo.minGames,
        isPlacement: placementInfo.isPlacement,
      }
    }) || []

    // Calculate overall rating if there are multiple game types
    const visibleRatings = ratings.filter(r => typeof r.rating === "number")
    if (visibleRatings.length > 0 && !ratings.find(r => r.gameType.toLowerCase() === 'overall')) {
      const overallRating = Math.round(
        visibleRatings.reduce((sum, r) => sum + (r.rating || 0), 0) / visibleRatings.length
      )
      const totalGames = ratings.reduce((sum, r) => sum + r.games, 0)

      ratings.unshift({
        gameType: 'overall',
        rating: overallRating,
        games: totalGames,
        wins: 0,
        losses: 0,
        draws: 0,
        lastPlayed: new Date().toISOString(),
      })
    }

    // Get clan info if exists
    const clan = player?.ClanMember[0]?.Clan || null

    // Return enhanced user data
    return NextResponse.json({
      user: {
        ...session.user,
        ratings,
        clan,
      }
    })
  } catch (error) {
    console.error('Error fetching user data:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
