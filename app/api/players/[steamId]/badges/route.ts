/**
 * API de Badges por Jugador - QuakeClub
 * 
 * Obtiene los badges (medallas) asignados a un jugador.
 */
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/players/[steamId]/badges
 * Obtener badges de un jugador por su Steam ID
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ steamId: string }> }
) {
    try {
        const { steamId } = await params

        // Buscar el jugador por steamId
        const player = await prisma.player.findUnique({
            where: { steamId },
            select: { id: true },
        })

        if (!player) {
            return NextResponse.json({ badges: [] })
        }

        // Obtener badges del jugador con información de la badge
        const badges = await prisma.playerBadge.findMany({
            where: { playerId: player.id },
            include: {
                badge: true,
            },
            orderBy: [
                { awardedAt: 'desc' },
            ],
        })

        return NextResponse.json({ badges })
    } catch (error) {
        console.error("Error fetching player badges:", error)
        return NextResponse.json({ error: "Error al obtener badges" }, { status: 500 })
    }
}
