/**
 * brackets-helpers.ts
 *
 * Helper functions ported from brackets-manager.js adapted for our Prisma schema.
 * Source: https://github.com/Drarig29/brackets-manager.js
 */

/**
 * A participant slot in a tournament bracket.
 * - `null` represents a BYE
 * - `{ id: null }` represents TBD (to be determined)
 * - `{ id: string }` represents an actual participant
 */
export type ParticipantSlot = { id: string | null; position?: number } | null

/**
 * A duel is two participants facing each other in a match.
 */
export type Duel = [ParticipantSlot, ParticipantSlot]

/**
 * Balances BYEs to prevent having BYE vs BYE matches.
 *
 * This distributes BYEs evenly so no match has two BYEs.
 *
 * @param seeding The seeding array (can contain nulls for BYEs)
 * @param participantCount Target number of slots (must be power of 2)
 * @returns Balanced seeding with BYEs distributed properly
 */
export function balanceByes(
  seeding: (string | null)[],
  participantCount?: number
): (string | null)[] {
  // EXACT algorithm from brackets-manager.js (helpers.ts lines 186-209)
  // Remove all nulls first
  const nonNullSeeding = seeding.filter((v) => v !== null)

  participantCount = participantCount || getNearestPowerOfTwo(nonNullSeeding.length)

  const nonNullCount = nonNullSeeding.length
  const nullCount = participantCount - nonNullCount

  if (nullCount === 0) {
    return nonNullSeeding
  }

  if (nonNullCount < participantCount / 2) {
    // If less than half participants, interleave with BYEs
    const flat = nonNullSeeding.flatMap((v) => [v, null])
    return setArraySize(flat, participantCount, null)
  }

  // For 6 teams in 8 slots:
  // - First 4 teams (6-2=4) play against each other: [T1,T2], [T3,T4]
  // - Last 2 teams (nullCount=2) get BYEs: [T5,null], [T6,null]
  // Result: [T1, T2, T3, T4, T5, null, T6, null]

  const teamsAgainstEachOther = nonNullSeeding
    .slice(0, nonNullCount - nullCount)
    .filter((_, i) => i % 2 === 0)
    .map((_, i) => [nonNullSeeding[2 * i], nonNullSeeding[2 * i + 1]])

  const teamsAgainstNull = nonNullSeeding
    .slice(nonNullCount - nullCount, nonNullCount)
    .map((v) => [v, null])

  const flat = [...teamsAgainstEachOther.flat(), ...teamsAgainstNull.flat()]

  return setArraySize(flat, participantCount, null)
}

/**
 * Returns the winner of a match that has BYEs.
 *
 * @param opponents The two opponents in a duel
 * @returns The winner, or null if double BYE, or {id: null} if normal match
 */
export function byeWinner(opponents: Duel): ParticipantSlot {
  if (opponents[0] === null && opponents[1] === null) {
    // Double BYE
    return null
  }

  if (opponents[0] === null && opponents[1] !== null) {
    // opponent1 is BYE, opponent2 wins
    return { id: opponents[1]!.id }
  }

  if (opponents[0] !== null && opponents[1] === null) {
    // opponent2 is BYE, opponent1 wins
    return { id: opponents[0]!.id }
  }

  // Normal match, no predetermined winner
  return { id: null }
}

/**
 * Returns the loser of a match for the lower bracket.
 *
 * If at least one opponent is a BYE, there's no loser to go to lower bracket.
 *
 * @param opponents The two opponents
 * @param index The index of this match in the round
 * @returns The loser slot or null if there's a BYE
 */
export function byeLoser(opponents: Duel, index: number): ParticipantSlot {
  if (opponents[0] === null || opponents[1] === null) {
    // At least one BYE, no loser goes to lower bracket
    return null
  }

  // Normal match, loser will be determined
  return { id: null, position: index + 1 }
}

/**
 * Creates pairs from an array of elements.
 *
 * @example [1, 2, 3, 4] => [[1, 2], [3, 4]]
 * @param array List of elements
 * @returns Array of pairs
 */
export function makePairs<T>(array: T[]): [T, T][] {
  return array
    .map((_, i) => (i % 2 === 0 ? [array[i], array[i + 1]] : []))
    .filter((v): v is [T, T] => v.length === 2)
}

