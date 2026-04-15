import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateGroupStageFixtures } from '@/lib/tournament-groups'

// POST /api/admin/tournaments/[id]/groups/generate-fixtures
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
        const body = await req.json()
        const { includeReturn = false } = body

        // Get tournament configuration
        const tournament = await prisma.tournament.findUnique({
            where: { id },
            include: {
                groups: {
                    include: {
                        registrations: {
                            where: {
                                status: 'APPROVED'
                            }
                        }
                    }
                }
            }
        })

        if (!tournament) {
            return NextResponse.json({ error: 'Torneo no encontrado' }, { status: 404 })
        }

        if (!tournament.groups || tournament.groups.length === 0) {
            return NextResponse.json(
                { error: 'No hay grupos creados para este torneo' },
                { status: 400 }
            )
        }

        // Delete existing matches for this tournament (if any)
        await prisma.tournamentMatch.deleteMany({
            where: {
                tournamentId: id,
                isPlayoff: false
            }
        })

        // Generate fixtures for each group
        const allMatches = []
        for (const group of tournament.groups) {
            if (group.registrations.length < 2) {
                continue // Skip groups with less than 2 teams
            }

            const matches = await generateGroupStageFixtures(id, group.id, {
                includeReturn,
                randomizeHome: false,
                teamsPerGroup: group.registrations.length,
                mapsPerMatch: tournament.mapsPerMatch || 3
            })

            allMatches.push(...matches)
        }

        return NextResponse.json({
            success: true,
            message: `Se generaron ${allMatches.length} partidos`,
            matches: allMatches
        })
    } catch (error: any) {
        console.error('Error generating fixtures:', error)
        return NextResponse.json(
            { error: error.message || 'Error al generar fixture' },
            { status: 500 }
        )
    }
}
