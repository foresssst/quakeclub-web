/**
 * Sistema de Playoffs de Torneos de QuakeClub
 *
 * Implementa la fase eliminatoria (brackets) para torneos.
 * Basado en brackets-manager.js para compatibilidad con estándares de torneos.
 *
 * FUNCIONES PRINCIPALES:
 * - generatePlayoffBracket: Genera bracket de eliminación simple
 * - generateDoubleEliminationBracket: Genera bracket de doble eliminación
 * - advanceWinner: Avanza ganadores al siguiente round
 *
 * FORMATOS SOPORTADOS:
 * - Single Elimination (eliminación simple)
 * - Double Elimination (doble eliminación con losers bracket)
 * - BO3, BO5, BO7 (series al mejor de 3, 5 o 7)
 *
 * SEEDING:
 * - Usa patrón inner-outer para seeds justos
 * - Seed 1 vs Seed 8, Seed 4 vs Seed 5, etc.
 */

import { prisma } from '@/lib/prisma'
import type { TournamentRegistration, TournamentMatch } from '@prisma/client'

export interface PlayoffConfig {
    format: 'BO3' | 'BO5' | 'BO7'
    includeThirdPlace: boolean
    crossoverMode: 'standard' | 'custom'
    customMatchups?: Array<{ team1: string; team2: string }>
}

export interface CrossoverConfig {
    mode: 'standard' | 'custom'
}

// ==================== HELPER FUNCTIONS ====================
// Based on brackets-manager.js logic (ordering.ts, helpers.ts)

interface ParticipantSlot {
    id: string | null
    position: number
}

type Duel = [ParticipantSlot | null, ParticipantSlot | null]

function nextPowerOf2(n: number): number {
    if (n <= 1) return 2
    return Math.pow(2, Math.ceil(Math.log2(n)))
}

function makePairs<T>(array: T[]): [T, T][] {
    return array.reduce((acc, _, i) => {
        if (i % 2 === 0) acc.push([array[i], array[i + 1]] as [T, T])
        return acc
    }, [] as [T, T][])
}

function byeWinner(duel: Duel): ParticipantSlot | null {
    if (duel[0] === null && duel[1] === null) return null
    if (duel[0] === null && duel[1] !== null) return duel[1]
    if (duel[0] !== null && duel[1] === null) return duel[0]
    return { id: null, position: 0 }
}

function transitionToMajor(previousDuels: Duel[]): Duel[] {
    const currentDuels: Duel[] = []
    for (let i = 0; i < previousDuels.length / 2; i++) {
        currentDuels.push([
            byeWinner(previousDuels[i * 2]),
            byeWinner(previousDuels[i * 2 + 1])
        ])
    }
    return currentDuels
}

/**
 * FROM brackets-manager.js: ordering.ts
 * Generates standard bracket seeding positions (inner-outer pattern)
 * For size 8: [1, 8, 4, 5, 2, 7, 3, 6]
 * This creates matches: Seed1 vs Seed8, Seed4 vs Seed5, Seed2 vs Seed7, Seed3 vs Seed6
 */
function innerOuterSeeding<T>(array: T[]): T[] {
    if (array.length === 2) return array

    const participantCount = array.length

    // Generate standard bracket seeding positions iteratively
    let positions: number[] = [1, 2]
    while (positions.length < participantCount) {
        const size = positions.length * 2
        const next: number[] = []
        for (const pos of positions)
            next.push(pos, size + 1 - pos)
        positions = next
    }

    const result: T[] = []
    for (const pos of positions)
        result.push(array[pos - 1])

    return result
}

/**
 * FROM brackets-manager.js: helpers.ts
 * Balances BYEs to prevent having BYE against BYE in matches.
 */
function balanceByes(seeding: (ParticipantSlot | null)[], participantCount: number): (ParticipantSlot | null)[] {
    const nonNull = seeding.filter(v => v !== null) as ParticipantSlot[]
    
    if (nonNull.length < participantCount / 2) {
        const flat: (ParticipantSlot | null)[] = nonNull.flatMap(v => [v, null])
        while (flat.length < participantCount) flat.push(null)
        return flat
    }

    const nonNullCount = nonNull.length
    const nullCount = participantCount - nonNullCount
    
    const teamsToPlay = nonNullCount - nullCount
    const againstEachOther: (ParticipantSlot | null)[] = []
    for (let i = 0; i < teamsToPlay; i += 2) {
        againstEachOther.push(nonNull[i], nonNull[i + 1])
    }
    
    const againstNull: (ParticipantSlot | null)[] = []
    for (let i = teamsToPlay; i < nonNullCount; i++) {
        againstNull.push(nonNull[i], null)
    }
    
    const result = [...againstEachOther, ...againstNull]
    while (result.length < participantCount) result.push(null)
    
    return result
}

