/**
 * DELETE module - Delete bracket data
 * Based on brackets-manager.js delete module
 */

import { prisma } from '@/lib/prisma'

/**
 * Deletes all matches for a tournament
 */
export async function deleteAllMatches(tournamentId: string): Promise<number> {
  const result = await prisma.tournamentMatch.deleteMany({
    where: { tournamentId },
  })

  return result.count
}

/**
 * Deletes matches in a specific bracket
 */
export async function deleteBracket(
  tournamentId: string,
  bracket: 'UPPER' | 'LOWER' | 'FINALS'
): Promise<number> {
  const result = await prisma.tournamentMatch.deleteMany({
    where: {
      tournamentId,
      bracket,
    },
  })

  return result.count
}

/**
 * Deletes matches from a specific round onwards
 */
export async function deleteFromRound(
  tournamentId: string,
  bracket: 'UPPER' | 'LOWER' | 'FINALS',
  round: number
): Promise<number> {
  const result = await prisma.tournamentMatch.deleteMany({
    where: {
      tournamentId,
      bracket,
      round: { gte: round },
    },
  })

  return result.count
}

/**
 * Deletes a specific match
 */
export async function deleteMatch(matchId: string): Promise<void> {
  // Check if match has dependent matches
  const match = await prisma.tournamentMatch.findUnique({
    where: { id: matchId },
  })

  if (!match) {
    throw new Error(`Match ${matchId} not found`)
  }

  // Check if any matches depend on this one
  const dependentMatches = await prisma.tournamentMatch.findMany({
    where: {
      tournamentId: match.tournamentId,
      OR: [
        { participant1Id: match.winnerId || undefined },
        { participant2Id: match.winnerId || undefined },
      ],
    },
  })

  if (dependentMatches.length > 0 && match.winnerId) {
    throw new Error('Cannot delete match: other matches depend on its result')
  }

  await prisma.tournamentMatch.delete({
    where: { id: matchId },
  })
}

/**
 * Deletes BYE matches from a tournament
 */
export async function deleteByeMatches(tournamentId: string): Promise<number> {
  const result = await prisma.tournamentMatch.deleteMany({
    where: {
      tournamentId,
      status: 'BYE',
    },
  })

  return result.count
}

/**
 * Deletes all pending matches (not started)
 */
export async function deletePendingMatches(tournamentId: string): Promise<number> {
  const result = await prisma.tournamentMatch.deleteMany({
    where: {
      tournamentId,
      status: 'PENDING',
      winnerId: null,
    },
  })

  return result.count
}

/**
 * Safely deletes a tournament and all related data
 */
export async function deleteTournament(tournamentId: string): Promise<void> {
  // Delete in order to avoid foreign key constraints
  await prisma.$transaction([
    // Delete match maps
    prisma.matchMap.deleteMany({
      where: {
        match: {
          tournamentId,
        },
      },
    }),

    // Delete matches
    prisma.tournamentMatch.deleteMany({
      where: { tournamentId },
    }),

    // Delete registrations
    prisma.tournamentRegistration.deleteMany({
      where: { tournamentId },
    }),

    // Delete the tournament
    prisma.tournament.delete({
      where: { id: tournamentId },
    }),
  ])
}
