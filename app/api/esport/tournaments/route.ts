import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"


// GET /api/esport/tournaments - Listar todos los torneos
export async function GET() {
    try {
        const tournaments = await prisma.tournament.findMany({
            orderBy: [
                { status: 'asc' }, // UPCOMING primero, luego IN_PROGRESS, etc.
                { startsAt: 'desc' }
            ],
            include: {
                _count: {
                    select: {
                        registrations: true,
                        matches: true
                    }
                }
            }
        })

        // Agrupar por estado
        const upcoming = tournaments.filter(t => t.status === 'UPCOMING' || t.status === 'REGISTRATION_OPEN')
        const active = tournaments.filter(t => t.status === 'IN_PROGRESS' || t.status === 'REGISTRATION_CLOSED')
        const completed = tournaments.filter(t => t.status === 'COMPLETED')

        return NextResponse.json({
            upcoming,
            active,
            completed,
            all: tournaments
        })
    } catch (error) {
        console.error("Error fetching tournaments:", error)
        return NextResponse.json(
            { error: "Error al cargar torneos" },
            { status: 500 }
        )
    } finally {
        
    }
}
