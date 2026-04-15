import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// API pública para estadísticas de la comunidad
export async function GET() {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

        // Ejecutar todas las queries en paralelo para mejor rendimiento
        const [
            totalPlayers,
            matchesThisWeek,
            totalClans,
            upcomingTournaments
        ] = await Promise.all([
            // Total de jugadores registrados (con al menos 1 partida)
            prisma.player.count({
                where: {
                    PlayerRating: {
                        some: {
                            totalGames: { gte: 1 }
                        }
                    }
                }
            }),
            // Partidas de esta semana
            prisma.match.count({
                where: {
                    timestamp: { gte: sevenDaysAgo },
                    gameStatus: "SUCCESS"
                }
            }),
            // Total de clanes activos
            prisma.clan.count(),
            // Torneos activos o próximos
            prisma.tournament.count({
                where: {
                    status: {
                        in: ["UPCOMING", "REGISTRATION_OPEN", "IN_PROGRESS"]
                    }
                }
            })
        ])

        return NextResponse.json({
            members: totalPlayers,
            matchesWeek: matchesThisWeek,
            clans: totalClans,
            tournaments: upcomingTournaments
        }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } })
    } catch (error) {
        console.error("Error fetching community stats:", error)
        return NextResponse.json({
            members: 0,
            matchesWeek: 0,
            clans: 0,
            tournaments: 0
        }, { status: 500 })
    }
}
