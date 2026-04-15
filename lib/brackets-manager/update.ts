/**
 * UPDATE module - Handles match result updates and forfeit handling
 * Based on brackets-manager.js update module
 */

import { prisma } from '../prisma'
import { MatchResult, MatchStatus } from './types'

/**
 * Updates a match result and advances winners/losers to next matches
 */
export async function updateMatchResult(
  matchId: string,
  result: MatchResult
): Promise<void> {
  const match = await prisma.tournamentMatch.findUnique({
    where: { id: matchId },
  })

  if (!match) {
    throw new Error(`Match ${matchId} not found`)
  }

  // Validate participants exist
  if (!match.participant1Id || !match.participant2Id) {
    throw new Error('Cannot update result: match does not have both participants')
  }

  // Validate winner is one of the participants
  if (result.winnerId !== match.participant1Id && result.winnerId !== match.participant2Id) {
    throw new Error('Winner must be one of the match participants')
  }

  const loserId = result.winnerId === match.participant1Id
    ? match.participant2Id
    : match.participant1Id

  const newStatus: MatchStatus = result.forfeit ? 'WALKOVER' : 'COMPLETED'

  // Update the match
  await prisma.tournamentMatch.update({
    where: { id: matchId },
    data: {
      winnerId: result.winnerId,
      score1: result.score1,
      score2: result.score2,
      status: newStatus,
    },
  })

  // Advance winner to next match
  if (match.nextMatchId) {
    await advanceParticipant(match.nextMatchId, result.winnerId)
  }

  // Advance loser to lower bracket (if applicable)
  if (match.nextLoserMatchId && loserId) {
    await advanceParticipant(match.nextLoserMatchId, loserId)
  }
}

/**
 * Advances a participant to the next match
 */
async function advanceParticipant(
  nextMatchId: string,
  participantId: string
): Promise<void> {
  const nextMatch = await prisma.tournamentMatch.findUnique({
    where: { id: nextMatchId },
  })

  if (!nextMatch) {
    throw new Error(`Next match ${nextMatchId} not found`)
  }

  if (nextMatch.participant1Id === participantId || nextMatch.participant2Id === participantId) {
    if (nextMatch.status === 'BYE') {
      await resolveByeMatch(nextMatch.id)
    }
    return
  }

  // Place participant in the first empty slot
  if (!nextMatch.participant1Id) {
    await prisma.tournamentMatch.update({
      where: { id: nextMatchId },
      data: {
        participant1Id: participantId,
        status: nextMatch.participant2Id ? 'PENDING' : nextMatch.status,
      },
    })
  } else if (!nextMatch.participant2Id) {
    await prisma.tournamentMatch.update({
      where: { id: nextMatchId },
      data: {
        participant2Id: participantId,
        // Now both participants are filled, set to PENDING
        status: 'PENDING',
      },
    })
  } else {
    // Both slots filled - this shouldn't happen in a properly structured bracket
    console.warn(`Match ${nextMatchId} already has both participants`)
    return
  }

  if (nextMatch.status === 'BYE') {
    await resolveByeMatch(nextMatchId)
  }
}

async function resolveByeMatch(matchId: string): Promise<void> {
  const match = await prisma.tournamentMatch.findUnique({
    where: { id: matchId },
  })

  if (!match || match.status !== 'BYE') {
    return
  }

  const winnerId = match.participant1Id || match.participant2Id

  if (!winnerId) {
    return
  }

  if (match.winnerId !== winnerId) {
    await prisma.tournamentMatch.update({
      where: { id: matchId },
      data: {
        winnerId,
        score1: match.participant1Id === winnerId ? 1 : 0,
        score2: match.participant2Id === winnerId ? 1 : 0,
      },
    })
  }

  if (match.nextMatchId) {
    await advanceParticipant(match.nextMatchId, winnerId)
  }
}

/**
 * Resets a match result (clears winner and scores)
 */
