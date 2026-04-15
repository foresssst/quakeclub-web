import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateStandings } from '@/lib/tournament-groups'

// GET /api/esport/tournaments/[id]/tabla - Get standings (public, legacy endpoint)
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { searchParams } = new URL(request.url)
        const groupId = searchParams.get('groupId')

        // Get tournament to check if it's custom type
        const tournament = await prisma.tournament.findUnique({
            where: { id },
            include: {
                groups: {
                    orderBy: {
                        order: 'asc'
                    }
                }
            }
        })

        if (!tournament) {
            return NextResponse.json(
                { error: 'Torneo no encontrado' },
                { status: 404 }
            )
        }

        // If custom tournament with groups, calculate standings
        if (tournament.tournamentType === 'CUSTOM_GROUP') {
            if (groupId) {
                // Get standings for specific group
                const standings = await calculateStandings(id, groupId)
                return NextResponse.json({ standings, groupId })
            } else {
                // Get standings for all groups
                const allStandings: Record<string, any> = {}
                for (const group of tournament.groups) {
                    allStandings[group.id] = await calculateStandings(id, group.id)
                }
                return NextResponse.json({ standingsByGroup: allStandings, groups: tournament.groups })
            }
        }

        // For standard tournaments, return basic info
        return NextResponse.json({
            message: 'Este torneo no usa el sistema de grupos customizado'
        })
    } catch (error) {
        console.error('Error fetching standings:', error)
        return NextResponse.json(
            { error: 'Error al obtener tabla' },
            { status: 500 }
        )
    }
}
