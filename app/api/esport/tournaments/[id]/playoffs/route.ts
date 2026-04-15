import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPlayoffMatches } from '@/lib/tournament-playoffs'

// GET /api/esport/tournaments/[id]/playoffs - Get playoff bracket (public)
// Soporta buscar por ID o por slug
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: idOrSlug } = await params

        // First find tournament by ID or slug
        const tournament = await prisma.tournament.findFirst({
            where: {
                OR: [
                    { id: idOrSlug },
                    { slug: idOrSlug }
                ]
            },
            select: { id: true }
        })

        if (!tournament) {
            return NextResponse.json({ semifinals: [], finals: [], thirdPlace: [], allMatches: [], matches: [] })
        }

        const playoffMatches = await getPlayoffMatches(tournament.id)

        // Organize matches by round for easier frontend rendering
        const semifinals = playoffMatches.filter(m => m.roundText?.includes('SEMIFINAL') || m.roundText?.includes('Semifinal'))
        const finals = playoffMatches.filter(m => m.roundText === 'FINAL' || m.bracket === 'GRAND_FINALS')
        const thirdPlace = playoffMatches.filter(m => m.roundText === '3° PUESTO' || m.bracket === 'LOWER')

        return NextResponse.json({
            semifinals,
            finals,
            thirdPlace,
            allMatches: playoffMatches,
            matches: playoffMatches  // Para compatibilidad con BracketTab
        })
    } catch (error) {
        console.error('Error fetching playoffs:', error)
        return NextResponse.json(
            { error: 'Error al obtener playoffs' },
            { status: 500 }
        )
    }
}