export async function resetMatchResult(matchId: string): Promise<void> {
  const match = await prisma.tournamentMatch.findUnique({
    where: { id: matchId },
    include: {
      tournament: {
        include: {
          matches: true,
        },
      },
    },
  })

  if (!match) {
    throw new Error(`Match ${matchId} not found`)
  }

  // Check if any dependent matches have results
  if (match.nextMatchId) {
    const nextMatch = match.tournament.matches.find((m: (typeof match.tournament.matches)[number]) => m.id === match.nextMatchId)
    if (nextMatch?.winnerId) {
      throw new Error('Cannot reset: next match has already been completed')
    }
  }

  if (match.nextLoserMatchId) {
    const nextLoserMatch = match.tournament.matches.find((m: (typeof match.tournament.matches)[number]) => m.id === match.nextLoserMatchId)
    if (nextLoserMatch?.winnerId) {
      throw new Error('Cannot reset: next loser match has already been completed')
    }
  }

  // Clear the result
  const isBye = !match.participant1Id || !match.participant2Id
  await prisma.tournamentMatch.update({
    where: { id: matchId },
    data: {
      winnerId: null,
      score1: null,
      score2: null,
      status: isBye ? 'BYE' : 'PENDING',
    },
  })

  // Remove this participant from next matches
  if (match.winnerId && match.nextMatchId) {
    await removeParticipantFromMatch(match.nextMatchId, match.winnerId)
  }

  if (match.winnerId && match.nextLoserMatchId) {
    const loserId = match.winnerId === match.participant1Id
      ? match.participant2Id
      : match.participant1Id
    if (loserId) {
      await removeParticipantFromMatch(match.nextLoserMatchId, loserId)
    }
  }
}

/**
 * Removes a participant from a match
 */
async function removeParticipantFromMatch(
  matchId: string,
  participantId: string
): Promise<void> {
  const match = await prisma.tournamentMatch.findUnique({
    where: { id: matchId },
  })

  if (!match) return

  const updates: any = {}
  let removed = false

  if (match.participant1Id === participantId) {
    updates.participant1Id = null
    removed = true
  }
  if (match.participant2Id === participantId) {
    updates.participant2Id = null
    removed = true
  }

  if (!removed) {
    return
  }

  // Update status if needed
  const willHaveBothParticipants =
    (match.participant1Id && match.participant1Id !== participantId) &&
    (match.participant2Id && match.participant2Id !== participantId)

  const willHaveOneParticipant =
    (match.participant1Id && match.participant1Id !== participantId) ||
    (match.participant2Id && match.participant2Id !== participantId)

  updates.winnerId = null
  updates.score1 = null
  updates.score2 = null

  if (match.status === 'BYE') {
    updates.status = 'BYE'
  } else if (!willHaveOneParticipant) {
    updates.status = 'PENDING'
  } else if (!willHaveBothParticipants) {
    updates.status = 'BYE'
  }

  await prisma.tournamentMatch.update({
    where: { id: matchId },
    data: updates,
  })

  if (match.status === 'BYE' && match.nextMatchId) {
    await removeParticipantFromMatch(match.nextMatchId, participantId)
  }
}

/**
 * Marks a match as forfeit by a specific participant
 */
export async function forfeitMatch(
  matchId: string,
  forfeitingParticipantId: string
): Promise<void> {
  const match = await prisma.tournamentMatch.findUnique({
    where: { id: matchId },
  })

  if (!match) {
    throw new Error(`Match ${matchId} not found`)
  }

  if (!match.participant1Id || !match.participant2Id) {
    throw new Error('Cannot forfeit: match does not have both participants')
  }

  if (forfeitingParticipantId !== match.participant1Id &&
      forfeitingParticipantId !== match.participant2Id) {
    throw new Error('Forfeiting participant must be in the match')
  }

  // Winner is the other participant
  const winnerId = forfeitingParticipantId === match.participant1Id
    ? match.participant2Id
    : match.participant1Id

  await updateMatchResult(matchId, {
    winnerId,
    forfeit: true,
  })
}