/**
 * Create seeded slots array with proper BYE distribution
 * Combines inner-outer seeding with BYE balancing from brackets-manager.js
 */
function createSeededSlots(teams: { id: string }[], bracketSize: number): ParticipantSlot[] {
    const initialSlots: ParticipantSlot[] = teams.map((t, i) => ({
        id: t.id,
        position: i + 1
    }))
    
    const paddedSlots: (ParticipantSlot | null)[] = [...initialSlots]
    while (paddedSlots.length < bracketSize) paddedSlots.push(null)
    
    const seeded = innerOuterSeeding(paddedSlots)
    const balanced = balanceByes(seeded, bracketSize)
    
    return balanced.map((slot, i) => ({
        id: slot?.id || null,
        position: i + 1
    }))
}

// ==================== PLAYOFF BRACKET GENERATION ====================

/**
 * Generate complete playoff bracket
 * Now supports any number of teams (2, 4, 8, 16, etc. or non-power-of-2 with BYEs)
 * 
 * For 4 teams from 2 groups (standard crossover):
 * - Teams arrive ordered: [1°A, 1°B, 2°B, 2°A]
 * - Crossover creates: Semi1 = 1°A vs 2°B, Semi2 = 1°B vs 2°A
 */
export async function generatePlayoffBracket(
    tournamentId: string,
    teams: TournamentRegistration[],
    config: PlayoffConfig
): Promise<TournamentMatch[]> {
    if (teams.length < 2) {
        throw new Error('Se necesitan al menos 2 equipos para playoffs')
    }

    const bestOf = parseInt(config.format.replace('BO', ''))
    const bracketSize = nextPowerOf2(teams.length)
    const roundCount = Math.log2(bracketSize)

    // For exactly 4 teams (2 groups with 2 qualifiers each), use direct crossover
    // Teams arrive in order: [1°A, 1°B, 2°B, 2°A]
    // Crossover: Semi1 = 1°A vs 2°B (indices 0,2), Semi2 = 1°B vs 2°A (indices 1,3)
    let slots: ParticipantSlot[]
    
    if (teams.length === 4 && config.crossoverMode === 'standard') {
        // Direct crossover for 4 teams from 2 groups
        // Order for matches: [1°A, 2°B, 1°B, 2°A] -> pairs become (1°A vs 2°B), (1°B vs 2°A)
        slots = [
            { id: teams[0].id, position: 1 }, // 1°A
            { id: teams[2].id, position: 2 }, // 2°B  -> Semi 1: 1°A vs 2°B
            { id: teams[1].id, position: 3 }, // 1°B
            { id: teams[3].id, position: 4 }, // 2°A  -> Semi 2: 1°B vs 2°A
        ]
        console.log(`[Playoffs] Using direct crossover for 4 teams: 1°A vs 2°B, 1°B vs 2°A`)
    } else {
        // Standard seeding with BYEs for other configurations
        slots = createSeededSlots(teams, bracketSize)
    }
    
    console.log(`[Playoffs] Generating bracket: ${teams.length} teams, size ${bracketSize}, ${bracketSize - teams.length} BYEs`)

    const getRoundName = (round: number, matchesInRound: number): string => {
        if (matchesInRound === 1) return 'FINAL'
        if (matchesInRound === 2) return 'SEMIFINAL'
        if (matchesInRound === 4) return 'CUARTOS'
        if (matchesInRound === 8) return 'OCTAVOS'
        return `RONDA ${round}`
    }

    let duels: Duel[] = makePairs(slots.map(s => s.id ? s : null))
    const matchesByRound: Map<number, string[]> = new Map()
    let matchNum = 1

    // Create all rounds
    for (let round = 1; round <= roundCount; round++) {
        const matchCount = bracketSize / Math.pow(2, round)
        const roundMatchIds: string[] = []

        if (round > 1) {
            duels = transitionToMajor(duels)
        }

        for (let i = 0; i < matchCount; i++) {
            const duel = duels[i]
            const p1 = duel[0]
            const p2 = duel[1]
            const isBye = p1 === null || p2 === null
            const status = isBye ? 'BYE' : 'PENDING'

            // Detect if this is the final match (last round with only 1 match)
            const isFinal = round === roundCount && matchCount === 1

            const match = await prisma.tournamentMatch.create({
                data: {
                    tournamentId,
                    round,
                    matchNumber: matchNum++,
                    bracket: isFinal ? 'GRAND_FINALS' : 'UPPER',
                    participant1Id: p1?.id || null,
                    participant2Id: p2?.id || null,
                    status,
                    isPlayoff: true,
                    bestOf,
                    roundText: getRoundName(round, matchCount)
                }
            })
            roundMatchIds.push(match.id)
        }

        matchesByRound.set(round, roundMatchIds)
    }

    // Link matches and handle BYEs
    for (let round = 1; round < roundCount; round++) {
        const currentRoundIds = matchesByRound.get(round)!
        const nextRoundIds = matchesByRound.get(round + 1)!

        for (let i = 0; i < currentRoundIds.length; i++) {
            const matchId = currentRoundIds[i]
            const nextMatchIdx = Math.floor(i / 2)
            const nextMatchId = nextRoundIds[nextMatchIdx]
            const isFirstInPair = i % 2 === 0

            await prisma.tournamentMatch.update({
                where: { id: matchId },
                data: { nextMatchId }
            })

            // Handle BYE
            const match = await prisma.tournamentMatch.findUnique({ where: { id: matchId } })
            if (match && match.status === 'BYE') {
                const winnerId = match.participant1Id || match.participant2Id
                if (winnerId) {
                    await prisma.tournamentMatch.update({
                        where: { id: matchId },
                        data: {
                            winnerId,
                            status: 'COMPLETED',
                            score1: match.participant1Id ? 1 : 0,
                            score2: match.participant2Id ? 1 : 0
                        }
                    })
                    await prisma.tournamentMatch.update({
                        where: { id: nextMatchId },
                        data: isFirstInPair
                            ? { participant1Id: winnerId }
                            : { participant2Id: winnerId }
                    })
                }
            }
        }
    }

    // Create third place match if configured and we have semifinals
    if (config.includeThirdPlace && teams.length >= 4) {
        const semiFinalIds = matchesByRound.get(roundCount - 1) // Semifinal round
        if (semiFinalIds && semiFinalIds.length === 2) {
            await prisma.tournamentMatch.create({
                data: {
                    tournamentId,
                    round: roundCount,
                    matchNumber: matchNum++,
                    bracket: 'LOWER',
                    status: 'PENDING',
                    isPlayoff: true,
                    bestOf,
                    roundText: '3° PUESTO'
                }
            })
        }
    }

    return prisma.tournamentMatch.findMany({
        where: {
            tournamentId,
            isPlayoff: true
        },
        orderBy: [
            { round: 'asc' },
            { matchNumber: 'asc' }
        ]
    })
}

