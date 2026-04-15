/**
 * Brackets Manager - Complete tournament bracket management system
 * Based on brackets-manager.js library
 *
 * This is a complete implementation of tournament bracket management including:
 * - CREATE: Generate Double Elimination and Single Elimination brackets
 * - UPDATE: Update match results, handle forfeits
 * - GET: Query bracket state, seeding, standings
 * - FIND: Find specific matches and participants
 * - RESET: Reset bracket state
 * - DELETE: Remove bracket data
 */

// Import all modules
import { generateDoubleEliminationBracketV2 } from '../brackets-generator-v2'
import { generateSingleEliminationBracket } from './single-elimination'
import {
  updateMatchResult,
  resetMatchResult,
  forfeitMatch,
} from './update'
import {
  getSeeding,
  getFinalStandings,
  getNextMatches,
  getParticipantStatus,
} from './get'
import {
  findMatch,
  findMatchesForParticipant,
  findNextMatchForParticipant,
  findOpponent,
  findMatchesInBracket,
  findMatchesInRound,
  findPendingMatches,
  findCompletedMatches,
} from './find'
import {
  resetAllResults,
  resetFromRound,
  resetSeeding,
  resetResults,
  resetBracket,
} from './reset'
import {
  deleteAllMatches,
  deleteBracket,
  deleteFromRound,
  deleteMatch,
  deleteByeMatches,
  deletePendingMatches,
  deleteTournament,
} from './delete'

// Re-export all functions
export { generateDoubleEliminationBracketV2 }
export { generateSingleEliminationBracket }
export {
  updateMatchResult,
  resetMatchResult,
  forfeitMatch,
}
export {
  getSeeding,
  getFinalStandings,
  getNextMatches,
  getParticipantStatus,
}
export {
  findMatch,
  findMatchesForParticipant,
  findNextMatchForParticipant,
  findOpponent,
  findMatchesInBracket,
  findMatchesInRound,
  findPendingMatches,
  findCompletedMatches,
}
export {
  resetAllResults,
  resetFromRound,
  resetSeeding,
  resetResults,
  resetBracket,
}
export {
  deleteAllMatches,
  deleteBracket,
  deleteFromRound,
  deleteMatch,
  deleteByeMatches,
  deletePendingMatches,
  deleteTournament,
}

// Types
export type {
  MatchStatus,
  Bracket,
  MatchResult,
  MatchWithParticipants,
  Seeding,
  Standings,
  NextMatch,
  ParticipantStatus,
} from './types'

/**
 * Main BracketsManager class
 *
 * Usage:
 * ```typescript
 * import { BracketsManager } from '@/lib/brackets-manager'
 *
 * // Create bracket
 * await BracketsManager.create.doubleElimination(tournamentId, registrationIds)
 *
 * // Update match result
 * await BracketsManager.update.matchResult(matchId, { winnerId, score1, score2 })
 *
 * // Get standings
 * const standings = await BracketsManager.get.finalStandings(tournamentId)
 *
 * // Find matches
 * const match = await BracketsManager.find.match(tournamentId, 'UPPER', 1, 1)
 *
 * // Reset bracket
 * await BracketsManager.reset.allResults(tournamentId)
 *
 * // Delete bracket
 * await BracketsManager.delete.allMatches(tournamentId)
 * ```
 */
export const BracketsManager = {
  create: {
    doubleElimination: generateDoubleEliminationBracketV2,
    singleElimination: generateSingleEliminationBracket,
  },

  update: {
    matchResult: updateMatchResult,
    resetMatchResult,
    forfeitMatch,
  },

  get: {
    seeding: getSeeding,
    finalStandings: getFinalStandings,
    nextMatches: getNextMatches,
    participantStatus: getParticipantStatus,
  },

  find: {
    match: findMatch,
    matchesForParticipant: findMatchesForParticipant,
    nextMatchForParticipant: findNextMatchForParticipant,
    opponent: findOpponent,
    matchesInBracket: findMatchesInBracket,
    matchesInRound: findMatchesInRound,
    pendingMatches: findPendingMatches,
    completedMatches: findCompletedMatches,
  },

  reset: {
    allResults: resetAllResults,
    fromRound: resetFromRound,
    seeding: resetSeeding,
    results: resetResults,
    bracket: resetBracket,
  },

  delete: {
    allMatches: deleteAllMatches,
    bracket: deleteBracket,
    fromRound: deleteFromRound,
    match: deleteMatch,
    byeMatches: deleteByeMatches,
    pendingMatches: deletePendingMatches,
    tournament: deleteTournament,
  },
} as const
