import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"


// GET /api/esport/tournaments/[id]/matches - Obtener todos los partidos del torneo
// Soporta buscar por ID o por slug
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: idOrSlug } = await params

        const tournament = await prisma.tournament.findFirst({
            where: {
                OR: [
                    { id: idOrSlug },
                    { slug: idOrSlug }
                ]
            },
            select: {
                id: true,
                format: true,
                matches: {
                    include: {
                        participant1Reg: {
                            include: {
                                clan: {
                                    select: {
                                        id: true,
                                        tag: true,
                                        slug: true,
                                        name: true,
                                        avatarUrl: true
                                    }
                                },
                                player: {
                                    select: {
                                        id: true,
                                        username: true,
                                        avatar: true
                                    }
                                },
                                tournamentTeam: {
                                    select: {
                                        id: true,
                                        tag: true,
                                        name: true,
                                        avatarUrl: true
                                    }
                                }
                            }
                        },
                        participant2Reg: {
                            include: {
                                clan: {
                                    select: {
                                        id: true,
                                        tag: true,
                                        slug: true,
                                        name: true,
                                        avatarUrl: true
                                    }
                                },
                                player: {
                                    select: {
                                        id: true,
                                        username: true,
                                        avatar: true
                                    }
                                },
                                tournamentTeam: {
                                    select: {
                                        id: true,
                                        tag: true,
                                        name: true,
                                        avatarUrl: true
                                    }
                                }
                            }
                        },
                        maps: {
                            orderBy: {
                                mapNumber: 'asc'
                            }
                        }
                    },
                    orderBy: [
                        { round: 'asc' },
                        { matchNumber: 'asc' }
                    ]
                }
            }
        })

        if (!tournament) {
            return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 })
        }

        return NextResponse.json({
            matches: tournament.matches,
            format: tournament.format
        })

    } catch (error) {
        console.error("Error fetching matches:", error)
        return NextResponse.json(
            { error: "Error al obtener partidos" },
            { status: 500 }
        )
    } finally {

    }
}
