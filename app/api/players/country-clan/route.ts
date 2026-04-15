import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getDisplayCountry } from "@/lib/country-detection"

// Shared handler logic
async function handleRequest(steamIds: string[], gameType?: string) {
  if (steamIds.length > 100) {
    return NextResponse.json({ error: "Maximum 100 steam IDs per request" }, { status: 400 })
  }

  // Filtrar solo steamIds válidos
  const validSteamIds = steamIds.filter(id => id && typeof id === 'string')

  if (validSteamIds.length === 0) {
    return NextResponse.json({ players: {} })
  }

  // Obtener jugadores de la base de datos con información de país
  const players = await prisma.player.findMany({
    where: {
      steamId: {
        in: validSteamIds
      }
    },
    select: {
      id: true,
      steamId: true,
      countryCode: true,
      realCountryCode: true,
    }
  })

  // Obtener información de clanes
  const clanMembers = await prisma.clanMember.findMany({
    where: {
      steamId: {
        in: validSteamIds
      }
    },
    include: {
      Clan: {
        select: {
          tag: true,
          name: true,
          avatarUrl: true,
          slug: true,
        }
      }
    }
  })

  // Obtener ratings si se especificó gameType
  let ratingsMap = new Map<string, number>()
  if (gameType) {
    const normalizedGameType = gameType.toLowerCase()
    const ratings = await prisma.playerRating.findMany({
      where: {
        steamId: { in: validSteamIds },
        gameType: normalizedGameType,
      },
      select: {
        steamId: true,
        rating: true,
      }
    })
    ratingsMap = new Map(ratings.map(r => [r.steamId, Math.round(r.rating)]))
  }

  // Crear mapa de clanes
  const clanMap = new Map(clanMembers.map(cm => [cm.steamId, cm.Clan]))

  // Crear mapa de respuesta
  const result: Record<string, {
    countryCode: string;
    clan?: { tag: string; name: string; avatarUrl: string | null; slug: string | null };
    elo?: number;
  }> = {}

  for (const steamId of validSteamIds) {
    const player = players.find(p => p.steamId === steamId)
    const clan = clanMap.get(steamId)
    const elo = ratingsMap.get(steamId)

    // Obtener código de país
    let countryCode = 'CL' // Default
    if (player) {
      countryCode = getDisplayCountry(player.countryCode, player.realCountryCode)
    }

    result[steamId] = {
      countryCode,
      ...(clan && {
        clan: {
          tag: clan.tag,
          name: clan.name,
          avatarUrl: clan.avatarUrl,
          slug: clan.slug,
        }
      }),
      ...(elo !== undefined && { elo })
    }
  }

  return NextResponse.json({ players: result })
}

// GET handler for query parameter based requests
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const steamIdsParam = searchParams.get('steamIds')
    const gameType = searchParams.get('gameType')

    if (!steamIdsParam) {
      return NextResponse.json({ error: "steamIds is required" }, { status: 400 })
    }

    const steamIds = steamIdsParam.split(',').filter(id => id && id.trim())
    return handleRequest(steamIds, gameType || undefined)
  } catch (error) {
    console.error("Error in GET /api/players/country-clan:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST handler for body-based requests
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { steamIds, gameType } = body

    if (!steamIds || !Array.isArray(steamIds)) {
      return NextResponse.json({ error: "steamIds array is required" }, { status: 400 })
    }

    return handleRequest(steamIds, gameType)
  } catch (error) {
    console.error("Error in POST /api/players/country-clan:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
