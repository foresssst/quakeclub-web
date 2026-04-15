import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/ladder/player/{steamId}?gameType=ca
 *
 * Returns ladder ELO + clan info for a player.
 * Used by the competitive minqlx plugin.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ steamId: string }> }
) {
    try {
        const { steamId } = await params
        const { searchParams } = new URL(request.url)
        const gameType = searchParams.get("gameType") || "ca"

        // Get ladder rating
        const ladderRating = await prisma.playerRating.findFirst({
            where: {
                steamId,
                gameType,
                ratingType: "ladder",
            },
        })

        // Get clan membership
        const clanMember = await prisma.clanMember.findFirst({
            where: { steamId },
            include: {
                Clan: {
                    select: { id: true, name: true, tag: true, slug: true }
                }
            }
        })

        // Get ladder rank (position among ladder players)
        let ladderRank: number | null = null
        if (ladderRating && ladderRating.totalGames >= 1) {
            const higherRated = await prisma.playerRating.count({
                where: {
                    gameType,
                    ratingType: "ladder",
                    totalGames: { gte: 1 },
                    rating: { gt: ladderRating.rating },
                },
            })
            ladderRank = higherRated + 1
        }

        return NextResponse.json({
            steamId,
            gameType,
            ladder: {
                elo: ladderRating ? Math.round(ladderRating.rating) : 900,
                wins: ladderRating?.wins || 0,
                losses: ladderRating?.losses || 0,
                games: ladderRating?.totalGames || 0,
                rank: ladderRank,
            },
            clan: clanMember ? {
                id: clanMember.Clan.id,
                name: clanMember.Clan.name,
                tag: clanMember.Clan.tag,
                slug: clanMember.Clan.slug,
            } : null,
        })
    } catch (error) {
        console.error("[Ladder Player API] Error:", error)
        return NextResponse.json({ error: "Internal error" }, { status: 500 })
    }
}
