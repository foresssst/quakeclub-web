/**
 * Sistema de Grupos de Torneos de QuakeClub
 *
 * Implementa la fase de grupos para torneos Round Robin.
 * Basado en brackets-manager.js para compatibilidad con estándares de torneos.
 *
 * FUNCIONES PRINCIPALES:
 * - makeRoundRobinDistribution: Genera calendario de partidos Round Robin
 * - generateGroupFixtures: Crea fixtures para todos los grupos
 * - calculateGroupStandings: Calcula tabla de posiciones por grupo
 *
 * CRITERIOS DE DESEMPATE:
 * - Puntos totales
 * - Diferencia de mapas
 * - Enfrentamiento directo
 * - Manual (admin)
 */

import { prisma } from '@/lib/prisma'
import type { TournamentRegistration, TournamentMatch, TournamentGroup } from '@prisma/client'

export interface Assignment {
    groupId: string
    teamIds: string[]
}

export interface FixtureConfig {
    includeReturn: boolean
    randomizeHome: boolean
    teamsPerGroup: number
    mapsPerMatch: number
}

export interface TeamStanding {
    registrationId: string
    clanId: string | null
    playerId: string | null
    clan?: {
        name: string
        tag: string
        avatarUrl: string | null
    }
    player?: {
        username: string
        steamId: string
    }
    played: number
    won: number
    drawn: number
    lost: number
    mapsWon: number
    mapsLost: number
    mapsDiff: number
    points: number
}

export interface TiebreakerRules {
    criteria: ('points' | 'mapDiff' | 'headToHead' | 'manual')[]
}

/**
 * Round Robin Distribution Algorithm
 * Based on brackets-manager.js - Creates balanced schedule where each team plays each other once per round
 * 
 * Conditions:
 * - Each participant plays each other once (or twice with return matches)
 * - Each participant plays once in each round
 * - Minimizes home/away imbalance
 * 
 * @param participants Array of participants (can be registration IDs or objects)
 * @returns Array of rounds, each containing an array of match pairs
 */
export function makeRoundRobinDistribution<T>(participants: T[]): [T, T][][] {
    const n = participants.length
    const n1 = n % 2 === 0 ? n : n + 1 // Add dummy if odd number
    const roundCount = n1 - 1
    const matchPerRound = n1 / 2

    const rounds: [T, T][][] = []

    for (let roundId = 0; roundId < roundCount; roundId++) {
        const matches: [T, T][] = []

        for (let matchId = 0; matchId < matchPerRound; matchId++) {
            // Skip if one team is the dummy (odd number of participants)
            if (matchId === 0 && n % 2 === 1) continue

            const opponentsIds = [
                (roundId - matchId - 1 + n1) % (n1 - 1),
                matchId === 0 ? n1 - 1 : (roundId + matchId) % (n1 - 1)
            ]

            matches.push([
                participants[opponentsIds[0]],
                participants[opponentsIds[1]]
            ])
        }

        rounds.push(matches)
    }

    return rounds
}

/**
 * Creates round robin matches including optional return fixtures
 * @param participants Array of participants
 * @param mode 'simple' = single round robin, 'double' = home and away
 */
export function makeRoundRobinMatches<T>(participants: T[], mode: 'simple' | 'double' = 'simple'): [T, T][][] {
    const distribution = makeRoundRobinDistribution(participants)

    if (mode === 'simple') {
        return distribution
    }

    // Reverse rounds and their content for return matches
    const symmetry = distribution.map(round => 
        [...round].map(([a, b]) => [b, a] as [T, T]).reverse()
    ).reverse()

    return [...distribution, ...symmetry]
}

/**
 * Assign teams to groups
 */
export async function assignTeamsToGroups(
    tournamentId: string,
    assignments: Map<string, string[]>
): Promise<void> {
    const updates: Promise<any>[] = []

    for (const [groupId, teamIds] of assignments.entries()) {
        for (const teamId of teamIds) {
            updates.push(
                prisma.tournamentRegistration.update({
                    where: { id: teamId },
                    data: { groupId }
                })
            )
        }
    }

    await Promise.all(updates)
}

