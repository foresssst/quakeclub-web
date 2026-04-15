import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ steamId1: string; steamId2: string }> }
) {
    const apiKey = request.headers.get("x-api-key")
    if (apiKey !== process.env.MINQLX_API_KEY) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { steamId1, steamId2 } = await params

    try {
        const player1Matches = await prisma.playerMatchStats.findMany({
            where: {
                steamId: steamId1,
                Match: {
                    PlayerMatchStats: {
                        some: { steamId: steamId2 }
                    }
                }
            },
            select: {
                kills: true,
                deaths: true,
                team: true,
                Match: {
                    select: {
                        map: true,
                        gameType: true,
                        timestamp: true,
                        winner: true,
                        team1Score: true,
                        team2Score: true,
                    }
                }
            },
            orderBy: { Match: { timestamp: "desc" } },
            take: 50,
        })

        if (player1Matches.length === 0) {
            return NextResponse.json({ wins: 0, losses: 0, myKills: 0, myDeaths: 0, recent: [] })
        }

        let wins = 0
        let losses = 0
        let myKills = 0
        let myDeaths = 0
        const recent: object[] = []

        for (const pm of player1Matches) {
            const match = pm.Match
            myKills += pm.kills
            myDeaths += pm.deaths

            // Determinar ganador: primero por campo winner, si no por team1Score/team2Score
            let won = false
            if (match.winner != null && pm.team != null) {
                won = match.winner === pm.team
            } else if (match.team1Score != null && match.team2Score != null && pm.team != null) {
                const winningTeam = match.team1Score > match.team2Score ? 1 : 2
                won = winningTeam === pm.team
            }

            if (won) wins++
            else losses++

            if (recent.length < 10) {
                recent.push({
                    result: won ? "W" : "L",
                    map: match.map,
                    gameType: match.gameType,
                    kills: pm.kills,
                    deaths: pm.deaths,
                    date: match.timestamp
                        ? new Date(match.timestamp).toLocaleDateString("es-CL", {
                            day: "2-digit", month: "2-digit", year: "2-digit",
                            timeZone: "America/Santiago"
                          })
                        : "",
                })
            }
        }

        return NextResponse.json({ wins, losses, myKills, myDeaths, recent })
    } catch (error) {
        console.error("[H2H API] Error:", error)
        return NextResponse.json({ error: "Internal error" }, { status: 500 })
    }
}
