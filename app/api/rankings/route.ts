import { NextRequest, NextResponse } from "next/server"
import { getTopRankingsPaginated } from "@/lib/rankings-service"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const gameType = searchParams.get("gameType") || "ca"
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0"))
    const perPage = Math.min(Math.max(1, parseInt(searchParams.get("perPage") || "20")), 100)
    const ratingType = searchParams.get("ratingType") || "public"

    const { rankings, totalCount } = await getTopRankingsPaginated(gameType, offset, perPage, ratingType)

    return NextResponse.json({
      success: true,
      rankings,
      gameType,
      count: rankings.length,
      totalCount,
      offset,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      }
    })
  } catch (error) {
    console.error("Error fetching rankings:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch rankings", rankings: [], totalCount: 0 },
      { status: 500 }
    )
  }
}
