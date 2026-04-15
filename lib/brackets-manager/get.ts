/**
 * GET module - Query operations for bracket state
 * Based on brackets-manager.js get module
 */

import { prisma } from '@/lib/prisma'
import { Seeding, Standings, ParticipantStatus, NextMatch, Bracket } from './types'

/**
 * Gets the seeding order for a tournament
 */
export async function getSeeding(tournamentId: string): Promise<Seeding[]> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      registrations: {
        where: { status: 'APPROVED' },
        include: {
          clan: {
            select: {
              tag: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
      matches: {
        where: {
          bracket: 'UPPER',
          round: 1,
        },
        orderBy: {
          matchNumber: 'asc',
        },
      },
    },
  })

  if (!tournament) {
    throw new Error(`Tournament ${tournamentId} not found`)
  }

  const seeding: Seeding[] = []
  let position = 1

  // Build seeding from first round matches
  for (const match of tournament.matches) {
    if (match.participant1Id) {
      const reg = tournament.registrations.find(r => r.id === match.participant1Id)
      if (reg) {
        seeding.push({
          registrationId: reg.id,
          position: position++,
          clanTag: reg.clan.tag,
          clanName: reg.clan.name,
        })
      }
    }
    if (match.participant2Id) {
      const reg = tournament.registrations.find(r => r.id === match.participant2Id)
      if (reg) {
        seeding.push({
          registrationId: reg.id,
          position: position++,
          clanTag: reg.clan.tag,
          clanName: reg.clan.name,
        })
      }
    }
  }

  return seeding
}

/**
 * Gets final standings for a completed tournament
 */
export async function getFinalStandings(tournamentId: string): Promise<Standings[]> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      registrations: {
        where: { status: 'APPROVED' },
        include: {
          clan: {
            select: {
              tag: true,
              name: true,
            },
          },
        },
      },
      matches: {
        orderBy: [
          { bracket: 'asc' },
          { round: 'desc' },
          { matchNumber: 'asc' },
        ],
      },
    },
  })

  if (!tournament) {
    throw new Error(`Tournament ${tournamentId} not found`)
  }

  const standings: Standings[] = []

  // Get champion (grand final winner)
  const grandFinal = tournament.matches.find(m => m.bracket === 'FINALS')
  if (grandFinal?.winnerId) {
    const champion = tournament.registrations.find(r => r.id === grandFinal.winnerId)
    if (champion) {
      const stats = getParticipantStats(tournament.matches, champion.id)
      standings.push({
        position: 1,
        registrationId: champion.id,
        clanTag: champion.clan.tag,
        clanName: champion.clan.name,
        wins: stats.wins,
        losses: stats.losses,
      })
    }
  }

  // Get runner-up (grand final loser)
  if (grandFinal?.winnerId && (grandFinal.participant1Id || grandFinal.participant2Id)) {
    const runnerUpId = grandFinal.winnerId === grandFinal.participant1Id
      ? grandFinal.participant2Id
      : grandFinal.participant1Id
    if (runnerUpId) {
      const runnerUp = tournament.registrations.find(r => r.id === runnerUpId)
      if (runnerUp) {
        const stats = getParticipantStats(tournament.matches, runnerUp.id)
        standings.push({
          position: 2,
          registrationId: runnerUp.id,
          clanTag: runnerUp.clan.tag,
          clanName: runnerUp.clan.name,
          wins: stats.wins,
          losses: stats.losses,
        })
      }
    }
  }

  // Get 3rd place (lower bracket finals loser)
  const lowerBracketFinals = tournament.matches
    .filter(m => m.bracket === 'LOWER')
    .sort((a, b) => b.round - a.round)[0]

  if (lowerBracketFinals?.winnerId &&
      (lowerBracketFinals.participant1Id || lowerBracketFinals.participant2Id)) {
    const thirdPlaceId = lowerBracketFinals.winnerId === lowerBracketFinals.participant1Id
      ? lowerBracketFinals.participant2Id
      : lowerBracketFinals.participant1Id
    if (thirdPlaceId) {
      const thirdPlace = tournament.registrations.find(r => r.id === thirdPlaceId)
      if (thirdPlace) {
        const stats = getParticipantStats(tournament.matches, thirdPlace.id)
        standings.push({
          position: 3,
          registrationId: thirdPlace.id,
          clanTag: thirdPlace.clan.tag,
          clanName: thirdPlace.clan.name,
          wins: stats.wins,
          losses: stats.losses,
        })
      }
    }
  }

  // Get remaining participants sorted by when they were eliminated
  const accountedIds = new Set(standings.map(s => s.registrationId))
  let position = 4

  // Sort remaining by number of wins (descending), then losses (ascending)
  const remaining = tournament.registrations
    .filter(r => !accountedIds.has(r.id))
    .map(r => {
      const stats = getParticipantStats(tournament.matches, r.id)
      return {
        registrationId: r.id,
        clanTag: r.clan.tag,
        clanName: r.clan.name,
        wins: stats.wins,
        losses: stats.losses,
      }
    })
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins
      return a.losses - b.losses
    })

  for (const participant of remaining) {
    standings.push({
      position: position++,
      ...participant,
    })
  }

  return standings
}

