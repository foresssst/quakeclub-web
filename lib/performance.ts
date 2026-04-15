/**
 * Cálculo de Performance Score
 * Sistema de evaluación de rendimiento por jugador según tipo de juego
 */

export interface PlayerPerformanceStats {
  gameType: string;
  kills: number;
  deaths: number;
  score: number;
  damageDealt: number;
  damageTaken: number;
  win: boolean;
  aliveTime: number;
  matchDuration: number;
  quit?: boolean;
  timeRed?: number;
  timeBlue?: number;
  roundsRed?: number;
  roundsBlue?: number;
  totalRounds?: number;
  assists?: number; // MEDALS.ASSISTS
  captures?: number; // MEDALS.CAPTURES
}

// Calcula el performance score
// Retorna score normalizado ajustado por tiempo de participación
export function calculatePerformance(stats: PlayerPerformanceStats): number {
  const gt = stats.gameType.toLowerCase();

  // Factor de tiempo: normalizar por tiempo jugado
  // Para juegos round-based (CA/FT/AD): usa roundCount si está disponible
  // Para otros: usa playTimes si está disponible, sino usa PLAY_TIME como fallback
  // Máximo 5.0 para evitar valores extremos
  let timeFactor = 1.0;

  if (stats.totalRounds && (stats.roundsRed !== undefined || stats.roundsBlue !== undefined)) {
    const roundsPlayed = (stats.roundsRed || 0) + (stats.roundsBlue || 0);
    if (roundsPlayed > 0) {
      timeFactor = Math.min(5.0, stats.totalRounds / roundsPlayed);
    }
  } else if (stats.timeRed !== undefined && stats.timeBlue !== undefined) {
    const playTime = stats.timeRed + stats.timeBlue;
    if (playTime > 0 && stats.matchDuration > 0) {
      timeFactor = Math.min(5.0, stats.matchDuration / playTime);
    }
  } else {
    timeFactor = stats.matchDuration > 0 && stats.aliveTime > 0
      ? Math.min(5.0, stats.matchDuration / stats.aliveTime)
      : 1.0;
  }

  const p = {
    k: stats.kills,
    d: stats.deaths || 1,
    score: stats.score,
    dg: stats.damageDealt,
    dt: stats.damageTaken || 1,
    win: stats.win,
  };

  // CTF: damageRatio neutral (1.0) si no hay daño (posible AFK)
  if (gt === 'ctf') {
    let damageRatio = 1.0;
    if (p.dg === 0 && p.dt === 0) {
      damageRatio = 0.5; // AFK o sin participación: penalizar
    } else if (p.dt === 0) {
      damageRatio = Math.min(2, p.dg / 100); // Solo daño infligido, escalar
    } else {
      damageRatio = Math.min(2, Math.max(0.5, p.dg / p.dt));
    }
    return damageRatio * (p.score + p.dg / 20) * timeFactor;
  }

  // TDM
  if (gt === 'tdm') {
    return (
      (p.k - p.d) * 5 +
      (p.dg - p.dt) / 100 * 4 +
      p.dg / 100 * 3
    ) * timeFactor;
  }

  // CA (Clan Arena)
  // Usa damageDealt directamente en vez del score opaco de QL
  // score mezcla daño + kills + assists de forma inconsistente
  if (gt === 'ca') {
    return (p.dg / 100 + 0.5 * (p.k - p.d)) * timeFactor * (p.win ? 1.1 : 1.0);
  }

  // DUEL
  if (gt === 'duel') {
    if (stats.quit) return -1;
    return p.win ? 1 : 0;
  }

  // FT (Freeze Tag)
  if (gt === 'ft') {
    // Fórmula: (dg/100 + 0.5*(k-d) + 2*assists) * timeFactor
    const assists = stats.assists || 0;
    return (p.dg / 100 + 0.5 * (p.k - p.d) + 2 * assists) * timeFactor;
  }

  // AD (Attack/Defend)
  if (gt === 'ad') {
    // Fórmula: (dg/100 + k + captures) * timeFactor
    const captures = stats.captures || 0;
    return (p.dg / 100 + p.k + captures) * timeFactor;
  }

  // DOM (Domination)
  if (gt === 'dom') {
    return ((p.k - p.d) * 5 + (p.dg - p.dt) / 100 * 4 + p.dg / 100 * 3) * timeFactor;
  }

  // FFA y otros: usar damageDealt + K/D en vez de score opaco
  return (p.dg / 100 + (p.k - p.d) * 3) * timeFactor;
}

// Determina el resultado del match para un jugador basado en su performance
// vs otros jugadores (usado por Glicko-1)
export function determineMatchOutcome(
  playerSteamId: string,
  playerPerformance: number,
  allPerformances: Array<{ steamId: string; performance: number; team?: number }>,
  playerTeam?: number,
  gameType?: string
): number {
  const gt = gameType?.toLowerCase() || '';

  // Juegos por equipos (CA, CTF, TDM, FT, AD)
  if (playerTeam !== undefined && playerTeam > 0) {
    const teamPerformances = allPerformances.filter(p => p.team === playerTeam);
    const otherTeams = allPerformances.filter(p => p.team && p.team !== playerTeam && p.team > 0);

    if (otherTeams.length === 0) return 0.5;

    const myTeamScore = teamPerformances.reduce((sum, p) => sum + p.performance, 0);
    const otherTeamScore = otherTeams.reduce((sum, p) => sum + p.performance, 0) /
      (new Set(otherTeams.map(p => p.team)).size || 1);

    if (myTeamScore > otherTeamScore) return 1.0;
    if (myTeamScore < otherTeamScore) return 0.0;
    return 0.5;
  }

  // DUEL (1v1)
  if (gt === 'duel' && allPerformances.length === 2) {
    const opponent = allPerformances.find(p => p.steamId !== playerSteamId);
    if (!opponent) return 0.5;

    if (playerPerformance > opponent.performance) return 1.0;
    if (playerPerformance < opponent.performance) return 0.0;
    return 0.5;
  }

  // FFA (Free-For-All) - Puntuación proporcional por steamId
  const sorted = [...allPerformances].sort((a, b) => b.performance - a.performance);
  const position = sorted.findIndex(p => p.steamId === playerSteamId);
  const totalPlayers = sorted.length;

  if (totalPlayers === 1) return 0.5;
  if (position === 0) return 1.0;
  if (position === totalPlayers - 1) return 0.0;

  return (totalPlayers - position - 1) / (totalPlayers - 1);
}
