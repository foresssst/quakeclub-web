import { prisma } from './prisma'
import { balanceByes, getNearestPowerOfTwo, getRoundName, getUpperBracketRoundCount } from './brackets-helpers'

export type TemplateBracket = 'UPPER' | 'LOWER' | 'FINALS'
export type SourceType = 'winner' | 'loser'

export interface MatchSourceRef {
  type: SourceType
  bracket: TemplateBracket
  round: number
  matchNumber: number
}

export interface TemplateSlot {
  id: string | null
  source?: MatchSourceRef
}

export type TemplateDuel = [TemplateSlot | null, TemplateSlot | null]

export interface MatchTemplate {
  bracket: TemplateBracket
  round: number
  matchNumber: number
  roundText: string
  duel: TemplateDuel
}

function matchKey(bracket: TemplateBracket, round: number, matchNumber: number): string {
  return `${bracket}:${round}:${matchNumber}`
}

function innerOuterSeeding<T>(array: T[]): T[] {
  if (array.length <= 2) return [...array]

  let positions = [1, 2]

  while (positions.length < array.length) {
    const size = positions.length * 2
    const next: number[] = []

    for (const position of positions) {
      next.push(position, size + 1 - position)
    }

    positions = next
  }

  return positions.map((position) => array[position - 1])
}

function createSeededSlots(registrationIds: string[]): (TemplateSlot | null)[] {
  const bracketSize = getNearestPowerOfTwo(registrationIds.length)
  const padded = [
    ...registrationIds,
    ...Array.from({ length: bracketSize - registrationIds.length }, () => null as string | null),
  ]

  const seeded = innerOuterSeeding(padded)
  const balanced = balanceByes(seeded, bracketSize)

  return balanced.map((id) => (id ? { id } : null))
}

function pairAndTrim(slots: (TemplateSlot | null)[]): TemplateDuel[] {
  const padded = [...slots]

  if (padded.length % 2 !== 0) {
    padded.push(null)
  }

  const duels: TemplateDuel[] = []

  for (let i = 0; i < padded.length; i += 2) {
    const duel: TemplateDuel = [padded[i] ?? null, padded[i + 1] ?? null]

    if (duel[0] === null && duel[1] === null) {
      continue
    }

    duels.push(duel)
  }

  return duels
}

function createTemplate(
  bracket: TemplateBracket,
  round: number,
  matchNumber: number,
  duel: TemplateDuel,
  roundText: string
): MatchTemplate {
  return {
    bracket,
    round,
    matchNumber,
    roundText,
    duel,
  }
}

function winnerSlotFromMatch(match: MatchTemplate): TemplateSlot | null {
  const [participant1, participant2] = match.duel
  const source: MatchSourceRef = {
    type: 'winner',
    bracket: match.bracket,
    round: match.round,
    matchNumber: match.matchNumber,
  }

  if (participant1 === null && participant2 === null) {
    return null
  }

  if (participant1 === null) {
    return { id: participant2?.id ?? null, source }
  }

  if (participant2 === null) {
    return { id: participant1?.id ?? null, source }
  }

  return { id: null, source }
}

function loserSlotFromUpperMatch(match: MatchTemplate): TemplateSlot | null {
  const [participant1, participant2] = match.duel

  if (participant1 === null || participant2 === null) {
    return null
  }

  return {
    id: null,
    source: {
      type: 'loser',
      bracket: match.bracket,
      round: match.round,
      matchNumber: match.matchNumber,
    },
  }
}

function makeMajorDuels(
  lowerWinners: (TemplateSlot | null)[],
  upperLosers: (TemplateSlot | null)[]
): TemplateDuel[] {
  const maxLength = Math.max(lowerWinners.length, upperLosers.length)
  const duels: TemplateDuel[] = []

  for (let index = 0; index < maxLength; index++) {
    const duel: TemplateDuel = [lowerWinners[index] ?? null, upperLosers[index] ?? null]

    if (duel[0] === null && duel[1] === null) {
      continue
    }

    duels.push(duel)
  }

  return duels
}

function buildUpperRounds(registrationIds: string[]): MatchTemplate[][] {
  const seededSlots = createSeededSlots(registrationIds)
  const roundCount = getUpperBracketRoundCount(seededSlots.length)
  const upperRounds: MatchTemplate[][] = []

  let currentDuels = pairAndTrim(seededSlots)

  for (let round = 1; round <= roundCount; round++) {
    const roundTemplates = currentDuels.map((duel, index) =>
      createTemplate('UPPER', round, index + 1, duel, getRoundName(round, roundCount, 'UPPER'))
    )

    upperRounds.push(roundTemplates)

    if (round < roundCount) {
      currentDuels = pairAndTrim(roundTemplates.map((match) => winnerSlotFromMatch(match)))
    }
  }

  return upperRounds
}

export function buildSingleEliminationTemplates(registrationIds: string[]): MatchTemplate[] {
  return buildUpperRounds(registrationIds).flat()
}

