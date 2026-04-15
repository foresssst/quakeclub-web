import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// API pública para obtener estadísticas del homepage
export async function GET() {
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

        // Conteo de jugadores activos en los últimos 30 días
        const activePlayers = await prisma.playerRating.count({
            where: {
                totalGames: { gte: 1 },
                lastPlayed: { gte: thirtyDaysAgo }
            }
        })

        return NextResponse.json({
            activePlayers,
        }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } })
    } catch (error) {
        console.error("Error fetching homepage stats:", error)
        return NextResponse.json({ activePlayers: 0 }, { status: 500 })
    }
}
