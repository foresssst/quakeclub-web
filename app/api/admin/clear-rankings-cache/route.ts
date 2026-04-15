import { NextRequest, NextResponse } from "next/server"
import { cache } from "@/lib/cache"
import { getSession } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    // Clear all rankings cache entries
    const gameTypes = ["all", "ca", "duel", "tdm", "ctf", "ffa"]
    const limit = 50
    gameTypes.forEach((gameType) => {
      const cacheKey = `rankings:quakeclub:${gameType}:${limit}`
      cache.clear(cacheKey)
      console.log(`Cleared cache: ${cacheKey}`)
    })
    return NextResponse.json({
      success: true,
      message: "Rankings cache cleared successfully",
      clearedKeys: gameTypes.map((gt) => `rankings:quakeclub:${gt}:${limit}`),
    })
  } catch (error) {
    console.error("Error clearing cache:", error)
    return NextResponse.json(
      {
        error: "Failed to clear cache",
      },
      { status: 500 }
    )
  }
}
