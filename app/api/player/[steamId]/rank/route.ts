import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Debe coincidir con el valor en lib/rankings-service.ts
const MIN_GAMES_FOR_RANKING = 5

export async function GET(
    request: Request,
    { params }: { params: Promise<{ steamId: string }> }
) {
    try {
        const { steamId } = await params

        if (!steamId) {
            return NextResponse.json({ error: "Steam ID is required" }, { status: 400 })
        }

        // Get all ratings with minimum games requirement (same as rankings page)
        const allRatings = await prisma.playerRating.findMany({
            where: {
                totalGames: { gte: MIN_GAMES_FOR_RANKING },
            },
            select: {
                steamId: true,
                rating: true,
                totalGames: true,
            },
        })

        // Group by steamId and calculate overall rating (average)
        const playerMap = new Map<string, { ratings: number[], totalGames: number }>()
        
        allRatings.forEach((r) => {
            if (!playerMap.has(r.steamId)) {
                playerMap.set(r.steamId, { ratings: [], totalGames: 0 })
            }
            const player = playerMap.get(r.steamId)!
            player.ratings.push(r.rating)
            player.totalGames += r.totalGames
        })

        // Calculate overall rating for each player and sort
        const playersWithOverallRating = Array.from(playerMap.entries())
            .map(([steamId, data]) => ({
                steamId,
                overallRating: data.ratings.reduce((sum, r) => sum + r, 0) / data.ratings.length,
                totalGames: data.totalGames,
            }))
            .filter((p) => p.overallRating > 0)
            .sort((a, b) => b.overallRating - a.overallRating)

        // Find the rank of the requested player
        const playerRank = playersWithOverallRating.findIndex(
            (p) => p.steamId === steamId
        )

        if (playerRank === -1) {
            return NextResponse.json({
                globalRank: null,
                totalPlayers: playersWithOverallRating.length,
            })
        }

        return NextResponse.json({
            globalRank: playerRank + 1, // +1 because index is 0-based
            totalPlayers: playersWithOverallRating.length,
        })
    } catch (error) {
        console.error("Error calculating global rank:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    } finally {
        
    }
}
