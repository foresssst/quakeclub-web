import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/admin/tournaments/[id]/groups - Create a single group
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
        
        // Support both single group creation and batch creation
        if (body.name) {
            // Single group creation
            const tournament = await prisma.tournament.findUnique({
                where: { id }
            })

            if (!tournament) {
                return NextResponse.json({ error: 'Torneo no encontrado' }, { status: 404 })
            }

            // Get current max order
            const maxOrder = await prisma.tournamentGroup.findFirst({
                where: { tournamentId: id },
                orderBy: { order: 'desc' },
                select: { order: true }
            })

            const group = await prisma.tournamentGroup.create({
                data: {
                    tournamentId: id,
                    name: body.name,
                    order: (maxOrder?.order || 0) + 1
                }
            })

            return NextResponse.json({ success: true, group })
        }
        
        // Batch creation (legacy support)
        const { groups } = body

        const tournament = await prisma.tournament.findUnique({
            where: { id }
        })

        if (!tournament) {
            return NextResponse.json({ error: 'Torneo no encontrado' }, { status: 404 })
        }

        // Delete existing groups for this tournament
        await prisma.tournamentGroup.deleteMany({
            where: { tournamentId: id }
        })

        // Create new groups and assign teams
        const createdGroups = []
        for (const groupData of groups) {
            const group = await prisma.tournamentGroup.create({
                data: {
                    tournamentId: id,
                    name: groupData.name,
                    order: groupData.order
                }
            })

            // Assign teams to this group
            if (groupData.teamIds && groupData.teamIds.length > 0) {
                await prisma.tournamentRegistration.updateMany({
                    where: {
                        id: { in: groupData.teamIds },
                        tournamentId: id
                    },
                    data: {
                        groupId: group.id
                    }
                })
            }

            createdGroups.push(group)
        }

        return NextResponse.json({
            success: true,
            groups: createdGroups
        })
    } catch (error: any) {
        console.error('Error creating groups:', error)
        return NextResponse.json(
            { error: error.message || 'Error al crear grupos' },
            { status: 500 }
        )
    }
}

// GET /api/admin/tournaments/[id]/groups - Get all groups with teams
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession()
        if (!session?.user?.isAdmin) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id } = await params

        const groups = await prisma.tournamentGroup.findMany({
            where: { tournamentId: id },
            include: {
                registrations: {
                    include: {
                        clan: {
                            select: {
                                name: true,
                                tag: true,
                                slug: true,
                                avatarUrl: true
                            }
                        },
                        player: {
                            select: {
                                username: true,
                                steamId: true
                            }
                        }
                    }
                },
                matches: {
                    include: {
                        participant1Reg: {
                            include: {
                                clan: true
                            }
                        },
                        participant2Reg: {
                            include: {
                                clan: true
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
    } catch (error: any) {
        console.error('Error fetching groups:', error)
        return NextResponse.json(
            { error: error.message || 'Error al obtener grupos' },
            { status: 500 }
        )
    }
}

// PUT /api/admin/tournaments/[id]/groups - Update group assignments
export async function PUT(
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
        const { assignments } = body // Map of registrationId -> groupId (or null)

        // First, clear all group assignments for this tournament
            await prisma.tournamentRegistration.updateMany({
            where: { tournamentId: id },
            data: { groupId: null }
        })

        // Then apply new assignments
        for (const [registrationId, groupId] of Object.entries(assignments)) {
            if (groupId) {
                await prisma.tournamentRegistration.update({
                    where: { id: registrationId },
                    data: { groupId: groupId as string }
            })
            }
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error updating groups:', error)
        return NextResponse.json(
            { error: error.message || 'Error al actualizar grupos' },
            { status: 500 }
        )
    }
}
