import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { randomUUID } from "crypto"

interface RouteParams {
  params: Promise<{
    steamIds: string
  }>
}

// Rating inicial
const DEFAULT_RATING_PUBLIC = 900
const DEFAULT_RATING_LADDER = 1500
const DEFAULT_RD = 350

/**
 * API for balance.py plugin
 *
 * GET /api/ratings/{steamId1}+{steamId2}+...?ratingType=public|ladder
 *
 * Returns ratings for multiple players in the format expected by minqlx balance plugin.
 * The ratingType parameter controls which rating pool to query:
 * - "public" (default): Regular pub server ratings
 * - "ladder": Competitive/ladder server ratings
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { steamIds } = await params
    const { searchParams } = new URL(request.url)
    const ratingType = searchParams.get("ratingType") || "public"

    // Validate ratingType
    if (ratingType !== "public" && ratingType !== "ladder") {
      return NextResponse.json(
        { error: "Invalid ratingType. Must be 'public' or 'ladder'" },
        { status: 400 }
      )
    }

    // Parse steam IDs (separated by +)
    const steamIdList = steamIds.split("+").filter(id => id.length > 0)
    if (steamIdList.length === 0) {
      return NextResponse.json({
        players: [],
        untracked: [],
        playerinfo: {}
      })
    }

    // Fetch ratings for these players filtered by ratingType
    const ratings = await prisma.playerRating.findMany({
      where: {
        steamId: { in: steamIdList },
        ratingType,
      },
      select: {
        steamId: true,
        gameType: true,
        rating: true,
        totalGames: true,
      }
    })

    // Group ratings by steamId
    const playerRatings: Record<string, Record<string, { elo: number; games: number }>> = {}
    const trackedSteamIds = new Set<string>()

    for (const r of ratings) {
      trackedSteamIds.add(r.steamId)
      if (!playerRatings[r.steamId]) {
        playerRatings[r.steamId] = {}
      }
      playerRatings[r.steamId][r.gameType.toLowerCase()] = {
        elo: Math.round(r.rating),
        games: r.totalGames
      }
    }

    // Find players not in our database (for this ratingType)
    const untrackedSteamIds = steamIdList.filter(sid => !trackedSteamIds.has(sid))

    // Auto-create PlayerRating for new players
    if (untrackedSteamIds.length > 0) {
      const gameTypes = ["ca", "tdm", "ctf", "duel", "ffa", "ft"]

      for (const steamId of untrackedSteamIds) {
        // Check if player exists in Player table
        let player = await prisma.player.findUnique({
          where: { steamId }
        })

        // Create player if doesn't exist
        if (!player) {
          player = await prisma.player.create({
            data: {
              id: `player_${steamId}`,
              steamId,
              username: `Player_${steamId.slice(-6)}`,
              updatedAt: new Date(),
            }
          })
          console.log(`[Ratings API] Nuevo jugador creado: ${steamId}`)
        }

        // Create PlayerRating for all game types with the requested ratingType
        const defaultRating = ratingType === 'ladder' ? DEFAULT_RATING_LADDER : DEFAULT_RATING_PUBLIC
        playerRatings[steamId] = {}
        for (const gameType of gameTypes) {
          try {
            await prisma.playerRating.create({
              data: {
                id: randomUUID(),
                playerId: player.id,
                steamId,
                gameType,
                ratingType,
                rating: defaultRating,
                deviation: DEFAULT_RD,
                volatility: 0.06,
                kFactor: 1.0,
                updatedAt: new Date(),
              }
            })
          } catch (e: any) {
            // Ignorar si ya existe (condición de carrera)
            if (e?.code !== "P2002") throw e
          }
          playerRatings[steamId][gameType] = {
            elo: defaultRating,
            games: 0
          }
        }
        trackedSteamIds.add(steamId)
        console.log(`[Ratings API] PlayerRating (${ratingType}) creado: ${steamId} - ELO ${defaultRating}`)
      }
    }

    // Build response
    const players = steamIdList
      .filter(sid => trackedSteamIds.has(sid))
      .map(sid => ({
        steamid: sid,
        ...playerRatings[sid]
      }))

    const untracked = steamIdList.filter(sid => !trackedSteamIds.has(sid))

    return NextResponse.json({
      players,
      untracked,
      playerinfo: {}
    })
  } catch (error) {
    console.error("[Ratings API] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch ratings",
        players: [],
        untracked: [],
        playerinfo: {}
      },
      { status: 500 }
    )
  }
}
