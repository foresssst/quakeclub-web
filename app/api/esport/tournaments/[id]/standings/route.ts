import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"


interface TeamStanding {
    registrationId: string
    clanId: string
    clanName: string
    clanTag: string
    clanSlug: string
    clanAvatarUrl?: string
    // Tournament team fields (when participantType is TEAM)
    tournamentTeamId?: string
    tournamentTeamName?: string
    tournamentTeamTag?: string
    tournamentTeamAvatarUrl?: string
    participantType?: string
    groupId: string
    groupName: string
    played: number
    won: number
    drawn: number
    lost: number
    mapsWon: number
    mapsLost: number
    mapDiff: number
    points: number
}

// GET /api/esport/tournaments/[id]/standings - Obtener tabla de posiciones
// Soporta buscar por ID o por slug
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: idOrSlug } = await params

        // Get tournament with groups and their registrations (by ID or slug)
        const tournament = await prisma.tournament.findFirst({
            where: {
                OR: [
                    { id: idOrSlug },
                    { slug: idOrSlug }
                ]
            },
            include: {
                groups: {
                    include: {
                        registrations: {
                            where: {
                                status: 'APPROVED'
                            },
                            include: {
                                clan: true,
                                tournamentTeam: true
                            }
                        }
                    },
                    orderBy: {
                        order: 'asc'
                    }
                },
                matches: {
                    where: {
                        isPlayoff: false
                    },
                    include: {
                        maps: true,
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
            }
        })

        if (!tournament) {
            return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 })
        }

        // Calculate standings for each group
        const standingsByGroup: Record<string, TeamStanding[]> = {}

        for (const group of tournament.groups) {
            const teamStandings: TeamStanding[] = group.registrations.map(reg => {
                const tt = (reg as any).tournamentTeam
                return {
                registrationId: reg.id,
                clanId: reg.clan?.id || '',
                clanName: tt?.name || reg.clan?.name || 'Sin nombre',
                clanTag: tt?.tag || reg.clan?.tag || '???',
                clanSlug: reg.clan?.slug || '',
                clanAvatarUrl: tt?.avatarUrl || reg.clan?.avatarUrl || undefined,
                tournamentTeamId: tt?.id,
                tournamentTeamName: tt?.name,
                tournamentTeamTag: tt?.tag,
                tournamentTeamAvatarUrl: tt?.avatarUrl,
                participantType: (reg as any).participantType,
                groupId: group.id,
                groupName: group.name,
                played: 0,
                won: 0,
                drawn: 0,
                lost: 0,
                mapsWon: 0,
                mapsLost: 0,
                mapDiff: 0,
                points: 0
            }})

            // Process matches for this group
            // Filter matches where BOTH participants belong to this group
            // This handles cases where match.groupId might be incorrect
            const groupRegistrationIds = new Set(group.registrations.map(r => r.id))
            const groupMatches = tournament.matches.filter(m => {
                // A match belongs to this group if BOTH participants are in this group
                const p1InGroup = m.participant1Id && groupRegistrationIds.has(m.participant1Id)
                const p2InGroup = m.participant2Id && groupRegistrationIds.has(m.participant2Id)
                return p1InGroup && p2InGroup
            })

            for (const match of groupMatches) {
                if (match.status !== 'COMPLETED') continue

                const team1Standing = teamStandings.find(s => s.registrationId === match.participant1Id)
                const team2Standing = teamStandings.find(s => s.registrationId === match.participant2Id)

                if (!team1Standing || !team2Standing) continue

                // Count maps won by each team
                let team1MapsWon = 0
                let team2MapsWon = 0

                // First try to count from individual maps if they exist and have data
                const hasMapsWithWinners = match.maps && match.maps.length > 0 &&
                    match.maps.some((m: any) => m.winnerId || (m.score1 != null && m.score2 != null))

                if (hasMapsWithWinners) {
                    for (const map of match.maps) {
                        if (map.winnerId === match.participant1Id) {
                            team1MapsWon++
                        } else if (map.winnerId === match.participant2Id) {
                            team2MapsWon++
                        } else if (map.score1 != null && map.score2 != null) {
                            // Fallback: use scores if winnerId not set
                            if (map.score1 > map.score2) {
                                team1MapsWon++
                            } else if (map.score2 > map.score1) {
                                team2MapsWon++
                            }
                        }
                    }
                } else if (match.score1 != null && match.score2 != null) {
                    // Use match-level scores (e.g., 2-1 means team1 won 2 maps, team2 won 1)
                    team1MapsWon = match.score1
                    team2MapsWon = match.score2
                } else if (match.winnerId) {
                    // If we only have a winner, count as 1-0
                    if (match.winnerId === match.participant1Id) {
                        team1MapsWon = 1
                    } else {
                        team2MapsWon = 1
                    }
                }

                // Only count match if we have actual data
                const hasMatchData = team1MapsWon > 0 || team2MapsWon > 0 || match.winnerId

                if (hasMatchData) {
                    // Update standings
                    team1Standing.played++
                    team2Standing.played++

                    team1Standing.mapsWon += team1MapsWon
                    team1Standing.mapsLost += team2MapsWon
                    team2Standing.mapsWon += team2MapsWon
                    team2Standing.mapsLost += team1MapsWon

                    // Points: 1 per map won
                    team1Standing.points += team1MapsWon
                    team2Standing.points += team2MapsWon

                    // Match result (for W/D/L stats)
                    if (team1MapsWon > team2MapsWon) {
                        team1Standing.won++
                        team2Standing.lost++
                    } else if (team2MapsWon > team1MapsWon) {
                        team2Standing.won++
                        team1Standing.lost++
                    } else if (match.winnerId) {
                        // Use winnerId if scores are equal but there's a winner
                        if (match.winnerId === match.participant1Id) {
                            team1Standing.won++
                            team2Standing.lost++
                        } else {
                            team2Standing.won++
                            team1Standing.lost++
                        }
                    } else {
                        // True draw
                        team1Standing.drawn++
                        team2Standing.drawn++
                    }
                }
            }

            // Calculate map difference
            teamStandings.forEach(s => {
                s.mapDiff = s.mapsWon - s.mapsLost
            })

            // Sort by: 1. Points, 2. Map difference, 3. Maps won
            teamStandings.sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points
                if (b.mapDiff !== a.mapDiff) return b.mapDiff - a.mapDiff
                return b.mapsWon - a.mapsWon
            })

            standingsByGroup[group.name] = teamStandings
        }

        return NextResponse.json({
            standings: standingsByGroup,
            groups: tournament.groups.map(g => ({
                id: g.id,
                name: g.name
            }))
        })

    } catch (error) {
        console.error("Error fetching standings:", error)
        return NextResponse.json(
            { error: "Error al obtener tabla de posiciones" },
            { status: 500 }
        )
    } finally {

    }
}
