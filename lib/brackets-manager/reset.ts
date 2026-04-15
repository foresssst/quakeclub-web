/**
 * RESET module - Reset bracket state
 * Based on brackets-manager.js reset module
 */

import { prisma } from '@/lib/prisma'

/**
 * Resets all match results in a tournament
 */
export async function resetAllResults(tournamentId: string): Promise<void> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      matches: {
        orderBy: [
          { bracket: 'desc' }, // Start from finals, then lower, then upper
          { round: 'desc' },   // Latest rounds first
          { matchNumber: 'asc' },
        ],
      },
    },
  })

  if (!tournament) {
    throw new Error(`Tournament ${tournamentId} not found`)
  }

  // Reset all matches
  for (const match of tournament.matches) {
    const isBye = !match.participant1Id || !match.participant2Id

    await prisma.tournamentMatch.update({
      where: { id: match.id },
      data: {
        winnerId: null,
        score1: null,
        score2: null,
        status: isBye ? 'BYE' : 'PENDING',
      },
    })
  }

  // Clear participants from all matches except first round upper bracket
  const firstRoundParticipants = new Set<string>()

  for (const match of tournament.matches) {
    if (match.bracket === 'UPPER' && match.round === 1) {
      if (match.participant1Id) firstRoundParticipants.add(match.participant1Id)
      if (match.participant2Id) firstRoundParticipants.add(match.participant2Id)
    }
  }

  for (const match of tournament.matches) {
    // Skip first round upper bracket
    if (match.bracket === 'UPPER' && match.round === 1) continue

    await prisma.tournamentMatch.update({
      where: { id: match.id },
      data: {
        participant1Id: null,
        participant2Id: null,
        status: 'PENDING',
      },
    })
  }
}

/**
 * Resets matches from a specific round onwards
 */
export async function resetFromRound(
  tournamentId: string,
  bracket: 'UPPER' | 'LOWER' | 'FINALS',
  round: number
): Promise<void> {
  const matches = await prisma.tournamentMatch.findMany({
    where: {
      tournamentId,
      OR: [
        { bracket, round: { gte: round } },
        // If resetting upper bracket, also reset affected lower bracket matches
        ...(bracket === 'UPPER' ? [
          { bracket: 'LOWER' },
          { bracket: 'FINALS' },
        ] : []),
        // If resetting lower bracket, also reset finals
        ...(bracket === 'LOWER' ? [
          { bracket: 'FINALS' },
        ] : []),
      ],
    },
  })

  for (const match of matches) {
    // Determine if this should be a BYE match
    let shouldBeBye = false
    if (match.bracket === 'UPPER' && match.round === 1) {
      shouldBeBye = !match.participant1Id || !match.participant2Id
    }

    const shouldClearParticipants = !(match.bracket === 'UPPER' && match.round === 1)

    await prisma.tournamentMatch.update({
      where: { id: match.id },
      data: {
        winnerId: null,
        score1: null,
        score2: null,
        status: shouldBeBye ? 'BYE' : 'PENDING',
        ...(shouldClearParticipants ? {
          participant1Id: null,
          participant2Id: null,
        } : {}),
      },
    })
  }
}

/**
 * Resets seeding (participant assignments to first round)
 */
export async function resetSeeding(tournamentId: string): Promise<void> {
  const matches = await prisma.tournamentMatch.findMany({
    where: {
      tournamentId,
      bracket: 'UPPER',
      round: 1,
    },
  })

  for (const match of matches) {
    await prisma.tournamentMatch.update({
      where: { id: match.id },
      data: {
        participant1Id: null,
        participant2Id: null,
        winnerId: null,
        score1: null,
        score2: null,
        status: 'PENDING',
      },
    })
  }

  // Also clear all other matches
  await prisma.tournamentMatch.updateMany({
    where: {
      tournamentId,
      NOT: {
        bracket: 'UPPER',
        round: 1,
      },
    },
    data: {
      participant1Id: null,
      participant2Id: null,
      winnerId: null,
      score1: null,
      score2: null,
      status: 'PENDING',
    },
  })
}

/**
 * Resets only match results, keeping participant assignments
 */
export async function resetResults(tournamentId: string): Promise<void> {
  await prisma.tournamentMatch.updateMany({
    where: { tournamentId },
    data: {
      winnerId: null,
      score1: null,
      score2: null,
    },
  })

  // Update status for each match based on participants
  const matches = await prisma.tournamentMatch.findMany({
    where: { tournamentId },
  })

  for (const match of matches) {
    const isBye = !match.participant1Id || !match.participant2Id
    const status = isBye ? 'BYE' : 'PENDING'

    await prisma.tournamentMatch.update({
      where: { id: match.id },
      data: { status },
    })
  }
}

/**
 * Resets matches in a specific bracket
 */
export async function resetBracket(
  tournamentId: string,
  bracket: 'UPPER' | 'LOWER' | 'FINALS'
): Promise<void> {
  const matches = await prisma.tournamentMatch.findMany({
    where: {
      tournamentId,
      bracket,
    },
  })

  for (const match of matches) {
    // Only preserve participants in upper bracket round 1
    const preserveParticipants = bracket === 'UPPER' && match.round === 1
    const isBye = !match.participant1Id || !match.participant2Id

    await prisma.tournamentMatch.update({
      where: { id: match.id },
      data: {
        winnerId: null,
        score1: null,
        score2: null,
        status: isBye ? 'BYE' : 'PENDING',
        ...(preserveParticipants ? {} : {
          participant1Id: null,
          participant2Id: null,
        }),
      },
    })
  }
}
