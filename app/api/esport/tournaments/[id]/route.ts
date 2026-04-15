import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"


// GET /api/esport/tournaments/[id] - Detalles completos de un torneo
// Soporta buscar por ID o por slug
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: idOrSlug } = await params

        // Buscar por ID o por slug
        const tournament = await prisma.tournament.findFirst({
            where: {
                OR: [
                    { id: idOrSlug },
                    { slug: idOrSlug }
                ]
            },
            include: {
                registrations: {
                    where: {
                        status: {
                            in: ['APPROVED', 'PENDING', 'CHECKED_IN']
                        }
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
                        },
                        tournamentTeam: {
                            select: {
                                id: true,
                                name: true,
                                tag: true,
                                avatarUrl: true
                            }
                        },
                        roster: {
                            include: {
                                player: {
                                    select: {
                                        id: true,
                                        username: true,
                                        steamId: true
                                    }
                                }
                            }
                        }
                    }
                },
                groups: {
                    include: {
                        registrations: {
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
                                },
                                tournamentTeam: {
                                    select: {
                                        id: true,
                                        name: true,
                                        tag: true,
                                        avatarUrl: true
                                    }
                                }
                            }
                        }
                    },
                    orderBy: {
                        order: 'asc'
                    }
                },
                matchdays: {
                    orderBy: {
                        matchdayNumber: 'asc'
                    }
                },
                matches: {
                    include: {
                        participant1Reg: {
                            include: {
                                clan: true,
                                player: true,
                                tournamentTeam: true
                            }
                        },
                        participant2Reg: {
                            include: {
                                clan: true,
                                player: true,
                                tournamentTeam: true
                            }
                        },
                        winner: {
                            include: {
                                clan: true,
                                player: true,
                                tournamentTeam: true
                            }
                        },
                        group: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        maps: {
                            where: {
                                status: 'VALIDATED'
                            },
                            orderBy: {
                                mapNumber: 'asc'
                            }
                        }
                    },
                    orderBy: [
                        { groupId: 'asc' },
                        { round: 'asc' },
                        { matchNumber: 'asc' }
                    ]
                }
            }
        })

        if (!tournament) {
            return NextResponse.json(
                { error: 'Torneo no encontrado' },
                { status: 404 }
            )
        }

        return NextResponse.json({ tournament })
    } catch (error) {
        console.error('Error fetching tournament:', error)
        return NextResponse.json(
            { error: 'Error al obtener torneo' },
            { status: 500 }
        )
    }
}

// DELETE /api/esport/tournaments/[id] - Eliminar torneo
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        // Eliminar torneo (cascade eliminará registrations, matches, etc)
        await prisma.tournament.delete({
            where: { id }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error deleting tournament:", error)
        return NextResponse.json(
            { error: "Error al eliminar torneo" },
            { status: 500 }
        )
    } finally {
        
    }
}