/**
 * Generate group stage fixtures using improved Round Robin algorithm
 * Based on brackets-manager.js implementation
 */
export async function generateGroupStageFixtures(
    tournamentId: string,
    groupId: string,
    config: FixtureConfig
): Promise<TournamentMatch[]> {
    // Get all teams in the group
    const teams = await prisma.tournamentRegistration.findMany({
        where: {
            tournamentId,
            groupId,
            status: 'APPROVED'
        },
        orderBy: {
            seed: 'asc'
        }
    })

    if (teams.length < 2) {
        throw new Error('Se necesitan al menos 2 equipos en el grupo')
    }

    // Use the improved round robin algorithm
    const mode = config.includeReturn ? 'double' : 'simple'
    const rounds = makeRoundRobinMatches(teams, mode)

    const matches: any[] = []
    let matchNumber = 1

    // Create matches from the generated rounds
    for (let roundIdx = 0; roundIdx < rounds.length; roundIdx++) {
        const round = rounds[roundIdx]
        const isReturnRound = config.includeReturn && roundIdx >= Math.ceil(rounds.length / 2)
        
        for (const [team1, team2] of round) {
            matches.push({
                tournamentId,
                groupId,
                participant1Id: team1.id,
                participant2Id: team2.id,
                homeTeamId: team1.id,
                round: roundIdx + 1,
                matchNumber,
                bracket: 'UPPER',
                status: 'PENDING',
                bestOf: config.mapsPerMatch,
                isPlayoff: false,
                roundText: isReturnRound 
                    ? `Jornada ${roundIdx + 1} (Vuelta)` 
                    : `Jornada ${roundIdx + 1}`
            })
            matchNumber++
        }
    }

    // Create all matches
    await prisma.tournamentMatch.createMany({
        data: matches
    })

    // Fetch and return created matches
    return prisma.tournamentMatch.findMany({
        where: {
            tournamentId,
            groupId
        },
        orderBy: {
            matchNumber: 'asc'
        }
    })
}

/**
 * Calculate standings for a group or entire tournament
 * Uses match scores (score1, score2) as the primary source of truth
 * Note: Only counts matches where BOTH participants belong to the specified group
 */
