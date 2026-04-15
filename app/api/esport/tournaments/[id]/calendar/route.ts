import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/esport/tournaments/[id]/calendar - Get matchdays and matches (public)
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
            return NextResponse.json({ matchdays: [], matches: [] })
        }

        const tournamentId = tournament.id

        // First try to get matchdays if they exist
        const matchdays = await prisma.tournamentMatchday.findMany({
            where: { tournamentId },
            include: {
                matches: {
                    include: {
                        participant1Reg: {
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
                                tournamentTeam: {
                                    select: {
                                        id: true,
                                        name: true,
                                        tag: true,
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
                        },
                        participant2Reg: {
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
                                tournamentTeam: {
                                    select: {
                                        id: true,
                                        name: true,
                                        tag: true,
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
                        },
                        winner: {
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
                                tournamentTeam: {
                                    select: {
                                        id: true,
                                        name: true,
                                        tag: true,
                                        avatarUrl: true
                                    }
                                }
                            }
                        },
                        maps: {
                            orderBy: {
                                mapNumber: 'asc'
                            },
                            select: {
                                id: true,
                                mapNumber: true,
                                mapName: true,
                                winnerId: true,
                                score1: true,
                                score2: true,
                                playedAt: true,
                                status: true
                            }
                        },
                        group: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    },
                    orderBy: {
                        matchNumber: 'asc'
                    }
                }
            },
            orderBy: {
                matchdayNumber: 'asc'
            }
        })

        // If no matchdays exist, get matches directly and group by group
        if (matchdays.length === 0) {
            const matches = await prisma.tournamentMatch.findMany({
                where: {
                    tournamentId: tournamentId,
                    isPlayoff: false
                },
                include: {
                    participant1Reg: {
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
                            tournamentTeam: {
                                select: {
                                    id: true,
                                    name: true,
                                    tag: true,
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
                    },
                    participant2Reg: {
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
                            tournamentTeam: {
                                select: {
                                    id: true,
                                    name: true,
                                    tag: true,
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
                    },
                    winner: {
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
                            tournamentTeam: {
                                select: {
                                    id: true,
                                    name: true,
                                    tag: true,
                                    avatarUrl: true
                                }
                            }
                        }
                    },
                    maps: {
                        orderBy: {
                            mapNumber: 'asc'
                        },
                        select: {
                            id: true,
                            mapNumber: true,
                            mapName: true,
                            winnerId: true,
                            score1: true,
                            score2: true,
                            playedAt: true,
                            status: true
                        }
                    },
                    group: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                },
                orderBy: [
                    { groupId: 'asc' },
                    { matchNumber: 'asc' }
                ]
            })

            // Group matches by group for display
            const groupedByGroup: Record<string, any[]> = {}
            matches.forEach(match => {
                const groupName = match.group?.name || 'Sin Grupo'
                if (!groupedByGroup[groupName]) {
                    groupedByGroup[groupName] = []
                }
                groupedByGroup[groupName].push(match)
            })

            // Convert to matchday-like structure for frontend compatibility
            const virtualMatchdays = Object.entries(groupedByGroup).map(([groupName, groupMatches], index) => ({
                id: `virtual-${index}`,
                tournamentId: tournamentId,
                matchdayNumber: index + 1,
                name: groupName,
                scheduledDate: null,
                matches: groupMatches
            }))

            return NextResponse.json({
                matchdays: virtualMatchdays,
                matches // Also return flat matches array
            })
        }

        return NextResponse.json({ matchdays })
    } catch (error) {
        console.error('Error fetching calendar:', error)
        return NextResponse.json(
            { error: 'Error al obtener calendario' },
            { status: 500 }
        )
    }
}
