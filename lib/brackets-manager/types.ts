/**
 * Shared types for brackets-manager module
 */

import { TournamentMatch, TournamentRegistration } from '@prisma/client'

export type MatchStatus = 'PENDING' | 'BYE' | 'COMPLETED' | 'WALKOVER'
export type Bracket = 'UPPER' | 'LOWER' | 'FINALS'

/**
 * Match result for updating a match
 */
export interface MatchResult {
  winnerId: string
  score1?: number | null
  score2?: number | null
  forfeit?: boolean
}

/**
 * Match with related data
 */
export interface MatchWithParticipants extends TournamentMatch {
  participant1Reg: (TournamentRegistration & { clan: { tag: string; name: string } }) | null
  participant2Reg: (TournamentRegistration & { clan: { tag: string; name: string } }) | null
}

/**
 * Seeding information
 */
export interface Seeding {
  registrationId: string
  position: number
  clanTag: string
  clanName: string
}

/**
 * Final standings
 */
export interface Standings {
  position: number
  registrationId: string
  clanTag: string
  clanName: string
  wins: number
  losses: number
}

/**
 * Next match information
 */
export interface NextMatch {
  matchId: string
  bracket: Bracket
  round: number
  matchNumber: number
  roundText: string
}

/**
 * Participant's current position in bracket
 */
export interface ParticipantStatus {
  registrationId: string
  eliminated: boolean
  currentBracket: Bracket | null
  nextMatchId: string | null
  matchesWon: number
  matchesLost: number
}
