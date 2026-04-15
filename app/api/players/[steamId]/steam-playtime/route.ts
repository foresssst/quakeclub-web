import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const QUAKE_LIVE_APP_ID = 282440
const CACHE_HOURS = 24

interface RouteParams {
  params: Promise<{ steamId: string }>
}

/**
 * GET /api/players/[steamId]/steam-playtime
 *
 * Returns the player's total Quake Live playtime from Steam.
 * Caches in DB for 24 hours to avoid excessive API calls.
 *
 * Response:
 * - playtimeMinutes: total minutes played (from Steam)
 * - playtimeHours: formatted string (e.g. "1,477h 27m")
 * - source: "cache" | "steam" | "unavailable"
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { steamId } = await params

    const player = await prisma.player.findUnique({
      where: { steamId },
      select: {
        steamPlaytimeMinutes: true,
        steamPlaytimeUpdatedAt: true,
      },
    })

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    // Check cache freshness
    const now = new Date()
    const cacheAge = player.steamPlaytimeUpdatedAt
      ? (now.getTime() - player.steamPlaytimeUpdatedAt.getTime()) / (1000 * 60 * 60)
      : Infinity

    if (player.steamPlaytimeMinutes !== null && cacheAge < CACHE_HOURS) {
      return NextResponse.json({
        playtimeMinutes: player.steamPlaytimeMinutes,
        playtimeHours: formatPlaytime(player.steamPlaytimeMinutes),
        source: "cache",
      })
    }

    // Fetch from Steam API
    const steamApiKey = process.env.STEAM_API_KEY
    if (!steamApiKey) {
      return NextResponse.json({
        playtimeMinutes: player.steamPlaytimeMinutes,
        playtimeHours: player.steamPlaytimeMinutes ? formatPlaytime(player.steamPlaytimeMinutes) : null,
        source: "unavailable",
        reason: "No Steam API key configured",
      })
    }

    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${steamApiKey}&steamid=${steamId}&include_played_free_games=1&appids_filter%5B0%5D=${QUAKE_LIVE_APP_ID}&format=json`

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })

    if (!res.ok) {
      // Return cached value if available
      return NextResponse.json({
        playtimeMinutes: player.steamPlaytimeMinutes,
        playtimeHours: player.steamPlaytimeMinutes ? formatPlaytime(player.steamPlaytimeMinutes) : null,
        source: "unavailable",
        reason: "Steam API error",
      })
    }

    const data = await res.json()
    const games = data?.response?.games

    if (!games || games.length === 0) {
      // Profile is private or doesn't own QL - cache as -1 to avoid re-fetching
      await prisma.player.update({
        where: { steamId },
        data: {
          steamPlaytimeMinutes: -1,
          steamPlaytimeUpdatedAt: now,
        },
      })

      return NextResponse.json({
        playtimeMinutes: null,
        playtimeHours: null,
        source: "unavailable",
        reason: "Steam profile is private",
      })
    }

    const playtimeMinutes = games[0].playtime_forever || 0

    // Cache in DB
    await prisma.player.update({
      where: { steamId },
      data: {
        steamPlaytimeMinutes: playtimeMinutes,
        steamPlaytimeUpdatedAt: now,
      },
    })

    return NextResponse.json({
      playtimeMinutes,
      playtimeHours: formatPlaytime(playtimeMinutes),
      source: "steam",
    })
  } catch (error) {
    console.error("Error fetching Steam playtime:", error)
    return NextResponse.json(
      { error: "Failed to fetch playtime", playtimeMinutes: null, source: "unavailable" },
      { status: 500 }
    )
  }
}

function formatPlaytime(minutes: number): string {
  if (minutes <= 0) return "0m"
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0) {
    return `${hours.toLocaleString()}h ${mins}m`
  }
  return `${mins}m`
}