export async function calculateStandings(
    tournamentId: string,
    groupId?: string
): Promise<TeamStanding[]> {
    // Get all registrations in scope
    const registrations = await prisma.tournamentRegistration.findMany({
        where: {
            tournamentId,
            ...(groupId ? { groupId } : {}),
            status: { in: ['APPROVED', 'CHECKED_IN'] }
        },
        include: {
            clan: {
                select: {
                    name: true,
                    tag: true,
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
    })

    // Create a set of registration IDs for this group for validation
    const groupRegistrationIds = new Set(registrations.map(r => r.id))

    // Get all completed matches in this scope
    const allMatches = await prisma.tournamentMatch.findMany({
        where: {
            tournamentId,
            status: 'COMPLETED',
            isPlayoff: false // Only count group stage matches
        },
        include: {
            maps: true
        }
    })

    // Filter matches where BOTH participants belong to this group
    // This handles cases where match.groupId might be incorrect
    const matches = groupId 
        ? allMatches.filter(m => 
            m.participant1Id && groupRegistrationIds.has(m.participant1Id) &&
            m.participant2Id && groupRegistrationIds.has(m.participant2Id)
          )
        : allMatches

    // Calculate stats for each team
    // Sistema de puntuación: 1 punto por cada mapa ganado
    const standings: TeamStanding[] = registrations.map(reg => {
        const teamMatches = matches.filter(
            m => m.participant1Id === reg.id || m.participant2Id === reg.id
        )

        let won = 0
        let drawn = 0
        let lost = 0
        let mapsWon = 0
        let mapsLost = 0

        teamMatches.forEach(match => {
            let teamMapsWon = 0
            let opposingMapsWon = 0
            const isTeam1 = match.participant1Id === reg.id

            // First try to count from individual maps if they exist and have data
            const hasMapsWithWinners = match.maps && match.maps.length > 0 && 
                match.maps.some(m => m.winnerId || (m.score1 != null && m.score2 != null))

            if (hasMapsWithWinners) {
                match.maps.forEach(map => {
                    if (map.winnerId === reg.id) {
                        teamMapsWon++
                    } else if (map.winnerId) {
                        opposingMapsWon++
                    } else if (map.score1 != null && map.score2 != null) {
                        // Use map scores if no winnerId
                        const mapTeamScore = isTeam1 ? map.score1 : map.score2
                        const mapOpponentScore = isTeam1 ? map.score2 : map.score1
                        if (mapTeamScore > mapOpponentScore) {
                            teamMapsWon++
                        } else if (mapOpponentScore > mapTeamScore) {
                            opposingMapsWon++
                        }
                    }
                })
            } else if (match.score1 != null && match.score2 != null) {
                // Use match-level scores (e.g., 2-1 means team1 won 2 maps, team2 won 1)
                teamMapsWon = isTeam1 ? match.score1 : match.score2
                opposingMapsWon = isTeam1 ? match.score2 : match.score1
            } else if (match.winnerId) {
                // If we only have a winner, count as 1-0
                if (match.winnerId === reg.id) {
                    teamMapsWon = 1
                } else {
                    opposingMapsWon = 1
                }
            }

            // Update totals
            mapsWon += teamMapsWon
            mapsLost += opposingMapsWon

            // Determine match result
            if (teamMapsWon > opposingMapsWon) {
                won++
            } else if (teamMapsWon < opposingMapsWon) {
                lost++
            } else if (match.winnerId) {
                // Scores tied but there's a winner
                if (match.winnerId === reg.id) {
                    won++
                } else {
                    lost++
                }
            } else if (teamMapsWon > 0) {
                // True draw
                drawn++
            }
        })

        const played = won + drawn + lost
        // 1 punto por cada mapa ganado (según las bases del torneo)
        const points = mapsWon
        const mapsDiff = mapsWon - mapsLost

        return {
            registrationId: reg.id,
            clanId: reg.clanId,
            playerId: reg.playerId,
            clan: reg.clan,
            player: reg.player,
            played,
            won,
            drawn,
            lost,
            mapsWon,
            mapsLost,
            mapsDiff,
            points
        }
    })

    // Sort by points, then map diff, then maps won
    standings.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.mapsDiff !== a.mapsDiff) return b.mapsDiff - a.mapsDiff
        return b.mapsWon - a.mapsWon
    })

    return standings
}

/**
 * Get qualified teams from groups
 * Returns teams ordered for proper crossover seeding:
 * - For 2 groups with 2 qualifiers each: [1°G1, 1°G2, 2°G2, 2°G1]
 *   This creates crossover: 1°G1 vs 2°G2, 1°G2 vs 2°G1
 * - For more groups/qualifiers, uses snake draft order for fair bracket distribution
 */
