/**
 * Implementación del Algoritmo Glicko-1 para QuakeClub
 *
 * Glicko-1 es un sistema de rating desarrollado por Mark Glickman.
 * Mejora sobre ELO al incluir Rating Deviation (RD) que mide la
 * incertidumbre del rating de un jugador.
 *
 * PARÁMETROS:
 * - Rating inicial: 900 (personalizado para QuakeClub)
 * - RD inicial: 350 (alta incertidumbre)
 * - RD mínimo: 30 (jugadores activos)
 * - Rating mínimo: 100 (floor)
 * - Máximo cambio por partida: 150
 *
 * FÓRMULAS CLAVE:
 * - g(RD) = 1 / sqrt(1 + 3*q^2*RD^2/π^2)
 * - E(s) = 1 / (1 + 10^(-g(RD)*diff/400))
 * - d^2 = 1 / (q^2 * sum(g^2 * E * (1-E)))
 * - Nuevo rating = r + q/(1/RD^2 + 1/d^2) * sum(g*(s-E))
 */

const q = Math.log(10) / 400; // ~0.0057565
const MIN_RD = 30;
const MIN_RATING = 100; // Mínimo ELO absoluto (no negativos)
const DEFAULT_RATING = 900;
const DEFAULT_RD = 350;
const MAX_CHANGE = 150; // Máximo cambio de ELO por partida (como QLStats)

// Factor de decay para RD (converge de 350 a 30 en 720 días)
const C = Math.sqrt((Math.pow(350, 2) - Math.pow(30, 2)) / 720);

export interface Glicko1Rating {
  rating: number;   // Rating visible (ej: 1200)
  rd: number;       // Rating Deviation (ej: 50)
  period: number;   // Último período jugado
  games: number;    // Total de partidas
}

export interface Glicko1Opponent {
  rating: number;
  rd: number;
}

export interface Glicko1Match {
  opponent: Glicko1Opponent;
  outcome: number; // 1.0 = victoria, 0.5 = empate, 0.0 = derrota
}

/**
 * Crea un jugador nuevo con valores por defecto
 */
export function createGlicko1Player(
  rating?: number,
  rd?: number,
  period?: number
): Glicko1Rating {
  return {
    rating: rating ?? DEFAULT_RATING,
    rd: rd ?? DEFAULT_RD,
    period: period ?? 0,
    games: 0,
  };
}

/**
 * Función g(RD) - Factor de reducción por incertidumbre del oponente
 * Cuanto mayor el RD del oponente, menos confianza en su rating
 */
function g(rd: number): number {
  return 1 / Math.sqrt(1 + 3 * Math.pow(q * rd / Math.PI, 2));
}

/**
 * Función E - Resultado esperado
 * Probabilidad de que el jugador gane contra el oponente
 */
function E(playerRating: number, opponentRating: number, opponentRd: number): number {
  return 1 / (1 + Math.pow(10, -1 * g(opponentRd) * (playerRating - opponentRating) / 400));
}

/**
 * Calcula la varianza d² basada en los oponentes
 */
function calculateDeviation(
  playerRating: number,
  opponents: { rating: number; rd: number; outcome: number }[]
): number {
  if (opponents.length === 0) {
    return 1e10; // Máxima incertidumbre
  }

  let sum = 0;
  for (const opp of opponents) {
    const gVal = g(opp.rd);
    const eVal = E(playerRating, opp.rating, opp.rd);
    sum += Math.pow(gVal, 2) * eVal * (1 - eVal);
  }

  if (sum <= 0 || !isFinite(sum)) {
    return 1e10;
  }

  return 1 / (Math.pow(q, 2) * sum);
}

/**
 * Aplica decay de RD por inactividad
 * RD aumenta con el tiempo para reflejar incertidumbre
 */
export function applyRdDecay(rd: number, periodsInactive: number): number {
  if (periodsInactive === 0) return rd;

  const newRd = Math.sqrt(Math.pow(rd, 2) + Math.pow(C, 2) * periodsInactive);
  return Math.min(newRd, DEFAULT_RD);
}

/**
 * Asegura que rating y RD estén dentro de límites válidos
 */
