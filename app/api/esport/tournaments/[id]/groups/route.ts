import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/esport/tournaments/[id]/groups - Get groups with teams (public)
// Soporta buscar por ID o por slug
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: idOrSlug } = await params

        // First find tournament by ID or slug to get the real ID
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
            return NextResponse.json({ groups: [] })
        }

        const groups = await prisma.tournamentGroup.findMany({
            where: { tournamentId: tournament.id },
            include: {
                registrations: {
                    where: {
                        status: { in: ['APPROVED', 'CHECKED_IN'] }
                    },
                    include: {
                        clan: {
                            select: {
                                id: true,
                                name: true,
                                tag: true,
                                slug: true,
                                avatarUrl: true
                            }
                        },
                        player: {
                            select: {
                                id: true,
                                username: true,
                                steamId: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                order: 'asc'
            }
        })

        return NextResponse.json({ groups })
    } catch (error) {
        console.error('Error fetching groups:', error)
        return NextResponse.json(
            { error: 'Error al obtener grupos' },
            { status: 500 }
        )
    }
}
