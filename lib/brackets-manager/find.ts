/**
 * FIND module - Find specific matches and participants
 * Based on brackets-manager.js find module
 */

import { prisma } from '@/lib/prisma'
import { MatchWithParticipants, Bracket } from './types'

/**
 * Finds a match by bracket position
 */
export async function findMatch(
  tournamentId: string,
  bracket: Bracket,
  round: number,
  matchNumber: number
): Promise<MatchWithParticipants | null> {
  const match = await prisma.tournamentMatch.findFirst({
    where: {
      tournamentId,
      bracket,
      round,
      matchNumber,
    },
    include: {
      participant1Reg: {
        include: {
          clan: {
            select: {
              tag: true,
              name: true,
            },
          },
        },
      },
      participant2Reg: {
        include: {
          clan: {
            select: {
              tag: true,
              name: true,
            },
          },
        },
      },
    },
  })

  return match as MatchWithParticipants | null
}

/**
 * Finds all matches for a specific participant
 */
export async function findMatchesForParticipant(
  tournamentId: string,
  registrationId: string
): Promise<MatchWithParticipants[]> {
  const matches = await prisma.tournamentMatch.findMany({
    where: {
      tournamentId,
      OR: [
        { participant1Id: registrationId },
        { participant2Id: registrationId },
      ],
    },
    include: {
      participant1Reg: {
        include: {
          clan: {
            select: {
              tag: true,
              name: true,
            },
          },
        },
      },
      participant2Reg: {
        include: {
          clan: {
            select: {
              tag: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: [
      { bracket: 'asc' },
      { round: 'asc' },
      { matchNumber: 'asc' },
    ],
  })

  return matches as MatchWithParticipants[]
}

/**
 * Finds the next match for a participant
 */
export async function findNextMatchForParticipant(
  tournamentId: string,
  registrationId: string
): Promise<MatchWithParticipants | null> {
  const match = await prisma.tournamentMatch.findFirst({
    where: {
      tournamentId,
      OR: [
        { participant1Id: registrationId },
        { participant2Id: registrationId },
      ],
      status: 'PENDING',
      participant1Id: { not: null },
      participant2Id: { not: null },
    },
    include: {
      participant1Reg: {
        include: {
          clan: {
            select: {
              tag: true,
              name: true,
            },
          },
        },
      },
      participant2Reg: {
        include: {
          clan: {
            select: {
              tag: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: [
      { bracket: 'asc' },
      { round: 'asc' },
      { matchNumber: 'asc' },
    ],
  })

  return match as MatchWithParticipants | null
}

/**
 * Finds opponent for a participant in a specific match
 */
export async function findOpponent(
  matchId: string,
  registrationId: string
): Promise<string | null> {
  const match = await prisma.tournamentMatch.findUnique({
    where: { id: matchId },
  })

  if (!match) return null

  if (match.participant1Id === registrationId) {
    return match.participant2Id
  }
  if (match.participant2Id === registrationId) {
    return match.participant1Id
  }

  return null
}

/**
 * Finds all matches in a specific bracket
 */
export async function findMatchesInBracket(
  tournamentId: string,
  bracket: Bracket
): Promise<MatchWithParticipants[]> {
  const matches = await prisma.tournamentMatch.findMany({
    where: {
      tournamentId,
      bracket,
    },
    include: {
      participant1Reg: {
        include: {
          clan: {
            select: {
              tag: true,
              name: true,
            },
          },
        },
      },
      participant2Reg: {
        include: {
          clan: {
            select: {
              tag: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: [
      { round: 'asc' },
      { matchNumber: 'asc' },
    ],
  })

  return matches as MatchWithParticipants[]
}

/**
 * Finds all matches in a specific round
 */
export async function findMatchesInRound(
  tournamentId: string,
  bracket: Bracket,
  round: number
): Promise<MatchWithParticipants[]> {
  const matches = await prisma.tournamentMatch.findMany({
    where: {
      tournamentId,
      bracket,
      round,
    },
    include: {
      participant1Reg: {
        include: {
          clan: {
            select: {
              tag: true,
              name: true,
            },
          },
        },
      },
      participant2Reg: {
        include: {
          clan: {
            select: {
              tag: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      matchNumber: 'asc',
    },
  })

  return matches as MatchWithParticipants[]
}

/**
 * Finds pending matches (ready to be played)
 */
export async function findPendingMatches(
  tournamentId: string
): Promise<MatchWithParticipants[]> {
  const matches = await prisma.tournamentMatch.findMany({
    where: {
      tournamentId,
      status: 'PENDING',
      participant1Id: { not: null },
      participant2Id: { not: null },
    },
    include: {
      participant1Reg: {
        include: {
          clan: {
            select: {
              tag: true,
              name: true,
            },
          },
        },
      },
      participant2Reg: {
        include: {
          clan: {
            select: {
              tag: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: [
      { bracket: 'asc' },
      { round: 'asc' },
      { matchNumber: 'asc' },
    ],
  })

  return matches as MatchWithParticipants[]
}

/**
 * Finds completed matches
 */
export async function findCompletedMatches(
  tournamentId: string
): Promise<MatchWithParticipants[]> {
  const matches = await prisma.tournamentMatch.findMany({
    where: {
      tournamentId,
      status: {
        in: ['COMPLETED', 'WALKOVER'],
      },
    },
    include: {
      participant1Reg: {
        include: {
          clan: {
            select: {
              tag: true,
              name: true,
            },
          },
        },
      },
      participant2Reg: {
        include: {
          clan: {
            select: {
              tag: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: [
      { bracket: 'asc' },
      { round: 'asc' },
      { matchNumber: 'asc' },
    ],
  })

  return matches as MatchWithParticipants[]
}
