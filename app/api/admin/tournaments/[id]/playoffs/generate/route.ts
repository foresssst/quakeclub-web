import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getQualifiedTeams } from '@/lib/tournament-groups'
import { generatePlayoffBracket } from '@/lib/tournament-playoffs'

// POST /api/admin/tournaments/[id]/playoffs/generate
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession()
        if (!session?.user?.isAdmin) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id } = await params
        
        // Manejar body vacío
        let body: any = {}
        try {
            const text = await req.text()
            if (text) {
                body = JSON.parse(text)
            }
        } catch {
            // Body vacío o inválido, usar defaults
        }
        
        const {
            qualifyPerGroup = 2,
            format = 'BO7',
            includeThirdPlace = true,
            crossoverMode = 'standard'
        } = body

        // Get tournament
        const tournament = await prisma.tournament.findUnique({
            where: { id }
        })

        if (!tournament) {
            return NextResponse.json({ error: 'Torneo no encontrado' }, { status: 404 })
        }

        // Get qualified teams
        const qualifiedTeams = await getQualifiedTeams(id, qualifyPerGroup)

        if (qualifiedTeams.length < 2) {
            return NextResponse.json(
                { error: 'No hay suficientes equipos clasificados' },
                { status: 400 }
            )
        }

        // Delete existing playoff matches
        await prisma.tournamentMatch.deleteMany({
            where: {
                tournamentId: id,
                isPlayoff: true
            }
        })

        // Generate playoff bracket
        const playoffMatches = await generatePlayoffBracket(id, qualifiedTeams, {
            format,
            includeThirdPlace,
            crossoverMode
        })

        return NextResponse.json({
            success: true,
            message: `Se generaron ${playoffMatches.length} partidos de playoffs`,
            matches: playoffMatches
        })
    } catch (error: any) {
        console.error('Error generating playoffs:', error)
        return NextResponse.json(
            { error: error.message || 'Error al generar playoffs' },
            { status: 500 }
        )
    }
}