/**
 * Gets statistics for a participant
 */
function getParticipantStats(
  matches: any[],
  participantId: string
): { wins: number; losses: number } {
  let wins = 0
  let losses = 0

  for (const match of matches) {
    if (match.status !== 'COMPLETED' && match.status !== 'WALKOVER') continue

    const isParticipant1 = match.participant1Id === participantId
    const isParticipant2 = match.participant2Id === participantId

    if (!isParticipant1 && !isParticipant2) continue

    if (match.winnerId === participantId) {
      wins++
    } else if (match.winnerId) {
      losses++
    }
  }

  return { wins, losses }
}

/**
 * Gets the next matches for a tournament
 */
export async function getNextMatches(tournamentId: string): Promise<NextMatch[]> {
  const matches = await prisma.tournamentMatch.findMany({
    where: {
      tournamentId,
      status: 'PENDING',
      participant1Id: { not: null },
      participant2Id: { not: null },
    },
    orderBy: [
      { bracket: 'asc' },
      { round: 'asc' },
      { matchNumber: 'asc' },
    ],
    select: {
      id: true,
      bracket: true,
      round: true,
      matchNumber: true,
      roundText: true,
    },
  })

  return matches.map(m => ({
    matchId: m.id,
    bracket: m.bracket as Bracket,
    round: m.round,
    matchNumber: m.matchNumber,
    roundText: m.roundText || '',
  }))
}

/**
 * Gets participant status in the bracket
 */
export async function getParticipantStatus(
  tournamentId: string,
  registrationId: string
): Promise<ParticipantStatus> {
  const matches = await prisma.tournamentMatch.findMany({
    where: {
      tournamentId,
      OR: [
        { participant1Id: registrationId },
        { participant2Id: registrationId },
      ],
    },
    orderBy: [
      { bracket: 'asc' },
      { round: 'desc' },
    ],
  })

  let matchesWon = 0
  let matchesLost = 0
  let eliminated = false
  let currentBracket: Bracket | null = null
  let nextMatchId: string | null = null

  for (const match of matches) {
    const isWinner = match.winnerId === registrationId
    const isInMatch = match.participant1Id === registrationId || match.participant2Id === registrationId

    if (!isInMatch) continue

    if (match.status === 'COMPLETED' || match.status === 'WALKOVER') {
      if (isWinner) {
        matchesWon++
      } else if (match.winnerId) {
        matchesLost++
      }
    }

    // Check if participant has a pending match
    if (match.status === 'PENDING' && match.participant1Id && match.participant2Id) {
      currentBracket = match.bracket as Bracket
      nextMatchId = match.id
    }
  }

  // Check if eliminated (lost in lower bracket or grand finals)
  const lastMatch = matches.find(m =>
    (m.participant1Id === registrationId || m.participant2Id === registrationId) &&
    (m.status === 'COMPLETED' || m.status === 'WALKOVER') &&
    m.winnerId !== registrationId
  )

  if (lastMatch) {
    // If lost in lower bracket or grand finals, eliminated
    if (lastMatch.bracket === 'LOWER' || lastMatch.bracket === 'FINALS') {
      eliminated = true
      currentBracket = null
      nextMatchId = null
    }
  }

  return {
    registrationId,
    eliminated,
    currentBracket,
    nextMatchId,
    matchesWon,
    matchesLost,
  }
}