function ensureBounds(rating: number, rd: number): { rating: number; rd: number } {
  return {
    rating: Math.max(MIN_RATING, rating),
    rd: Math.max(MIN_RD, Math.min(DEFAULT_RD, rd))
  };
}

/**
 * Actualiza el rating usando Glicko-1
 *
 * @param player Rating actual del jugador
 * @param matches Lista de partidos jugados
 * @param currentPeriod Período actual (días desde epoch)
 * @returns Nuevo rating actualizado
 */
export function updateGlicko1Rating(
  player: Glicko1Rating,
  matches: Glicko1Match[],
  currentPeriod: number
): Glicko1Rating {
  // Sin partidos = solo aplicar decay de RD
  if (matches.length === 0) {
    const periodsInactive = Math.max(0, currentPeriod - player.period);
    const newRd = applyRdDecay(player.rd, periodsInactive);

    return {
      ...player,
      rd: newRd,
      period: currentPeriod,
    };
  }

  // Aplicar decay por inactividad primero
  let rd = player.rd;
  if (player.period > 0 && currentPeriod > player.period) {
    const periodsInactive = currentPeriod - player.period;
    rd = applyRdDecay(player.rd, periodsInactive);
  }

  const rating = player.rating;

  // Convertir matches a formato interno
  const opponents = matches.map(m => ({
    rating: m.opponent.rating,
    rd: m.opponent.rd,
    outcome: m.outcome,
  }));

  // Paso 1: Calcular d² (varianza)
  const d2 = calculateDeviation(rating, opponents);

  // Paso 2: Calcular suma de ajuste
  let tempSum = 0;
  for (const opp of opponents) {
    const gVal = g(opp.rd);
    const eVal = E(rating, opp.rating, opp.rd);
    tempSum += gVal * (opp.outcome - eVal);
  }

  // Paso 3: Calcular factor b
  const b = 1 / (1 / Math.pow(rd, 2) + 1 / d2);

  // CAP de cambio máximo (Ajustado a 150 para QuakeClub: servidor nuevo requiere nivelación más rápida)
  // XonStat usa 75, pero en una población nueva (todos 900) necesitamos más movilidad.
  const MAX_CHANGE = 150;
  let diff = q * b * tempSum;
  diff = diff < 0 ? Math.max(-MAX_CHANGE, diff) : Math.min(MAX_CHANGE, diff);

  // Paso 5: Actualizar rating y RD
  const newRating = rating + diff;
  const newRd = Math.sqrt(b);

  // Asegurar límites
  const bounded = ensureBounds(newRating, newRd);

  return {
    rating: bounded.rating,
    rd: bounded.rd,
    period: currentPeriod,
    games: player.games + matches.length,
  };
}

/**
 * Calcula probabilidad de victoria entre dos jugadores
 */
export function winProbability(
  playerRating: number,
  playerRd: number,
  opponentRating: number,
  opponentRd: number
): number {
  return E(playerRating, opponentRating, opponentRd);
}

/**
 * Calcula período de rating (días desde epoch)
 */
export function getRatingPeriod(date?: Date): number {
  const d = date || new Date();
  return Math.floor(d.getTime() / (1000 * 60 * 60 * 24));
}

/**
 * Estima el cambio de rating para una victoria/derrota
 * Útil para mostrar predicciones al usuario
 */
export function estimateRatingChange(
  playerRating: number,
  playerRd: number,
  opponentRating: number,
  opponentRd: number,
  outcome: number // 1 = win, 0 = loss, 0.5 = draw
): number {
  const gVal = g(opponentRd);
  const eVal = E(playerRating, opponentRating, opponentRd);
  const d2 = 1 / (Math.pow(q, 2) * Math.pow(gVal, 2) * eVal * (1 - eVal));
  const b = 1 / (1 / Math.pow(playerRd, 2) + 1 / d2);
  return q * b * gVal * (outcome - eVal);
}

/**
 * Constantes exportadas para uso externo
 */
export const Glicko1Constants = {
  q,
  MIN_RD,
  MIN_RATING,
  DEFAULT_RATING,
  DEFAULT_RD,
  MAX_CHANGE,
  C,
};