/**
 * Create semifinals with crossover (legacy support for 4 teams)
 */
export async function createSemifinals(
    tournamentId: string,
    teams: TournamentRegistration[],
    bestOf: number,
    crossoverMode: 'standard' | 'custom'
): Promise<TournamentMatch[]> {
    if (teams.length !== 4) {
        throw new Error('Se necesitan exactamente 4 equipos para semifinales')
    }

    // Assume teams come in order:
    // [0] = 1° Grupo A
    // [1] = 2° Grupo A
    // [2] = 1° Grupo B
    // [3] = 2° Grupo B

    let matchups: Array<[TournamentRegistration, TournamentRegistration]>

    if (crossoverMode === 'standard') {
        // Standard crossover:
        // Semi 1: 1° Grupo A vs 2° Grupo B
        // Semi 2: 1° Grupo B vs 2° Grupo A
        matchups = [
            [teams[0], teams[3]], // 1A vs 2B
            [teams[2], teams[1]]  // 1B vs 2A
        ]
    } else {
        // Custom matchups (could be configured differently)
        matchups = [
            [teams[0], teams[1]],
            [teams[2], teams[3]]
        ]
    }

    const semis: TournamentMatch[] = []

    for (let i = 0; i < matchups.length; i++) {
        const [team1, team2] = matchups[i]
        const semi = await prisma.tournamentMatch.create({
            data: {
                tournamentId,
                participant1Id: team1.id,
                participant2Id: team2.id,
                round: 1, // Semifinal
                matchNumber: i + 1,
                bracket: 'UPPER',
                status: 'PENDING',
                isPlayoff: true,
                bestOf,
                roundText: `Semifinal ${i + 1}`
            }
        })
        semis.push(semi)
    }

    return semis
}