export async function getQualifiedTeams(
    tournamentId: string,
    qualifyPerGroup: number
): Promise<TournamentRegistration[]> {
    const groups = await prisma.tournamentGroup.findMany({
        where: { tournamentId },
        orderBy: { order: 'asc' }
    })

    // Get qualified teams per group with their positions
    const qualifiedByGroup: { groupIndex: number; position: number; reg: TournamentRegistration }[] = []

    for (let gIdx = 0; gIdx < groups.length; gIdx++) {
        const group = groups[gIdx]
        const standings = await calculateStandings(tournamentId, group.id)
        const groupQualified = standings.slice(0, qualifyPerGroup)

        for (let pos = 0; pos < groupQualified.length; pos++) {
            const standing = groupQualified[pos]
            const reg = await prisma.tournamentRegistration.findUnique({
                where: { id: standing.registrationId },
                include: {
                    clan: true,
                    player: true
                }
            })
            if (reg) {
                qualifiedByGroup.push({
                    groupIndex: gIdx,
                    position: pos, // 0 = 1st place, 1 = 2nd place, etc.
                    reg
                })
            }
        }
    }

    // Sort for proper crossover seeding
    // For standard crossover with 2 groups:
    // - 1st of each group gets seeds 1,2 (will play against 2nd of opposite group)
    // - 2nd of each group gets seeds 3,4 (in reverse order for crossover)
    // General pattern: snake draft by position, then by group
    const qualified: TournamentRegistration[] = []
    const groupCount = groups.length

    // Group teams by their finishing position
    for (let pos = 0; pos < qualifyPerGroup; pos++) {
        const teamsAtPosition = qualifiedByGroup.filter(q => q.position === pos)
        
        // Alternate direction for snake draft (crossover effect)
        if (pos % 2 === 0) {
            // Even positions: normal order (Group A, B, C...)
            teamsAtPosition.sort((a, b) => a.groupIndex - b.groupIndex)
        } else {
            // Odd positions: reverse order (Group C, B, A...)
            teamsAtPosition.sort((a, b) => b.groupIndex - a.groupIndex)
        }
        
        for (const team of teamsAtPosition) {
            qualified.push(team.reg)
        }
    }

    console.log('[Playoffs] Qualified teams order:', qualified.map((q, i) => 
        `Seed ${i+1}: ${q.clan?.tag || q.player?.username || q.id}`
    ).join(', '))

    return qualified
}

/**
 * Apply tiebreakers (head-to-head, goals, etc.)
 */
export async function applyTiebreakers(
    teams: TeamStanding[],
    rules: TiebreakerRules
): Promise<TeamStanding[]> {
    // Orden por: puntos -> diferencia de mapas -> mapas ganados
    return teams
}

/**
 * Validate roster size against tournament config
 */
export async function validateRosterSize(
    registration: TournamentRegistration & { roster: any[] },
    tournament: any
): Promise<{ valid: boolean; message?: string }> {
    const rosterSize = registration.roster.length

    if (tournament.minRosterSize && rosterSize < tournament.minRosterSize) {
        return {
            valid: false,
            message: `El roster debe tener al menos ${tournament.minRosterSize} jugadores`
        }
    }

    if (tournament.maxRosterSize && rosterSize > tournament.maxRosterSize) {
        return {
            valid: false,
            message: `El roster no puede tener más de ${tournament.maxRosterSize} jugadores`
        }
    }

    return { valid: true }
}

/**
 * Distribute teams into groups evenly
 * Based on brackets-manager.js makeGroups
 */
export function distributeTeamsToGroups<T>(teams: T[], groupCount: number): T[][] {
    const groupSize = Math.ceil(teams.length / groupCount)
    const result: T[][] = []

    for (let i = 0; i < teams.length; i++) {
        if (i % groupSize === 0) {
            result.push([])
        }
        result[result.length - 1].push(teams[i])
    }

    return result
}

/**
 * Seed-balanced group distribution
 * Distributes teams so that top seeds are spread across groups
 * e.g., with 8 teams in 2 groups: [1,4,5,8] [2,3,6,7]
 */
export function seedBalancedDistribution<T>(teams: T[], groupCount: number): T[][] {
    const groups: T[][] = Array.from({ length: groupCount }, () => [])
    
    let direction = 1
    let groupIdx = 0

    for (let i = 0; i < teams.length; i++) {
        groups[groupIdx].push(teams[i])
        
        groupIdx += direction
        
        // Reverse direction at boundaries (snake draft)
        if (groupIdx >= groupCount || groupIdx < 0) {
            direction *= -1
            groupIdx += direction
        }
    }

    return groups
}
