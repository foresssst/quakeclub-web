/**
 * API de Títulos por Jugador - QuakeClub
 * 
 * Obtiene los títulos asignados a un jugador.
 */
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/players/[steamId]/titles
 * Obtener títulos de un jugador por su Steam ID
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
            return NextResponse.json({ titles: [] })
        }

        // Obtener títulos del jugador con información del título
        const titles = await prisma.playerTitle.findMany({
            where: { playerId: player.id },
            include: {
                title: true,
            },
            orderBy: [
                { isActive: 'desc' },
                { priority: 'asc' },
                { awardedAt: 'desc' },
            ],
        })

        return NextResponse.json({ titles })
    } catch (error) {
        console.error("Error fetching player titles:", error)
        return NextResponse.json({ error: "Error al obtener títulos" }, { status: 500 })
    }
}
