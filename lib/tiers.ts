/**
 * Sistema de Tiers basado en ELO
 * 8 niveles: Gran Maestro + Elite + Tier 1-6
 * Rangos uniformes para todos los game types
 */

export type TierLevel = "gran_maestro" | "elite" | 1 | 2 | 3 | 4 | 5 | 6
export type GameType = "ca" | "duel" | "tdm" | "ctf" | "ffa" | "ft" | "ad" | "dom" | string

export interface TierInfo {
  level: TierLevel
  name: string
  minElo: number
  maxElo: number
  image: string
}

type TierRanges = {
  [key in TierLevel]: { minElo: number; maxElo: number }
}

/**
 * Rangos de ELO uniformes para todos los game types
 */
const TIER_RANGES: TierRanges = {
  gran_maestro: { minElo: 2400, maxElo: 9999 },
  elite: { minElo: 2200, maxElo: 2399 },
  1: { minElo: 2000, maxElo: 2199 },
  2: { minElo: 1850, maxElo: 1999 },
  3: { minElo: 1700, maxElo: 1849 },
  4: { minElo: 1550, maxElo: 1699 },
  5: { minElo: 1400, maxElo: 1549 },
  6: { minElo: 0, maxElo: 1399 },
}

/**
 * Configuración base de los tiers (imágenes y nombres)
 */
const TIER_BASE: Record<TierLevel, { name: string; image: string }> = {
  gran_maestro: { name: "Gran Maestro", image: "/tiers/tier_gran_maestro.png" },
  elite: { name: "Elite", image: "/tiers/tier_elite.png" },
  1: { name: "Tier 1", image: "/tiers/tier_1.png" },
  2: { name: "Tier 2", image: "/tiers/tier_2.png" },
  3: { name: "Tier 3", image: "/tiers/tier_3.png" },
  4: { name: "Tier 4", image: "/tiers/tier_4.png" },
  5: { name: "Tier 5", image: "/tiers/tier_5.png" },
  6: { name: "Tier 6", image: "/tiers/tier_6.png" },
}

/**
 * Orden de tiers de mejor a peor
 */
const TIER_ORDER: TierLevel[] = ["gran_maestro", "elite", 1, 2, 3, 4, 5, 6]

/**
 * Genera la configuración completa de tiers
 */
export function getTierConfig(_gameType?: string): Record<TierLevel, TierInfo> {
  return {
    gran_maestro: { level: "gran_maestro", ...TIER_BASE["gran_maestro"], ...TIER_RANGES["gran_maestro"] },
    elite: { level: "elite", ...TIER_BASE["elite"], ...TIER_RANGES["elite"] },
    1: { level: 1, ...TIER_BASE[1], ...TIER_RANGES[1] },
    2: { level: 2, ...TIER_BASE[2], ...TIER_RANGES[2] },
    3: { level: 3, ...TIER_BASE[3], ...TIER_RANGES[3] },
    4: { level: 4, ...TIER_BASE[4], ...TIER_RANGES[4] },
    5: { level: 5, ...TIER_BASE[5], ...TIER_RANGES[5] },
    6: { level: 6, ...TIER_BASE[6], ...TIER_RANGES[6] },
  }
}

/**
 * Configuración por defecto
 */
export const TIER_CONFIG = getTierConfig()

/**
 * Calcula el tier basado en el ELO del jugador
 */
export function getTierFromElo(elo: number, _gameType?: string): TierLevel {
  if (elo >= TIER_RANGES["gran_maestro"].minElo) return "gran_maestro"
  if (elo >= TIER_RANGES["elite"].minElo) return "elite"
  if (elo >= TIER_RANGES[1].minElo) return 1
  if (elo >= TIER_RANGES[2].minElo) return 2
  if (elo >= TIER_RANGES[3].minElo) return 3
  if (elo >= TIER_RANGES[4].minElo) return 4
  if (elo >= TIER_RANGES[5].minElo) return 5
  return 6
}

/**
 * Obtiene la información completa del tier
 */
export function getTierInfo(elo: number, gameType?: string): TierInfo {
  const level = getTierFromElo(elo, gameType)
  const config = getTierConfig(gameType)
  return config[level]
}

/**
 * Obtiene la ruta de la imagen del tier
 */
export function getTierImage(elo: number, gameType?: string): string {
  const tier = getTierFromElo(elo, gameType)
  return TIER_BASE[tier].image
}

/**
 * Calcula cuántos puntos faltan para el siguiente tier
 * Retorna null si ya está en Gran Maestro
 */
export function getEloToNextTier(elo: number, gameType?: string): number | null {
  const tier = getTierFromElo(elo, gameType)
  if (tier === "gran_maestro") return null

  const config = getTierConfig(gameType)
  const tierIdx = TIER_ORDER.indexOf(tier)
  const nextTier = TIER_ORDER[tierIdx - 1]
  return config[nextTier].minElo - elo
}

/**
 * Obtiene el nombre del siguiente tier
 * Retorna null si ya está en Gran Maestro
 */
export function getNextTierName(elo: number, gameType?: string): string | null {
  const tier = getTierFromElo(elo, gameType)
  if (tier === "gran_maestro") return null

  const tierIdx = TIER_ORDER.indexOf(tier)
  const nextTier = TIER_ORDER[tierIdx - 1]
  return TIER_BASE[nextTier].name
}

/**
 * Obtiene el progreso dentro del tier actual (0-100%)
 */
export function getTierProgress(elo: number, gameType?: string): number {
  const tier = getTierFromElo(elo, gameType)
  const config = getTierConfig(gameType)
  const tierInfo = config[tier]

  // Gran Maestro no tiene límite superior práctico
  if (tier === "gran_maestro") {
    const excess = elo - tierInfo.minElo
    return Math.min(100, (excess / 200) * 100)
  }

  const range = (tierInfo.maxElo + 1) - tierInfo.minElo
  const progress = elo - tierInfo.minElo
  return Math.round((progress / range) * 100)
}
