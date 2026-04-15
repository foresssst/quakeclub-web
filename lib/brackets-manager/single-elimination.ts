/**
 * Single Elimination bracket generator
 */

import { prisma } from '../prisma'
import {
  buildSingleEliminationTemplates,
  persistBracketTemplates,
} from '../bracket-templates'

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array]

  for (let index = result.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[randomIndex]] = [result[randomIndex], result[index]]
  }

  return result
}

export async function generateSingleEliminationBracket(
  tournamentId: string,
  registrationIds: string[],
  shuffle: boolean = false
): Promise<void> {
  try {
    const seeding = shuffle ? shuffleArray(registrationIds) : [...registrationIds]
    const templates = buildSingleEliminationTemplates(seeding)

    await prisma.tournamentMatch.deleteMany({
      where: { tournamentId },
    })

    await persistBracketTemplates(tournamentId, templates)

    console.log(`✅ Single Elimination bracket generated: ${templates.length} matches`)
  } catch (error) {
    console.error('Error in generateSingleEliminationBracket:', error)
    throw error
  }
}