export function buildDoubleEliminationTemplates(registrationIds: string[]): MatchTemplate[] {
  const upperRounds = buildUpperRounds(registrationIds)
  const lowerRounds: MatchTemplate[][] = []

  if (upperRounds.length > 1) {
    const firstLowerDuels = pairAndTrim(upperRounds[0].map((match) => loserSlotFromUpperMatch(match)))

    if (firstLowerDuels.length > 0) {
      lowerRounds.push(
        firstLowerDuels.map((duel, index) =>
          createTemplate('LOWER', 1, index + 1, duel, 'LR1')
        )
      )
    }

    for (let upperRoundIndex = 1; upperRoundIndex < upperRounds.length; upperRoundIndex++) {
      const upperLosers = upperRounds[upperRoundIndex].map((match) => loserSlotFromUpperMatch(match))
      const previousLowerWinners = (lowerRounds.at(-1) ?? []).map((match) => winnerSlotFromMatch(match))

      const majorDuels = makeMajorDuels(previousLowerWinners, upperLosers)
      const majorRoundNumber = lowerRounds.length + 1

      if (majorDuels.length > 0) {
        lowerRounds.push(
          majorDuels.map((duel, index) =>
            createTemplate('LOWER', majorRoundNumber, index + 1, duel, `LR${majorRoundNumber}`)
          )
        )
      }

      const isLastUpperRound = upperRoundIndex === upperRounds.length - 1

      if (!isLastUpperRound) {
        const majorWinners = (lowerRounds.at(-1) ?? []).map((match) => winnerSlotFromMatch(match))
        const minorDuels = pairAndTrim([...majorWinners].reverse())
        const minorRoundNumber = lowerRounds.length + 1

        if (minorDuels.length > 0) {
          lowerRounds.push(
            minorDuels.map((duel, index) =>
              createTemplate('LOWER', minorRoundNumber, index + 1, duel, `LR${minorRoundNumber}`)
            )
          )
        }
      }
    }
  }

  const templates = [...upperRounds.flat(), ...lowerRounds.flat()]

  if (lowerRounds.length > 0) {
    const upperChampion = winnerSlotFromMatch(upperRounds.at(-1)![0])
    const lowerChampion = winnerSlotFromMatch(lowerRounds.at(-1)![0])

    templates.push(
      createTemplate('FINALS', 1, 1, [upperChampion, lowerChampion], 'GRAND FINAL')
    )
  }

  return templates
}

function isStructuralBye(duel: TemplateDuel): boolean {
  return (duel[0] === null) !== (duel[1] === null)
}

function knownByeWinnerId(duel: TemplateDuel): string | null {
  if (!isStructuralBye(duel)) {
    return null
  }

  return duel[0]?.id ?? duel[1]?.id ?? null
}

export async function persistBracketTemplates(
  tournamentId: string,
  templates: MatchTemplate[]
): Promise<void> {
  const createdMatchIds = new Map<string, string>()

  for (const template of templates) {
    const participant1Id = template.duel[0]?.id ?? null
    const participant2Id = template.duel[1]?.id ?? null
    const status = isStructuralBye(template.duel) ? 'BYE' : 'PENDING'
    const winnerId = knownByeWinnerId(template.duel)

    const match = await prisma.tournamentMatch.create({
      data: {
        tournamentId,
        round: template.round,
        matchNumber: template.matchNumber,
        bracket: template.bracket,
        participant1Id,
        participant2Id,
        winnerId,
        status,
        roundText: template.roundText,
        score1: winnerId && participant1Id === winnerId ? 1 : null,
        score2: winnerId && participant2Id === winnerId ? 1 : null,
      },
    })

    createdMatchIds.set(matchKey(template.bracket, template.round, template.matchNumber), match.id)
  }

  const linkUpdates = new Map<string, { nextMatchId?: string; nextLoserMatchId?: string }>()

  for (const template of templates) {
    const destinationMatchId = createdMatchIds.get(
      matchKey(template.bracket, template.round, template.matchNumber)
    )

    if (!destinationMatchId) continue

    for (const slot of template.duel) {
      if (!slot?.source) continue

      const sourceKey = matchKey(slot.source.bracket, slot.source.round, slot.source.matchNumber)
      const currentUpdate = linkUpdates.get(sourceKey) ?? {}

      if (slot.source.type === 'winner') {
        currentUpdate.nextMatchId = destinationMatchId
      } else {
        currentUpdate.nextLoserMatchId = destinationMatchId
      }

      linkUpdates.set(sourceKey, currentUpdate)
    }
  }

  for (const [sourceKey, data] of linkUpdates.entries()) {
    const sourceMatchId = createdMatchIds.get(sourceKey)

    if (!sourceMatchId) continue

    await prisma.tournamentMatch.update({
      where: { id: sourceMatchId },
      data,
    })
  }
}
