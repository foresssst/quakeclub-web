import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// API pública para obtener las últimas partidas
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const limit = Math.min(parseInt(searchParams.get("limit") || "5"), 20)

        // Obtener las últimas partidas con sus jugadores
        const matches = await prisma.match.findMany({
            where: {
                gameStatus: "SUCCESS",
                // Solo partidas con al menos 2 jugadores
                PlayerMatchStats: {
                    some: {}
                }
            },
            orderBy: {
                timestamp: "desc"
            },
            take: limit,
            include: {
                PlayerMatchStats: {
                    orderBy: {
                        score: "desc"
                    },
                    take: 4,
                    select: {
                        playerName: true,
                        steamId: true,
                        score: true,
                        kills: true,
                        deaths: true,
                        team: true
                    }
                }
            }
        })

        // Formatear los datos para el frontend
        const formattedMatches = matches.map(match => {
            const players = match.PlayerMatchStats

            // Para DUEL, mostrar los dos jugadores
            if (match.gameType.toLowerCase() === "duel" && players.length >= 2) {
                const player1 = players[0]
                const player2 = players[1]
                return {
                    id: match.id,
                    matchId: match.matchId,
                    gameType: match.gameType.toUpperCase(),
                    map: match.map,
                    timestamp: match.timestamp,
                    player1: {
                        name: player1.playerName,
                        steamId: player1.steamId,
                        score: player1.score
                    },
                    player2: {
                        name: player2.playerName,
                        steamId: player2.steamId,
                        score: player2.score
                    },
                    score: `${player1.score}-${player2.score}`
                }
            }

            // Para modos de equipo, mostrar el score del equipo
            const team1Score = match.team1Score ?? 0
            const team2Score = match.team2Score ?? 0
            const team1Players = players.filter(p => p.team === 1).slice(0, 2)
            const team2Players = players.filter(p => p.team === 2).slice(0, 2)

            return {
                id: match.id,
                matchId: match.matchId,
                gameType: match.gameType.toUpperCase(),
                map: match.map,
                timestamp: match.timestamp,
                team1: team1Players.map(p => ({
                    name: p.playerName,
                    steamId: p.steamId
                })),
                team2: team2Players.map(p => ({
                    name: p.playerName,
                    steamId: p.steamId
                })),
                score: `${team1Score}-${team2Score}`
            }
        })

        return NextResponse.json({
            matches: formattedMatches
        })
    } catch (error) {
        console.error("Error fetching recent matches:", error)
        return NextResponse.json({ matches: [] }, { status: 500 })
    }
}