/**
 * Gets the nearest power of two that is greater than or equal to the value.
 *
 * @param value The number
 * @returns The nearest power of two
 */
export function getNearestPowerOfTwo(value: number): number {
  return Math.pow(2, Math.ceil(Math.log2(value)))
}

/**
 * Checks if a number is a power of two.
 *
 * @param number The number to check
 * @returns True if it's a power of two
 */
export function isPowerOfTwo(number: number): boolean {
  return Number.isInteger(Math.log2(number))
}

/**
 * Sets the size of an array, padding with a specific value if needed.
 *
 * @param array The array to resize
 * @param size The target size
 * @param fillValue The value to use for padding
 * @returns The resized array
 */
export function setArraySize<T>(array: T[], size: number, fillValue: T): T[] {
  if (array.length >= size) {
    return array.slice(0, size)
  }

  const result = [...array]
  while (result.length < size) {
    result.push(fillValue)
  }
  return result
}

/**
 * Gets the number of rounds in the upper bracket.
 *
 * @param participantCount Number of participants
 * @returns Number of rounds
 */
export function getUpperBracketRoundCount(participantCount: number): number {
  return Math.log2(participantCount)
}

/**
 * Gets the number of round pairs in the lower bracket for double elimination.
 *
 * A round pair consists of a major round and a minor round.
 *
 * @param participantCount Number of participants
 * @returns Number of round pairs
 */
export function getRoundPairCount(participantCount: number): number {
  return Math.log2(participantCount) - 1
}

/**
 * Checks if double elimination is necessary for the given participant count.
 *
 * With only 2 participants, double elimination doesn't make sense.
 *
 * @param participantCount Number of participants
 * @returns True if double elimination bracket should be created
 */
export function isDoubleEliminationNecessary(participantCount: number): boolean {
  return participantCount > 2
}

/**
 * Gets a value from a standard bracket (winners bracket).
 *
 * This helps determine how many losers to expect from each round.
 *
 * @param roundIndex The index of the round (0-based)
 * @param roundCount Total number of rounds
 * @param participantCount Number of participants
 * @returns Number of matches/losers in that round
 */
export function getStandardBracketValue(
  roundIndex: number,
  roundCount: number,
  participantCount: number
): number {
  return Math.pow(2, roundCount - 1 - roundIndex)
}

/**
 * Creates round names for single/double elimination brackets.
 *
 * @param roundNumber The round number (1-based)
 * @param roundCount Total number of rounds
 * @param bracket Which bracket (UPPER/LOWER)
 * @returns A friendly name like "Quarter Finals", "Semi Finals", "Finals"
 */
export function getRoundName(
  roundNumber: number,
  roundCount: number,
  bracket: 'UPPER' | 'LOWER'
): string {
  const roundsFromEnd = roundCount - roundNumber + 1

  if (bracket === 'LOWER') {
    return `LR${roundNumber}`
  }

  // Upper bracket naming
  if (roundsFromEnd === 1) return 'Finals'
  if (roundsFromEnd === 2) return 'Semi Finals'
  if (roundsFromEnd === 3) return 'Quarter Finals'
  if (roundsFromEnd === 4) return 'Round of 16'
  if (roundsFromEnd === 5) return 'Round of 32'

  return `Round ${roundNumber}`
}

/**
 * Determines if a match is a BYE match.
 *
 * @param participant1Id First participant ID (can be null)
 * @param participant2Id Second participant ID (can be null)
 * @returns True if at least one participant is null (BYE)
 */
export function isByeMatch(
  participant1Id: string | null | undefined,
  participant2Id: string | null | undefined
): boolean {
  return participant1Id === null || participant2Id === null
}

/**
 * Validates that the participant count is valid for elimination brackets.
 *
 * @param participantCount Number of participants
 * @throws Error if invalid
 */
export function validateEliminationParticipantCount(participantCount: number): void {
  if (participantCount < 2) {
    throw new Error('At least 2 participants are required')
  }

  if (!isPowerOfTwo(participantCount)) {
    throw new Error('Participant count must be a power of two (2, 4, 8, 16, 32, etc.)')
  }
}