/**
 * Create finals match
 */
export async function createFinal(
    tournamentId: string,
    team1: TournamentRegistration,
    team2: TournamentRegistration,
    bestOf: number
): Promise<TournamentMatch> {
    return prisma.tournamentMatch.create({
        data: {
            tournamentId,
            participant1Id: team1.id,
            participant2Id: team2.id,
            round: 2, // Final
            matchNumber: 1,
            bracket: 'GRAND_FINALS',
            status: 'PENDING',
            isPlayoff: true,
            bestOf,
            roundText: 'FINAL'
        }
    })
}

/**
 * Create third place match
 */
export async function createThirdPlaceMatch(
    tournamentId: string,
    team1: TournamentRegistration,
    team2: TournamentRegistration,
    bestOf: number
): Promise<TournamentMatch> {
    return prisma.tournamentMatch.create({
        data: {
            tournamentId,
            participant1Id: team1.id,
            participant2Id: team2.id,
            round: 2, // Same round as final
            matchNumber: 2,
            bracket: 'LOWER',
            status: 'PENDING',
            isPlayoff: true,
            bestOf,
            roundText: '3° PUESTO'
        }
    })
}

/**
 * Update bracket progression after a match is completed
 * Creates next match when semifinal winner is determined
 */
export async function updateBracketProgression(
    matchId: string,
    winnerId: string
): Promise<void> {
    const match = await prisma.tournamentMatch.findUnique({
        where: { id: matchId },
        include: {
            tournament: true
        }
    })

    if (!match || !match.isPlayoff) {
        return
    }

    // Determine loser
    const loserId = match.participant1Id === winnerId 
        ? match.participant2Id 
        : match.participant1Id

    // Update match with winner
    await prisma.tournamentMatch.update({
        where: { id: matchId },
        data: {
            winnerId,
            status: 'COMPLETED',
            completedAt: new Date()
        }
    })

    // If this match has a nextMatchId, advance the winner
    if (match.nextMatchId) {
        const nextMatch = await prisma.tournamentMatch.findUnique({
            where: { id: match.nextMatchId }
        })

        if (nextMatch) {
            // Determine which slot to fill
            const isFirstSlot = match.matchNumber % 2 === 1
            await prisma.tournamentMatch.update({
                where: { id: match.nextMatchId },
                data: isFirstSlot
                    ? { participant1Id: winnerId }
                    : { participant2Id: winnerId }
            })
        }
    }

    // Handle third place match progression
    // Find if there's a third place match waiting for losers from semifinals
    const thirdPlaceMatch = await prisma.tournamentMatch.findFirst({
        where: {
            tournamentId: match.tournamentId,
            isPlayoff: true,
            roundText: '3° PUESTO',
            status: 'PENDING'
        }
    })

    if (thirdPlaceMatch && match.roundText?.includes('SEMIFINAL') && loserId) {
        // Add loser to third place match
        if (!thirdPlaceMatch.participant1Id) {
            await prisma.tournamentMatch.update({
                where: { id: thirdPlaceMatch.id },
                data: { participant1Id: loserId }
            })
        } else if (!thirdPlaceMatch.participant2Id) {
            await prisma.tournamentMatch.update({
                where: { id: thirdPlaceMatch.id },
                data: { participant2Id: loserId }
            })
        }
    }
}

/**
 * Helper: Get all playoff matches for a tournament
 */
export async function getPlayoffMatches(tournamentId: string): Promise<TournamentMatch[]> {
    return prisma.tournamentMatch.findMany({
        where: {
            tournamentId,
            isPlayoff: true
        },
        include: {
            participant1Reg: {
                include: {
                    clan: true,
                    player: true
                }
            },
            participant2Reg: {
                include: {
                    clan: true,
                    player: true
                }
            },
            winner: {
                include: {
                    clan: true,
                    player: true
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
    })
}

/**
 * Generate playoffs for CUSTOM_GROUP tournaments
 * Takes qualified teams from groups and creates a proper bracket
 */
export async function generateCustomGroupPlayoffs(
    tournamentId: string,
    qualifiedTeams: TournamentRegistration[],
    config: PlayoffConfig
): Promise<TournamentMatch[]> {
    // Delete existing playoff matches
    await prisma.tournamentMatch.deleteMany({
        where: {
            tournamentId,
            isPlayoff: true
        }
    })

    // Use the improved bracket generation
    return generatePlayoffBracket(tournamentId, qualifiedTeams, config)
}
