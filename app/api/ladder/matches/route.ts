import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Detect the dominant clan for a group of steamIds using a pre-built map
function detectTeamClan(
  steamIds: string[],
  clanMap: Map<string, { tag: string; name: string; avatarUrl: string | null; slug: string | null }>
) {
  const counts = new Map<string, { count: number; clan: { tag: string; name: string; avatarUrl: string | null; slug: string | null } }>()
  for (const sid of steamIds) {
    const clan = clanMap.get(sid)
    if (clan) {
      const entry = counts.get(clan.tag)
      if (entry) entry.count++
      else counts.set(clan.tag, { count: 1, clan })
    }
  }
  // Need at least half the team in the same clan
  const threshold = Math.ceil(steamIds.length / 2)
  let best: { tag: string; name: string; avatarUrl: string | null; slug: string | null } | null = null
  let bestCount = 0
  for (const [, entry] of counts) {
    if (entry.count > bestCount) {
      bestCount = entry.count
      best = entry.clan
    }
  }
  return bestCount >= threshold && best ? best : null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50)
    const gameType = searchParams.get("gameType")?.toLowerCase()

    const where: Record<string, unknown> = {
      gameStatus: "SUCCESS",
      serverType: "competitive",
      PlayerMatchStats: { some: {} },
    }

    if (gameType && gameType !== "all") {
      where.gameType = { equals: gameType, mode: "insensitive" }
    }

    const totalMatches = await prisma.match.count({ where })
    const totalPages = Math.ceil(totalMatches / limit)

    const matches = await prisma.match.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        matchId: true,
        gameType: true,
        map: true,
        timestamp: true,
        team1Score: true,
        team2Score: true,
        duration: true,
        serverName: true,
        PlayerMatchStats: {
          orderBy: { score: "desc" },
          select: {
            playerName: true,
            steamId: true,
            score: true,
            kills: true,
            deaths: true,
            damageDealt: true,
            team: true,
          },
        },
      },
    })

    // Batch clan lookup for all players in this page
    const allSteamIds = [...new Set(matches.flatMap((m) => m.PlayerMatchStats.map((p) => p.steamId)))]
    const clanMembers = await prisma.clanMember.findMany({
      where: { steamId: { in: allSteamIds } },
      select: { steamId: true, Clan: { select: { tag: true, name: true, avatarUrl: true, slug: true } } },
    })
    const clanMap = new Map(clanMembers.map((cm) => [cm.steamId, cm.Clan]))

    const formattedMatches = matches.map((match) => {
      const players = match.PlayerMatchStats
      const team1Players = players.filter((p) => p.team === 1)
      const team2Players = players.filter((p) => p.team === 2)

      if (match.gameType.toLowerCase() === "duel" && players.length >= 2) {
        const p1 = players[0]
        const p2 = players[1]
        const p1Clan = clanMap.get(p1.steamId)
        const p2Clan = clanMap.get(p2.steamId)
        return {
          id: match.id,
          matchId: match.matchId,
          gameType: match.gameType.toUpperCase(),
          map: match.map,
          timestamp: match.timestamp,
          duration: match.duration,
          score: `${p1.score}-${p2.score}`,
          player1: {
            name: p1.playerName, steamId: p1.steamId, score: p1.score,
            kills: p1.kills, deaths: p1.deaths,
            clanTag: p1Clan?.tag || null,
          },
          player2: {
            name: p2.playerName, steamId: p2.steamId, score: p2.score,
            kills: p2.kills, deaths: p2.deaths,
            clanTag: p2Clan?.tag || null,
          },
        }
      }

      const team1Clan = detectTeamClan(team1Players.map((p) => p.steamId), clanMap)
      const team2Clan = detectTeamClan(team2Players.map((p) => p.steamId), clanMap)

      return {
        id: match.id,
        matchId: match.matchId,
        gameType: match.gameType.toUpperCase(),
        map: match.map,
        timestamp: match.timestamp,
        duration: match.duration,
        score: `${match.team1Score ?? 0}-${match.team2Score ?? 0}`,
        team1Clan: team1Clan ? { tag: team1Clan.tag, name: team1Clan.name, avatarUrl: team1Clan.avatarUrl, slug: team1Clan.slug } : null,
        team2Clan: team2Clan ? { tag: team2Clan.tag, name: team2Clan.name, avatarUrl: team2Clan.avatarUrl, slug: team2Clan.slug } : null,
        team1Players: team1Players.map((p) => ({ name: p.playerName, steamId: p.steamId })),
        team2Players: team2Players.map((p) => ({ name: p.playerName, steamId: p.steamId })),
      }
    })

    return NextResponse.json({
      matches: formattedMatches,
      pagination: {
        page,
        limit,
        totalMatches,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    console.error("Error fetching ladder matches:", error)
    return NextResponse.json(
      {
        matches: [],
        pagination: { page: 1, limit: 20, totalMatches: 0, totalPages: 0, hasNext: false, hasPrev: false },
      },
      { status: 500 }
    )
  }
}
