/**
 * Pick/Ban sequence definitions for tournament map veto.
 *
 * Each step has:
 *   - team: "a" (higher seed / participant1) or "b" (lower seed / participant2)
 *   - action: "ban" or "pick"
 *
 * The last map remaining after all bans/picks is the "decider".
 * Pool size must be >= total steps + remaining picked maps + 1 decider.
 *
 * Standard Quake formats:
 *   BO1 (7 map pool): ban-ban-ban-ban-ban-ban → decider
 *   BO3 (7 map pool): ban-ban-pick-pick-ban-ban → decider
 *   BO5 (7 map pool): ban-ban-pick-pick-pick-pick → decider
 */

export interface PickBanStep {
  team: "a" | "b"
  action: "ban" | "pick"
}

export interface PickBanFormat {
  id: string
  name: string
  description: string
  poolSize: number     // recommended map pool size
  totalMaps: number    // maps that will be played (picked + decider)
  steps: PickBanStep[]
}

export const PICKBAN_FORMATS: Record<string, PickBanFormat> = {
  bo1: {
    id: "bo1",
    name: "Best of 1",
    description: "6 bans alternados, último mapa = decider",
    poolSize: 7,
    totalMaps: 1,
    steps: [
      { team: "a", action: "ban" },
      { team: "b", action: "ban" },
      { team: "a", action: "ban" },
      { team: "b", action: "ban" },
      { team: "a", action: "ban" },
      { team: "b", action: "ban" },
      // remaining 1 map = decider
    ],
  },
  bo3: {
    id: "bo3",
    name: "Best of 3",
    description: "Ban-Ban-Pick-Pick-Ban-Ban, último mapa = decider",
    poolSize: 7,
    totalMaps: 3,
    steps: [
      { team: "a", action: "ban" },
      { team: "b", action: "ban" },
      { team: "a", action: "pick" },
      { team: "b", action: "pick" },
      { team: "a", action: "ban" },
      { team: "b", action: "ban" },
      // remaining 1 map = decider
    ],
  },
  bo5: {
    id: "bo5",
    name: "Best of 5",
    description: "Ban-Ban, luego 4 picks alternados, último mapa = decider",
    poolSize: 7,
    totalMaps: 5,
    steps: [
      { team: "a", action: "ban" },
      { team: "b", action: "ban" },
      { team: "a", action: "pick" },
      { team: "b", action: "pick" },
      { team: "a", action: "pick" },
      { team: "b", action: "pick" },
      // remaining 1 map = decider
    ],
  },
}

/**
 * Given completed actions and the pool, compute the current state.
 */
export function computePickBanState(
  pool: string[],
  actions: { step: number; action: string; mapName: string; teamId: string }[],
  format: PickBanFormat,
  participant1Id: string,
  participant2Id: string
) {
  const banned: { mapName: string; teamId: string; step: number }[] = []
  const picked: { mapName: string; teamId: string; step: number }[] = []
  const availableMaps = new Set(pool)

  // Process completed actions
  for (const a of actions.sort((x, y) => x.step - y.step)) {
    if (a.action === "ban") {
      banned.push({ mapName: a.mapName, teamId: a.teamId, step: a.step })
    } else {
      picked.push({ mapName: a.mapName, teamId: a.teamId, step: a.step })
    }
    availableMaps.delete(a.mapName)
  }

  const currentStep = actions.length
  const isCompleted = currentStep >= format.steps.length

  // Determine decider if all steps are done
  let decider: string | null = null
  if (isCompleted && availableMaps.size === 1) {
    decider = [...availableMaps][0]
  }

  // Determine whose turn it is
  let currentTeamId: string | null = null
  let currentAction: "ban" | "pick" | null = null
  if (!isCompleted && currentStep < format.steps.length) {
    const step = format.steps[currentStep]
    currentTeamId = step.team === "a" ? participant1Id : participant2Id
    currentAction = step.action
  }

  // Build map order for the match (picked maps in order, then decider)
  const mapOrder: string[] = picked.map(p => p.mapName)
  if (decider) mapOrder.push(decider)

  return {
    banned,
    picked,
    decider,
    availableMaps: [...availableMaps],
    currentStep,
    currentTeamId,
    currentAction,
    isCompleted,
    mapOrder,
  }
}
