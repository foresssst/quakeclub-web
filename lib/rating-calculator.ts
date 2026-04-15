/**
 * Sistema de Cálculo de Calificaciones - QuakeClub
 *
 * Implementación del algoritmo Glicko-1 para rating de jugadores en Quake Live.
 * Portado de XonStat para mayor compatibilidad y estabilidad.
 *
 * ALGORITMO:
 * - Basado en Glicko-1 (Mark Glickman)
 * - Compatible con XonStat (mismo algoritmo base)
 * - NO tiene volatilidad (σ) - más simple y predecible
 * - Incluye Rating Deviation (RD) que representa la incertidumbre del rating
 * - SIN CAP de cambio de rating (a diferencia de XonStat que usa 75)
 *
 * PARÁMETROS CLAVE:
 * - Rating inicial: 900 (vs 100 en ELO/XonStat original)
 * - RD inicial: 350
 * - RD mínimo: 30
 * - Floor (mínimo): 300
 * - Participación mínima: 50% del tiempo del partido
 * - Tiempo mínimo absoluto: definido por validación de partido
 *
 * SISTEMA W-L-D (Wins-Losses-Draws):
 * - W (Wins): Victoria en el partido
 * - L (Losses): Derrota en el partido
 * - D (Draws): Partida NO VÁLIDA por baja participación
 *   - En Quake NO hay empates técnicos (siempre hay ganador/perdedor)
 *   - D cuenta partidas donde el jugador no alcanzó tiempo mínimo de participación
 *   - Ejemplo: Jugó solo 1 minuto en partido de 10 minutos -> NO cuenta para rating (D++)
 *
 * VALIDACIONES POR TIPO DE JUEGO:
 * - Duel: >= 10 minutos (o forfeited)
 * - FFA: >= 50 frags limit
 * - CA: >= 8 rondas o 5 de diferencia
 * - TDM: >= 100 frags, 30 de diferencia, o 15 minutos
 * - CTF: >= 5 caps, 5 de diferencia, o 15 minutos
 *
 * DETECCIÓN AFK:
 * - Daño infligido <= 100 -> AFK
 * - Ratio daño recibido/daño infligido >= 10.0 -> AFK
 * - Jugadores AFK no afectan ratings
 *
 * COMPATIBILIDAD XONSTAT:
 * - Usa Glicko-1 igual que XonStat
 * - Factories válidos coinciden con XonStat (duel, ca, tdm, ctf, ffa, ad, ft)
 * - Parámetros K-reduction compatibles (fulltime=600, mintime=120, minratio=0.5)
 */


import {
  updateGlicko1Rating,
  createGlicko1Player,
  applyRdDecay,
  getRatingPeriod,
  type Glicko1Rating,
  type Glicko1Match,
  Glicko1Constants
} from './glicko1';
import {
  calculatePerformance,
  determineMatchOutcome,
  type PlayerPerformanceStats
} from './performance';
import {
  applyRatingImprovements,
  calculateMarginOfVictory,
  type RatingContext
} from './rating-improvements';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';

// ============================================
// SISTEMA DE QUIT ACUMULATIVO
// ============================================
const QUIT_THRESHOLD = 5;        // Quits para activar penalización
const QUIT_WINDOW_DAYS = 7;      // Ventana rolling de 7 días
const QUIT_PENALTY_AMOUNT = 150; // Penalización en puntos de ELO

/**
 * Registra un quit y verifica si se alcanzó el umbral de penalización.
 * Retorna el monto de penalización si corresponde (0 si no).
 */
async function recordQuitAndCheckPenalty(
  steamId: string,
  matchId: string | undefined,
  gameType: string
): Promise<{ penalty: number; quitCount: number }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + QUIT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Registrar el quit
  await prisma.quitRecord.create({
    data: {
      steamId,
      matchId: matchId || null,
      gameType,
      expiresAt,
    },
  });

  // Contar quits activos (no expirados) en la ventana
  const activeQuits = await prisma.quitRecord.count({
    where: {
      steamId,
      expiresAt: { gt: now },
    },
  });

  console.log(`[Quit] ${steamId}: ${activeQuits} quits en últimos ${QUIT_WINDOW_DAYS} días (umbral: ${QUIT_THRESHOLD})`);

  // Si alcanzó el umbral, aplicar penalización y resetear contador
  if (activeQuits >= QUIT_THRESHOLD) {
    // Marcar los quits como penalizados
    await prisma.quitRecord.updateMany({
      where: {
        steamId,
        expiresAt: { gt: now },
        penaltyApplied: false,
      },
      data: {
        penaltyApplied: true,
        penaltyAmount: QUIT_PENALTY_AMOUNT,
      },
    });

    // Resetear contador: eliminar todos los quits activos para que vuelva a 0
    // El jugador necesita acumular 5 quits nuevos para otra penalización
    await prisma.quitRecord.deleteMany({
      where: {
        steamId,
        expiresAt: { gt: now },
      },
    });

    console.log(`[Quit] ⚠️ ${steamId}: PENALIZACIÓN ACTIVADA - ${activeQuits} quits alcanzados → -${QUIT_PENALTY_AMOUNT} ELO (contador reseteado)`);
    return { penalty: QUIT_PENALTY_AMOUNT, quitCount: 0 };
  }

  return { penalty: 0, quitCount: activeQuits };
}

/**
 * Aplica la penalización de -150 ELO directamente al PlayerRating.
 * También actualiza PlayerMatchStats si existe.
 */
async function applyQuitAccumulationPenalty(
  steamId: string,
  gameType: string,
  penalty: number,
  quitCount: number,
  matchStatsId?: string,
  serverType?: string,
  seasonId?: string | null,
): Promise<void> {
  const isLadder = serverType === 'competitive';
  const isSeason = isLadder && seasonId;

  if (isSeason) {
    const seasonRating = await prisma.seasonRating.findFirst({
      where: { steamId, gameType, seasonId },
    });
    if (seasonRating) {
      const newRating = Math.max(100, seasonRating.rating - penalty);
      await prisma.seasonRating.update({
        where: { id: seasonRating.id },
        data: { rating: newRating },
      });
      console.log(`[Quit] 🏆 ${steamId}: SeasonRating ${seasonRating.rating.toFixed(0)} → ${newRating.toFixed(0)} (-${penalty})`);
    }
  } else {
    const ratingType = isLadder ? 'ladder' : 'public';
    const playerRating = await prisma.playerRating.findFirst({
      where: { steamId, gameType, ratingType },
    });
    if (playerRating) {
      const newRating = Math.max(100, playerRating.rating - penalty);
      await prisma.playerRating.update({
        where: { id: playerRating.id },
        data: { rating: newRating, updatedAt: new Date() },
      });
      console.log(`[Quit] ${steamId}: PlayerRating ${playerRating.rating.toFixed(0)} → ${newRating.toFixed(0)} (-${penalty})`);

      // Actualizar PlayerMatchStats para que se vea en match details
      if (matchStatsId) {
        const currentStats = await prisma.playerMatchStats.findUnique({
          where: { id: matchStatsId },
        });
        if (currentStats) {
          const currentDelta = currentStats.eloDelta || 0;
          const newDelta = currentDelta - penalty;

          // Merge con adjustments existentes para el tooltip del match details
          let existingAdjustments: { type: string; reason: string }[] = [];
          let originalChange = currentDelta;
          if (currentStats.statusMessage) {
            try {
              const parsed = JSON.parse(currentStats.statusMessage);
              existingAdjustments = parsed.adjustments || [];
              originalChange = parsed.originalChange ?? currentDelta;
            } catch { /* no-op */ }
          }

          existingAdjustments.push({
            type: 'Quit Acumulado',
            reason: `${quitCount} quits en ${QUIT_WINDOW_DAYS} días → -${penalty} ELO`,
          });

          const statusData = {
            adjustments: existingAdjustments,
            originalChange,
          };

          await prisma.playerMatchStats.update({
            where: { id: matchStatsId },
            data: {
              eloBefore: currentStats.eloBefore ?? Math.round(playerRating.rating),
              eloAfter: Math.round(newRating),
              eloDelta: newDelta,
              statusMessage: JSON.stringify(statusData),
            },
          });
        }
      }
    }
  }
}

interface MatchPlayer {
  steamId: string;
  kills: number;
  deaths: number;
  score: number;
  team?: number;
  aliveTime?: number;
  damageDealt?: number;
  damageTaken?: number;
  quit?: boolean;
  matchId?: string;
}

interface MatchContext {
  matchId: string;
  gameType: string;
  matchDuration?: number;
  matchDate?: Date; // Fecha real del match (para recálculos históricos)
  mapName?: string; // Mapa jugado (para rating por mapa)
}

// Contexto de liga para partidas competitivas
interface LadderContext {
  serverType: string;  // "public" | "competitive"
  seasonId: string | null;
  isOfficial: boolean;
}

// Rating inicial para liga: siempre 1500 para todos los modos
const LADDER_DEFAULT_RATING = 1500;
// RD inicial para modos nuevos: siempre DEFAULT_RD (350), independiente por modo

// Game types con base 1500 (en vez de 900)
const HIGH_BASE_GAME_TYPES = ['duel', 'ctf', 'ffa', 'tdm', 'ad', 'ft', 'dom'];
const HIGH_BASE_DEFAULT_RATING = 1500;

/**
 * Obtiene el rating inicial según el tipo de juego
 * - CA: base 900
 * - DUEL, CTF, FFA, TDM, AD, FT, DOM: base 1500
 */
function getDefaultRatingForGameType(gameType: string): number {
  const gt = gameType.toLowerCase();
  if (HIGH_BASE_GAME_TYPES.includes(gt)) {
    return HIGH_BASE_DEFAULT_RATING;
  }
  return Glicko1Constants.DEFAULT_RATING; // 900 para CA y otros
}

// Mínimo de jugadores requeridos por tipo de juego
const MIN_PLAYERS_BY_MODE: Record<string, number> = {
  duel: 2,
  ffa: 4,
  ca: 6, // 3v3 mínimo - 2v2 no calcula ELO
  tdm: 4,
  ctf: 6,
  ad: 6,
  ft: 6,
  dom: 4,
};

// Factories permitidos por tipo de juego (XonStat compatible)
const VALID_FACTORIES: Record<string, string[]> = {
  duel: ['duel', 'qcon_duel'],
  ffa: ['ffa', 'mg_ffa_classic'],
  ca: ['ca', 'capickup', 'hoq_ca', 'mg_ca_classic', 'mg_ca_pql', 'wipeout', 'wo'],
  tdm: ['ctdm', 'qcon_tdm', 'mg_tdm_fullclassic', 'tdm_classic', 'hoq_tdm', 'ftdm'],
  ctf: ['ctf', 'ctf2', 'qcon_ctf', 'hoq_ctf'],
  ad: ['ad'],
  ft: ['freeze', 'cftag', 'ft', 'ftclassic', 'ft_classic', 'mg_ft_fullclassic', 'vft', 'ft_competitive'],
};

/**
 * IsDrawForGametype - Determina si dos puntajes son empate
 * a y b son puntajes de rendimiento ajustados por tiempo de participación
 */
function isDraw(a: number, b: number, gameType: string, matchStats?: any): boolean {
  const gt = gameType.toLowerCase();

  if (gt === 'duel') {
    return false;
  }

  if (gt === 'ffa') {
    const fragLimit = matchStats?.FRAG_LIMIT || 50;
    return Math.abs(a - b) <= 2 * Math.max(1, fragLimit / 50);
  }

  if (gt === 'ca') {
    return Math.abs(a - b) <= 2;
  }

  if (gt === 'tdm') {
    return a !== 0 && b !== 0 && Math.abs(a / b) <= 1.05 && Math.abs(b / a) <= 1.05;
  }

  if (gt === 'ctf') {
    return a !== 0 && b !== 0 && a / b <= 1.05 && b / a <= 1.05;
  }

  if (gt === 'ft') {
    return Math.abs(a - b) <= 5;
  }

  if (gt === 'dom') {
    return a !== 0 && b !== 0 && Math.abs(a / b) <= 1.05 && Math.abs(b / a) <= 1.05;
  }

  // Por defecto: coincidencia exacta
  return Math.abs(a - b) < 0.001;
}

/**
 * Valida si un partido debe ser clasificado según reglas estándar
 */
function validateMatch(gameType: string, matchStats: any, playerCount: number): {
  valid: boolean;
  reason?: string;
} {
  const gt = gameType.toLowerCase();

  // Verificar unrated/unranked en título de factory
  if (matchStats.FACTORY_TITLE && /unrated|unranked/i.test(matchStats.FACTORY_TITLE)) {
    return { valid: false, reason: 'Partido marcado como unrated/unranked' };
  }

  // Verificar si el tipo de juego está soportado
  if (!VALID_FACTORIES[gt]) {
    return { valid: false, reason: `Tipo de juego ${gt} no soportado` };
  }

  // Verificar flags del partido
  if (matchStats.ABORTED) {
    return { valid: false, reason: 'Partido abortado' };
  }

  if (matchStats.INFECTED) {
    return { valid: false, reason: 'Modo INFECTED no clasificado' };
  }

  if (matchStats.QUADHOG) {
    return { valid: false, reason: 'Modo QUADHOG no clasificado' };
  }

  if (matchStats.TRAINING) {
    return { valid: false, reason: 'Modo TRAINING no clasificado' };
  }

  // Verificar que el factory sea válido para este tipo de juego
  const factory = matchStats.FACTORY?.toLowerCase() || '';
  if (factory && !VALID_FACTORIES[gt].includes(factory)) {
    // INSTAGIB permitido como modificador pero verificar factory base
    if (!matchStats.INSTAGIB || !VALID_FACTORIES[gt].includes(factory.replace('_instagib', ''))) {
      return { valid: false, reason: `Factory ${factory} no permitido para ${gt}` };
    }
  }

  // Mínimo de jugadores requeridos por tipo de juego
  if (playerCount < (MIN_PLAYERS_BY_MODE[gt] || 2)) {
    return { valid: false, reason: `Mínimo ${MIN_PLAYERS_BY_MODE[gt]} jugadores requeridos` };
  }

  const gameLength = matchStats.GAME_LENGTH || 0;

  // Duración mínima solo para CA (2 minutos)
  // Los demás modos tienen sus propias validaciones de rondas/score/forfeited
  if (gt === 'ca' && gameLength < 2 * 60) {
    return { valid: false, reason: `CA duración mínima 2 minutos (actual: ${Math.floor(gameLength / 60)}m ${gameLength % 60}s)` };
  }

  // Validaciones por tipo de juego
  const tscore0 = matchStats.TSCORE0 || 0;
  const tscore1 = matchStats.TSCORE1 || 0;
  const fragLimit = matchStats.FRAG_LIMIT || 0;
  const scoreLimit = matchStats.SCORE_LIMIT || 0;
  const exitMsg = matchStats.EXIT_MSG || '';

  if (gt === 'duel') {
    if (gameLength < 10 * 60 - 5 && exitMsg.indexOf('forfeited') < 0) {
      return { valid: false, reason: 'Duel debe durar al menos 10 minutos o ser forfeited' };
    }
  }

  if (gt === 'ffa') {
    if (fragLimit < 50) {
      return { valid: false, reason: 'FFA frag limit debe ser >= 50' };
    }
  }

  if (gt === 'ca') {
    const maxScore = Math.max(tscore0, tscore1);
    const scoreDiff = Math.abs(tscore0 - tscore1);
    if (maxScore < 8 && scoreDiff < 5) {
      return { valid: false, reason: 'CA debe llegar a 8 rondas o 5 de diferencia' };
    }
  }

  if (gt === 'tdm') {
    const maxScore = Math.max(tscore0, tscore1);
    const scoreDiff = Math.abs(tscore0 - tscore1);
    if (maxScore < 100 && scoreDiff < 30 && gameLength < 15 * 60) {
      return { valid: false, reason: 'TDM debe llegar a 100 frags, 30 de diferencia, o 15 minutos' };
    }
  }

  if (gt === 'ctf') {
    const maxScore = Math.max(tscore0, tscore1);
    const scoreDiff = Math.abs(tscore0 - tscore1);
    if (maxScore < 5 && scoreDiff < 5 && gameLength < 15 * 60) {
      return { valid: false, reason: 'CTF debe llegar a 5 caps, 5 de diferencia, o 15 minutos' };
    }
  }

  if (gt === 'ad') {
    if (scoreLimit < 15) {
      return { valid: false, reason: 'AD score limit debe ser >= 15' };
    }
  }

  if (gt === 'ft') {
    const maxScore = Math.max(tscore0, tscore1);
    const scoreDiff = Math.abs(tscore0 - tscore1);
    if (maxScore < 8 && scoreDiff < 5 && gameLength < 15 * 60) {
      return { valid: false, reason: 'FT debe llegar a 8 rondas, 5 de diferencia, o 15 minutos' };
    }
  }

  if (gt === 'dom') {
    const maxScore = Math.max(tscore0, tscore1);
    const scoreDiff = Math.abs(tscore0 - tscore1);
    if (maxScore < 100 && scoreDiff < 30 && gameLength < 15 * 60) {
      return { valid: false, reason: 'DOM debe llegar a 100 puntos, 30 de diferencia, o 15 minutos' };
    }
  }

  return { valid: true };
}

/**
 * Calcula y actualiza calificaciones para todos los jugadores usando Glicko-1
 * NO usa Glicko-2, Loss Forgiveness, Streak Bonuses, etc.
 *
 * SISTEMA DE LIGA:
 * - Si serverType = "public" → Actualiza PlayerRating con ratingType = "public"
 * - Si serverType = "competitive" y hay season activa → Actualiza SeasonRating
 * - Si serverType = "competitive" sin season → Actualiza PlayerRating con ratingType = "ladder"
 */
export async function calculateMatchRatingsQLStats(
  context: MatchContext,
  allPlayers: MatchPlayer[],
  matchStats?: any, // Estadísticas del partido (TSCORE0, TSCORE1, etc.)
  ladderContext?: LadderContext // Contexto de liga
): Promise<void> {
  const { matchId, gameType, matchDuration } = context;
  const effectiveDate = context.matchDate || new Date();

  // Determinar tipo de rating a actualizar
  const serverType = ladderContext?.serverType || 'public';
  const seasonId = ladderContext?.seasonId || null;
  const isLadderMatch = serverType === 'competitive';
  const isSeasonMatch = isLadderMatch && seasonId !== null;

  // Rating inicial según tipo de juego
  const defaultRating = getDefaultRatingForGameType(gameType);

  try {
    // Log tipo de partida
    if (isSeasonMatch) {
      console.log(`[Rating] 🏆 LIGA (Temporada) - Procesando match ${matchId} - ${gameType}`);
    } else if (isLadderMatch) {
      console.log(`[Rating] 🏆 LIGA (Off-Season) - Procesando match ${matchId} - ${gameType}`);
    } else {
      console.log(`[Rating] 🎮 PÚBLICO - Procesando match ${matchId} - ${gameType}`);
    }

    // Validar partido según reglas estándar
    if (matchStats) {
      const validation = validateMatch(gameType, matchStats, allPlayers.length);
      if (!validation.valid) {
        console.log(`[Rating] Partido no válido: ${validation.reason}`);
        return;
      }
    }

    // Filtrar jugadores AFK
    // Excepto en duel
    const gt = gameType.toLowerCase();
    const activePlayers = allPlayers.filter(player => {
      // DUEL: no filtrar AFK
      if (gt === 'duel') {
        return true;
      }

      const damageDealt = player.damageDealt || 0;
      const damageTaken = player.damageTaken || 1;

      // AFK si daño infligido <= 100
      if (damageDealt <= 100) {
        console.log(`[Rating] ${player.steamId} filtrado - AFK (daño infligido: ${damageDealt})`);
        return false;
      }

      // AFK si daño recibido/daño infligido >= 10.0
      if (damageTaken / damageDealt >= 10.0) {
        console.log(`[Rating] ${player.steamId} filtrado - AFK (ratio DR/DI: ${(damageTaken / damageDealt).toFixed(2)})`);
        return false;
      }

      return true;
    });

    if (activePlayers.length === 0) {
      console.log(`[Rating] No hay jugadores activos después de filtrar AFK`);
      return;
    }

    console.log(`[Rating] Jugadores activos: ${activePlayers.length} de ${allPlayers.length}`);

    // Filtrar jugadores con < 50% participación
    // QUIT ACUMULATIVO: Detectar quitters que se van temprano (evaden el sistema)
    const lowParticipationQuitters: MatchPlayer[] = [];
    const minParticipationPlayers = activePlayers.filter(player => {
      const aliveTime = player.aliveTime || 0;
      const gameDuration = matchDuration || 1;

      // Requiere al menos 50% de participación
      if (aliveTime < gameDuration * 0.5) {
        console.log(`[Rating] ${player.steamId} filtrado - participación insuficiente (${aliveTime}s de ${gameDuration}s = ${(aliveTime / gameDuration * 100).toFixed(0)}%)`);
        // Si tiene quit flag, registrar como quitter
        if (player.quit) {
          lowParticipationQuitters.push(player);
        }
        return false;
      }

      return true;
    });

    // Registrar quits de jugadores que se fueron temprano (<50% participación)
    for (const quitter of lowParticipationQuitters) {
      try {
        const { penalty, quitCount } = await recordQuitAndCheckPenalty(
          quitter.steamId,
          quitter.matchId,
          gameType,
        );
        if (penalty > 0) {
          await applyQuitAccumulationPenalty(
            quitter.steamId,
            gameType,
            penalty,
            quitCount,
            quitter.matchId,
            serverType,
            seasonId,
          );
        }
      } catch (quitError) {
        console.error(`[Quit] Error registrando quit de ${quitter.steamId}:`, quitError);
      }
    }

    if (minParticipationPlayers.length === 0) {
      console.log(`[Rating] No hay jugadores con participación mínima (50%)`);
      return;
    }

    // Re-validar mínimo de jugadores DESPUÉS de filtrar AFK y participación
    // Evita calcular ratings cuando un match empezó con suficientes jugadores
    // pero la mayoría eran AFK o se fueron temprano
    const minRequired = MIN_PLAYERS_BY_MODE[gt] || 2;
    if (minParticipationPlayers.length < minRequired) {
      console.log(`[Rating] Jugadores activos insuficientes post-filtro: ${minParticipationPlayers.length} < ${minRequired} requeridos para ${gt}`);
      return;
    }

    console.log(`[Rating] Jugadores con participación mínima: ${minParticipationPlayers.length}`);

    // Determinar equipo ganador para partidos por equipos
    const isTeamGame = minParticipationPlayers.some(p => p.team !== undefined && p.team > 0);
    let winningTeam: number | undefined = undefined;

    if (isTeamGame && matchStats) {
      const tscore0 = matchStats.TSCORE0 || 0;
      const tscore1 = matchStats.TSCORE1 || 0;

      if (tscore0 > tscore1) {
        winningTeam = 1; // RED gana
      } else if (tscore1 > tscore0) {
        winningTeam = 2; // BLUE gana
      } else {
        winningTeam = 0; // EMPATE
      }

      console.log(`[Rating] Partido por equipos: RED ${tscore0} - ${tscore1} BLUE | Ganador: ${winningTeam === 1 ? 'RED' : winningTeam === 2 ? 'BLUE' : 'EMPATE'}`);
    }

    // Calcular puntajes de rendimiento para jugadores con participación mínima
    const performances = minParticipationPlayers.map(player => {
      // Usar playTimes si está disponible
      const playTimes = matchStats?.playTimes?.players?.[player.steamId];
      const roundCount = matchStats?.roundCount?.players?.[player.steamId];

      // Determinar si el jugador ganó
      let playerWin = false;
      let switchedTeam = false; // FIX: Marcar si el jugador cambió de equipo
      let playerTeam = player.team || 0; // Inicializar aquí para que esté disponible en todo el scope

      if (isTeamGame && winningTeam !== undefined) {
        // Partido por equipos: determinar equipo del jugador
        // FIX: Usar el equipo final del jugador (player.team) como fuente de verdad primaria
        // Esto corrige el bug donde cambiar de equipo te hacía perder ELO si habías jugado más tiempo en el otro

        // Fallback robusto: si no tiene equipo válido (0/undefined) pero jugó, intentar deducir por tiempos
        // Esto mantiene compatibilidad con reportes antiguos o incompletos
        if ((playerTeam !== 1 && playerTeam !== 2) && playTimes) {
          const timeRed = ((playTimes[0] || 0) + (playTimes[1] || 0));
          const timeBlue = (playTimes[2] || 0);

          if (timeRed > timeBlue) {
            playerTeam = 1; // RED
            console.log(`[Rating] ${player.steamId}: Equipo deducido por tiempo -> RED`);
          } else if (timeBlue > timeRed) {
            playerTeam = 2; // BLUE
            console.log(`[Rating] ${player.steamId}: Equipo deducido por tiempo -> BLUE`);
          }
        }

        // DETECCIÓN DE CAMBIO DE EQUIPO (MAJORITY TEAM ELO)
        // Si el equipo final es diferente al equipo donde jugó la mayoría del tiempo,
        // usar el equipo mayoritario para el cálculo de ELO (no excluir al jugador)
        if (playTimes && (playerTeam === 1 || playerTeam === 2)) {
          const timeRed = ((playTimes[0] || 0) + (playTimes[1] || 0));
          const timeBlue = (playTimes[2] || 0);
          const majorityTeam = timeRed > timeBlue ? 1 : 2;
          const timeDiff = Math.abs(timeRed - timeBlue);

          // Si terminó en un equipo distinto al que más jugó (y la diferencia es > 60s para evitar ruido)
          if (playerTeam !== majorityTeam && timeDiff > 60) {
            const finalTeam = playerTeam;
            playerTeam = majorityTeam; // Usar equipo mayoritario para ELO
            switchedTeam = true;
            console.log(`[Rating] SWITCH DETECTED: ${player.steamId} terminó en ${finalTeam === 1 ? 'RED' : 'BLUE'} pero jugó más en ${majorityTeam === 1 ? 'RED' : 'BLUE'} (${Math.round(timeRed)}s RED / ${Math.round(timeBlue)}s BLUE) - ELO calculado con equipo mayoritario`);
          }
        }

        playerWin = playerTeam === winningTeam;

        // Logging para depuración
        const timeRed = playTimes ? ((playTimes[0] || 0) + (playTimes[1] || 0)) : 0;
        const timeBlue = playTimes ? (playTimes[2] || 0) : 0;
        console.log(`[Rating] ${player.steamId}: Equipo Final ${playerTeam === 1 ? 'RED' : playerTeam === 2 ? 'BLUE' : 'FREE'} (tRed=${timeRed}s, tBlue=${timeBlue}s) | ${playerWin ? 'GANA' : 'PIERDE'}`);
      } else {
        // Partidos sin equipos (duel/ffa): determinar por RANK o puntaje
        // En duel, el jugador con mayor puntaje gana
        if (gt === 'duel' && minParticipationPlayers.length === 2) {
          const maxScore = Math.max(...minParticipationPlayers.map(p => p.score));
          playerWin = player.score === maxScore;
          console.log(`[Rating] DUEL: ${player.steamId} puntaje ${player.score} | ${playerWin ? 'GANA' : 'PIERDE'}`);
        } else if (gt === 'ffa') {
          // FFA: Solo RANK #1 gana, los demás pierden (como XonStat/QLStats)
          const maxScore = Math.max(...minParticipationPlayers.map(p => p.score));
          playerWin = player.score === maxScore && player.score > 0;
          console.log(`[Rating] FFA: ${player.steamId} puntaje ${player.score} (max: ${maxScore}) | ${playerWin ? 'GANA' : 'PIERDE'}`);
        }
      }

      const perfStats: PlayerPerformanceStats = {
        gameType,
        kills: player.kills,
        deaths: player.deaths,
        score: player.score,
        damageDealt: player.damageDealt || 0,
        damageTaken: player.damageTaken || 1,
        win: playerWin,
        aliveTime: player.aliveTime || matchDuration || 1,
        matchDuration: matchDuration || 1,
        quit: player.quit,
        // Manual time tracking
        // timeRed = times[0] + times[1] (FREE + RED)
        // timeBlue = times[2]
        timeRed: playTimes ? ((playTimes[0] || 0) + (playTimes[1] || 0)) : undefined,
        timeBlue: playTimes ? (playTimes[2] || 0) : undefined,
        roundsRed: roundCount ? roundCount.r : undefined,
        roundsBlue: roundCount ? roundCount.b : undefined,
        totalRounds: matchStats?.roundCount?.total,
      };

      const performance = calculatePerformance(perfStats);

      return {
        steamId: player.steamId,
        performance,
        team: playerTeam, // FIX: Usar playerTeam (deducido) en lugar de player.team (original)
        win: playerWin, // Guardar el resultado para usar después
        quit: player.quit, // Propagar estado de abandono
        switchedTeam, // FIX: Marcar si cambió de equipo para excluir del cálculo
      };
    });

    // Jugadores switched ya no se excluyen - su ELO se calcula con el equipo mayoritario
    const eligiblePerformances = performances;
    const switchedPlayers = performances.filter(p => p.switchedTeam);

    if (switchedPlayers.length > 0) {
      console.log(`[Rating] ${switchedPlayers.length} jugador(es) con cambio de equipo (ELO basado en equipo mayoritario): ${switchedPlayers.map(p => p.steamId).join(', ')}`);
    }

    const eligiblePlayers = minParticipationPlayers;

    if (eligiblePlayers.length === 0) {
      console.log(`[Rating] No hay jugadores elegibles`);
      return;
    }

    // Procesar cada jugador
    const currentPeriod = getRatingPeriod(context.matchDate);

    // Pre-cargar rachas de todos los jugadores elegibles (batch, para streak protection)
    const playerStreaksMap = new Map<string, { wins: number; losses: number }>();
    try {
      for (const player of eligiblePlayers) {
        const recentHistory = await prisma.eloHistory.findMany({
          where: {
            steamId: player.steamId,
            gameType: gameType,
          },
          orderBy: { recordedAt: 'desc' },
          take: 10,
          select: { change: true },
        });

        let consecutiveWins = 0;
        let consecutiveLosses = 0;

        for (const entry of recentHistory) {
          if (entry.change > 0) {
            if (consecutiveLosses > 0) break; // Racha de pérdidas terminó
            consecutiveWins++;
          } else if (entry.change < 0) {
            if (consecutiveWins > 0) break; // Racha de victorias terminó
            consecutiveLosses++;
          }
          // change === 0 no rompe la racha
        }

        playerStreaksMap.set(player.steamId, { wins: consecutiveWins, losses: consecutiveLosses });
      }
      console.log(`[Rating] Rachas cargadas: ${[...playerStreaksMap.entries()].map(([id, s]) => `${id.slice(-4)}:W${s.wins}/L${s.losses}`).join(', ')}`);
    } catch (streakError) {
      console.log(`[Rating] Error cargando rachas (usando 0): ${streakError}`);
    }

    // Cargar todos los ratings en memoria primero (optimización)
    // Soporta: PlayerRating (público/ladder) y SeasonRating (temporada)
    const playerRatingsMap = new Map<string, any>();
    for (const player of eligiblePlayers) {
      const dbPlayer = await prisma.player.findUnique({
        where: { steamId: player.steamId },
      });

      if (!dbPlayer) {
        console.log(`[Rating] Jugador no existe: ${player.steamId}`);
        continue;
      }

      let ratingRecord: any = null;

      // ============================================================
      // RD GLOBAL CROSS-GAMETYPE
      // Si un jugador es activo en otros modos, su RD inicial en un
      // modo nuevo NO debería ser 350. Calculamos un RD reducido
      // basado en su actividad global para evitar farmeo.
      // Ejemplo: VODKAX juega CTF todo el día (RD=50 en CTF),
      // entra a CA → su RD en CA empieza en ~120, no en 350.
      // ============================================================
      // DESHABILITADO: RD cross-gametype removido — cada modo usa DEFAULT_RD independiente
      // async function getGlobalAdjustedRD(...) { ... }

      // CASO 1: Partida de temporada → usar SeasonRating
      if (isSeasonMatch && seasonId) {
        ratingRecord = await prisma.seasonRating.findUnique({
          where: {
            seasonId_steamId_gameType: {
              seasonId: seasonId,
              steamId: player.steamId,
              gameType,
            },
          },
        });

        if (!ratingRecord) {
          const seasonDefaultRating = getDefaultRatingForGameType(gameType);
          const seasonInitialRD = Glicko1Constants.DEFAULT_RD;
          ratingRecord = await prisma.seasonRating.create({
            data: {
              id: randomUUID(),
              seasonId: seasonId,
              playerId: dbPlayer.id,
              steamId: player.steamId,
              gameType,
              rating: seasonDefaultRating,
              deviation: seasonInitialRD,
            },
          });
          console.log(`[Rating] 🏆 Nuevo SeasonRating creado: ${player.steamId} - ${seasonDefaultRating} (RD=${seasonInitialRD.toFixed(0)})`);
        }

        // Normalizar campos para compatibilidad
        ratingRecord = {
          ...ratingRecord,
          volatility: 0.06, // Glicko-1 no usa volatilidad, pero mantenemos para compatibilidad de schema
          totalGames: ratingRecord.games,
          _isSeasonRating: true, // Marker para update
        };
      }
      // CASO 2: Partida competitiva off-season → usar PlayerRating con ratingType="ladder"
      else if (isLadderMatch) {
        ratingRecord = await prisma.playerRating.findUnique({
          where: {
            steamId_gameType_ratingType: {
              steamId: player.steamId,
              gameType,
              ratingType: 'ladder',
            },
          },
        });

        if (!ratingRecord) {
          // Ladder siempre usa 1500 como base, independiente del gameType
          const ladderDefaultRating = 1500;
          const ladderInitialRD = Glicko1Constants.DEFAULT_RD;
          ratingRecord = await prisma.playerRating.create({
            data: {
              id: randomUUID(),
              playerId: dbPlayer.id,
              steamId: player.steamId,
              gameType,
              ratingType: 'ladder',
              rating: ladderDefaultRating,
              deviation: ladderInitialRD,
              volatility: 0.06,
              kFactor: 0,
              updatedAt: effectiveDate,
            },
          });
          console.log(`[Rating] 🏆 Nuevo rating ladder creado: ${player.steamId} - ${ladderDefaultRating} (RD=${ladderInitialRD.toFixed(0)})`);
        }
      }
      // CASO 3: Partida pública → usar PlayerRating con ratingType="public"
      else {
        ratingRecord = await prisma.playerRating.findUnique({
          where: {
            steamId_gameType_ratingType: {
              steamId: player.steamId,
              gameType,
              ratingType: 'public',
            },
          },
        });

        if (!ratingRecord) {
          const publicInitialRD = Glicko1Constants.DEFAULT_RD;
          ratingRecord = await prisma.playerRating.create({
            data: {
              id: randomUUID(),
              playerId: dbPlayer.id,
              steamId: player.steamId,
              gameType,
              ratingType: 'public',
              rating: defaultRating,
              deviation: publicInitialRD,
              volatility: 0.06,
              kFactor: 0,
              updatedAt: effectiveDate,
            },
          });
          console.log(`[Rating] Nuevo rating público creado: ${player.steamId} - ${defaultRating} (RD=${publicInitialRD.toFixed(0)})`);
        }
      }

      playerRatingsMap.set(player.steamId, ratingRecord);
    }

    // ============================================
    // BLENDING MAPA/GLOBAL — Cargar MapRatings para usar como opponent rating
    // effective_rating = 0.75 * map_rating + 0.25 * global_rating (como QLLR)
    // Solo aplica si hay mapa y el jugador tiene historial en ese mapa (>= 5 juegos)
    // ============================================
    const MAP_BLEND_FACTOR = 0.75; // Peso del rating del mapa
    const MAP_BLEND_MIN_GAMES = 5; // Mínimo de juegos en el mapa para activar blend
    const blendedRatingsMap = new Map<string, { rating: number; deviation: number }>();

    if (context.mapName && !isSeasonMatch) {
      const mapName = context.mapName.toLowerCase();
      const mapRatingType = isLadderMatch ? 'ladder' : 'public';

      for (const player of eligiblePlayers) {
        const globalRating = playerRatingsMap.get(player.steamId);
        if (!globalRating) continue;

        try {
          const mapRating = await prisma.mapRating.findUnique({
            where: {
              steamId_gameType_mapName_ratingType: {
                steamId: player.steamId,
                gameType,
                mapName,
                ratingType: mapRatingType,
              },
            },
          });

          if (mapRating && mapRating.totalGames >= MAP_BLEND_MIN_GAMES) {
            const blendedRating = MAP_BLEND_FACTOR * mapRating.rating + (1 - MAP_BLEND_FACTOR) * globalRating.rating;
            const blendedRd = MAP_BLEND_FACTOR * mapRating.deviation + (1 - MAP_BLEND_FACTOR) * globalRating.deviation;
            blendedRatingsMap.set(player.steamId, { rating: blendedRating, deviation: blendedRd });
          }
        } catch {
          // Si falla la consulta de mapa, usar rating global (sin blend)
        }
      }

      if (blendedRatingsMap.size > 0) {
        console.log(`[Rating] MapBlend activo (${context.mapName}): ${[...blendedRatingsMap.entries()].map(([id, r]) => `${id.slice(-4)}:${r.rating.toFixed(0)}`).join(', ')}`);
      }
    }

    // ============================================
    // ALGORITMO DE RATING BASADO EN RESULTADO DE EQUIPO
    // ============================================
    //
    // MODELO CLÁSICO DE EQUIPOS:
    // - Si tu equipo GANA → TÚ GANAS ELO (cantidad según tu performance)
    // - Si tu equipo PIERDE → TÚ PIERDES ELO
    //   EXCEPCIÓN: Los top 2 MVPs del equipo perdedor pueden ganar ELO
    //
    // El performance individual solo modifica CUÁNTO ganas o pierdes,
    // pero el SIGNO (positivo/negativo) lo determina el resultado del equipo.
    //
    const playerMatches = new Map<string, Glicko1Match[]>();

    // Top MVPs del equipo perdedor (solo para logging, no ganan ELO)
    const losingTeam = winningTeam === 1 ? 2 : 1;
    const losingTeamPerformances = eligiblePerformances
      .filter(p => p.team === losingTeam)
      .sort((a, b) => b.performance - a.performance);
    const topMVPsSteamIds = losingTeamPerformances.slice(0, 2).map(p => p.steamId);

    if (topMVPsSteamIds.length > 0) {
      console.log(`[Rating] Top MVPs del equipo perdedor (protegidos: 0 ELO): ${topMVPsSteamIds.join(', ')}`);
    }

    // FIX: Usar eligiblePerformances y eligiblePlayers (excluye jugadores que cambiaron de equipo)
    for (let i = 0; i < eligiblePerformances.length; i++) {
      const r1 = eligiblePerformances[i];
      const p1 = eligiblePlayers[i];

      if (!playerMatches.has(p1.steamId)) {
        playerMatches.set(p1.steamId, []);
      }

      for (let j = i + 1; j < eligiblePerformances.length; j++) {
        const r2 = eligiblePerformances[j];
        const p2 = eligiblePlayers[j];

        // No comparar compañeros de equipo
        if (r1.team !== undefined && r1.team === r2.team && r1.team > 0) {
          continue;
        }

        // Obtener calificaciones de oponentes
        const rating2 = playerRatingsMap.get(p2.steamId);
        const rating1 = playerRatingsMap.get(p1.steamId);

        if (!rating1 || !rating2) continue;

        // ============================================
        // LÓGICA DE OUTCOME BASADA EN RESULTADO DE EQUIPO
        // ============================================
        //
        // Para partidos por equipos (CA, TDM, CTF, etc.):
        // - Equipo ganador: outcome 0.7-1.0 (siempre gana ELO)
        // - Equipo perdedor: outcome 0.0-0.3 (pierde ELO)
        // - Top 2 MVPs perdedores: outcome 0.5-0.7 (pueden ganar un poco)
        //
        // El performance relativo ajusta CUÁNTO dentro del rango

        let outcome1: number;
        let outcome2: number;

        if (isTeamGame && winningTeam !== undefined && winningTeam !== 0) {
          const p1Won = r1.team === winningTeam;
          const p2Won = r2.team === winningTeam;

          // Calcular factor de performance (0.0 a 1.0)
          const perfDiff = r1.performance - r2.performance;
          const maxPerfDiff = Math.max(Math.abs(perfDiff), 1);
          const perfFactor1 = 0.5 + (perfDiff / maxPerfDiff) * 0.5; // 0.0 a 1.0
          const perfFactor2 = 1.0 - perfFactor1;

          if (p1Won && !p2Won) {
            // P1 ganó, P2 perdió
            outcome1 = 0.7 + perfFactor1 * 0.3; // 0.7-1.0
            outcome2 = 0.0 + perfFactor2 * 0.3; // Perdedor: 0.0-0.3 (MVPs protegidos en Team Result Modifier)
          } else if (p2Won && !p1Won) {
            // P2 ganó, P1 perdió
            outcome2 = 0.7 + perfFactor2 * 0.3; // 0.7-1.0
            outcome1 = 0.0 + perfFactor1 * 0.3; // Perdedor: 0.0-0.3 (MVPs protegidos en Team Result Modifier)
          } else {
            // Ambos del mismo resultado (no debería pasar, pero por seguridad)
            outcome1 = perfFactor1;
            outcome2 = perfFactor2;
          }
        } else {
          // Partidos sin equipos (duel/ffa): usar performance puro
          const isDrawResult = isDraw(r1.performance, r2.performance, gameType, matchStats);
          outcome1 = isDrawResult ? 0.5 : r1.performance > r2.performance ? 1.0 : 0.0;
          outcome2 = 1.0 - outcome1;
        }

        // Usar blended rating (mapa/global) como opponent si disponible
        const effective2 = blendedRatingsMap.get(p2.steamId) || { rating: rating2.rating, deviation: rating2.deviation };
        const effective1 = blendedRatingsMap.get(p1.steamId) || { rating: rating1.rating, deviation: rating1.deviation };

        // Agregar resultado para jugador 1 vs jugador 2
        if (!playerMatches.has(p1.steamId)) {
          playerMatches.set(p1.steamId, []);
        }
        playerMatches.get(p1.steamId)!.push({
          opponent: {
            rating: effective2.rating,
            rd: effective2.deviation,
          },
          outcome: outcome1,
        });

        // Agregar resultado para jugador 2 vs jugador 1
        if (!playerMatches.has(p2.steamId)) {
          playerMatches.set(p2.steamId, []);
        }
        playerMatches.get(p2.steamId)!.push({
          opponent: {
            rating: effective1.rating,
            rd: effective1.deviation,
          },
          outcome: outcome2,
        });
      }
    }

    // Actualizar calificación de cada jugador con sus partidos acumulados
    for (const player of eligiblePlayers) {
      try {
        const playerRating = playerRatingsMap.get(player.steamId);
        if (!playerRating) continue;

        const matches = playerMatches.get(player.steamId) || [];


        if (matches.length === 0) {
          console.log(`[Rating] ${player.steamId} no tiene oponentes`);
          continue;
        }

        // Calcular nueva calificación usando Glicko-1
        const currentRating: Glicko1Rating = {
          rating: playerRating.rating,
          rd: playerRating.deviation,
          period: Math.floor((playerRating.lastPlayed?.getTime() || 0) / (1000 * 60 * 60 * 24)),
          games: playerRating.totalGames,
        };

        const newRating = updateGlicko1Rating(
          currentRating,
          matches,
          currentPeriod
        );

        let ratingChange = Math.round(newRating.rating - currentRating.rating);

        // ============================================
        // APLICAR MEJORAS DE RATING (Loss Forgiveness, Anti-Farming, etc.)
        // ============================================
        let effectiveQuit = false;
        try {
          const playerPerf = eligiblePerformances.find(p => p.steamId === player.steamId);
          const isWin = playerPerf?.win ?? (ratingChange > 0);

          // Calcular rating promedio de oponentes
          const opponentMatches = matches.filter(m => m.opponent);
          const avgOpponentRating = opponentMatches.length > 0
            ? opponentMatches.reduce((sum, m) => sum + m.opponent.rating, 0) / opponentMatches.length
            : currentRating.rating;

          // Calcular margen de victoria si es posible
          const marginInfo = matchStats
            ? calculateMarginOfVictory(
              matchStats.TSCORE0 || 0,
              matchStats.TSCORE1 || 0,
              gameType
            )
            : null;

          // Calcular ranking de performance (0.0 = peor, 1.0 = mejor)
          const sortedPerformances = [...eligiblePerformances].sort((a, b) => b.performance - a.performance);
          const playerPerfIndex = sortedPerformances.findIndex(p => p.steamId === player.steamId);
          const performanceRank = sortedPerformances.length > 1
            ? 1 - (playerPerfIndex / (sortedPerformances.length - 1))
            : 0.5;

          // FIX: Safety net para quit penalty
          // Si el jugador pasó el filtro de participación (50%+) Y jugó >= 70% del match,
          // no es un quitter real (se desconectó y volvió, o cambió de equipo)
          const playerAliveTime = player.aliveTime || 0;
          const totalDuration = matchDuration || 1;
          const participationRatio = playerAliveTime / totalDuration;
          effectiveQuit = playerPerf?.quit === true && participationRatio < 0.7;

          if (playerPerf?.quit && !effectiveQuit) {
            console.log(`[Rating] ${player.steamId}: quit flag ignorado (participación ${(participationRatio * 100).toFixed(0)}% >= 70%)`);
          }

          const ratingContext: RatingContext = {
            playerRating: currentRating.rating,
            opponentRating: avgOpponentRating,
            playerGames: playerRating.totalGames || 0,
            opponentGames: 50,
            isWin,
            marginOfVictory: marginInfo?.margin,
            maxScore: marginInfo?.maxMargin,
            consecutiveLosses: playerStreaksMap.get(player.steamId)?.losses || 0,
            consecutiveWins: playerStreaksMap.get(player.steamId)?.wins || 0,
            // Nuevos campos para Team Result Modifier
            teamWon: playerPerf?.win,
            gameType: gameType,
            performanceRank: performanceRank,
            hasQuit: effectiveQuit, // FIX: usar quit efectivo con safety net de participación
          };

          const improved = applyRatingImprovements(ratingChange, ratingContext);

          // Aplicar el cambio mejorado
          let adjustmentReasons: string[] = [];
          if (improved && improved.adjustments && improved.adjustments.length > 0) {
            console.log(`[Rating] Mejoras aplicadas para ${player.steamId}:`);
            improved.adjustments.forEach(adj => {
              console.log(`  - ${adj.type}: ${adj.reason}`);
              adjustmentReasons.push(adj.type);
            });
            console.log(`  Cambio: ${ratingChange} → ${improved.adjustedChange}`);

            ratingChange = improved.adjustedChange;
            newRating.rating = currentRating.rating + ratingChange;
          }

          // Guardar razones de ajuste en statusMessage para mostrar en UI
          const isSwitched = playerPerf?.switchedTeam === true;
          if (player.matchId && (adjustmentReasons.length > 0 || isSwitched)) {
            const allAdjustments = improved.adjustments.map(adj => ({
              type: adj.type,
              reason: adj.reason,
            }));

            // Agregar indicador de switch si aplica
            if (isSwitched) {
              allAdjustments.unshift({
                type: 'Majority Team',
                reason: 'Cambió de equipo durante el partido - ELO calculado con el equipo donde jugó más tiempo',
              });
            }

            const statusData = {
              adjustments: allAdjustments,
              originalChange: improved.originalChange,
              switchedTeam: isSwitched,
            };
            prisma.playerMatchStats.update({
              where: { id: player.matchId },
              data: { statusMessage: JSON.stringify(statusData) },
            }).catch(err => console.error('[Rating] Error saving adjustment reasons:', err));
          }
        } catch (improvementError) {
          // Si hay error en las mejoras, continuar con el rating original
          console.log(`[Rating] Mejoras no aplicadas (usando rating original): ${improvementError}`);
        }

        // Verificar si ya procesamos este partido (evitar duplicados)
        const existingEloHistory = player.matchId ? await prisma.eloHistory.findFirst({
          where: {
            steamId: player.steamId,
            matchId: player.matchId,
            gameType: gameType,
          },
        }) : null;

        // Determinar win/loss/draw basándose en el RESULTADO REAL del partido
        // NO en el cambio de ELO (que puede subir aunque pierdas si tuviste buen performance)
        let wins = playerRating.wins;
        let losses = playerRating.losses;
        let draws = playerRating.draws;
        let shouldIncrementGames = !existingEloHistory;

        if (shouldIncrementGames) {
          // Usar el resultado real del partido (win/loss) NO el cambio de rating
          const playerPerf = eligiblePerformances.find(p => p.steamId === player.steamId);
          const didWin = playerPerf?.win;

          if (didWin === true) {
            wins++;
          } else if (didWin === false) {
            losses++;
          } else {
            // Si no podemos determinar, usar cambio de rating como fallback
            if (ratingChange > 0) {
              wins++;
            } else if (ratingChange < 0) {
              losses++;
            } else {
              draws++;
            }
          }
        }

        // Guardar nueva calificación (incluyendo volatilidad de Glicko-2)
        // SISTEMA DE LIGA: Usar el modelo correcto según tipo de partida
        if (playerRating._isSeasonRating) {
          // Actualizar SeasonRating para partidas de temporada
          if (shouldIncrementGames) {
            await prisma.seasonRating.update({
              where: { id: playerRating.id },
              data: {
                rating: newRating.rating,
                deviation: newRating.rd,
                wins,
                losses,
                draws,
                games: { increment: 1 },
                lastPlayed: effectiveDate,
              },
            });
          } else {
            await prisma.seasonRating.update({
              where: { id: playerRating.id },
              data: {
                rating: newRating.rating,
                deviation: newRating.rd,
                lastPlayed: effectiveDate,
              },
            });
            console.log(`[Rating] 🏆 Partido de temporada ya procesado, solo actualizando calificación`);
          }
        } else {
          // Actualizar PlayerRating (público o ladder)
          if (shouldIncrementGames) {
            await prisma.playerRating.update({
              where: { id: playerRating.id },
              data: {
                rating: newRating.rating,
                deviation: newRating.rd,
                volatility: 0.06, // Glicko-1 no usa volatilidad
                wins,
                losses,
                draws,
                totalGames: { increment: 1 },
                lastPlayed: effectiveDate,
                updatedAt: effectiveDate,
              },
            });
          } else {
            await prisma.playerRating.update({
              where: { id: playerRating.id },
              data: {
                rating: newRating.rating,
                deviation: newRating.rd,
                volatility: 0.06, // Glicko-1 no usa volatilidad
                lastPlayed: effectiveDate,
                updatedAt: effectiveDate,
              },
            });
            console.log(`[Rating] Partido ya procesado, solo actualizando calificación`);
          }
        }

        // Guardar historial
        if (player.matchId) {
          try {
            await prisma.eloHistory.create({
              data: {
                id: randomUUID(),
                playerId: playerRating.playerId,
                steamId: player.steamId,
                gameType,
                eloBefore: Math.round(currentRating.rating),
                eloAfter: Math.round(newRating.rating),
                change: ratingChange,
                rdBefore: currentRating.rd,
                rdAfter: newRating.rd,
                playerMatchStatsId: player.matchId,
              },
            });

            // Actualizar PlayerMatchStats con los valores de elo (para mostrar en perfiles)
            await prisma.playerMatchStats.update({
              where: { id: player.matchId },
              data: {
                eloBefore: Math.round(currentRating.rating),
                eloAfter: Math.round(newRating.rating),
                eloDelta: ratingChange,
                rdBefore: currentRating.rd,
                rdAfter: newRating.rd,
              },
            });

          } catch (eloError: any) {
            if (eloError.code !== 'P2002') {
              throw eloError;
            }
          }
        }

        console.log(
          `[Rating] ${player.steamId}: ${currentRating.rating.toFixed(0)} → ${newRating.rating.toFixed(0)} (${ratingChange > 0 ? '+' : ''}${ratingChange}) RD: ${newRating.rd.toFixed(1)}`
        );

        // ============================================
        // RATING POR MAPA — Tracking separado
        // Mantiene un Glicko-1 independiente por mapa para cada jugador
        // ============================================
        if (context.mapName && !playerRating._isSeasonRating) {
          try {
            const mapName = context.mapName.toLowerCase();
            const mapRatingType = isLadderMatch ? 'ladder' : 'public';

            // Buscar o crear MapRating
            let mapRating = await prisma.mapRating.findUnique({
              where: {
                steamId_gameType_mapName_ratingType: {
                  steamId: player.steamId,
                  gameType,
                  mapName,
                  ratingType: mapRatingType,
                },
              },
            });

            if (!mapRating) {
              // Nuevo mapa: inicializar con rating global actual (no default)
              // Esto evita que un jugador de 1500 empiece en 900 en un mapa nuevo
              mapRating = await prisma.mapRating.create({
                data: {
                  id: randomUUID(),
                  playerId: playerRating.playerId,
                  steamId: player.steamId,
                  gameType,
                  mapName,
                  ratingType: mapRatingType,
                  rating: currentRating.rating,
                  deviation: Math.min(currentRating.rd + 50, Glicko1Constants.DEFAULT_RD),
                  updatedAt: effectiveDate,
                },
              });
              console.log(`[MapRating] Nuevo: ${player.steamId} en ${mapName} (${gameType}) = ${currentRating.rating.toFixed(0)}`);
            }

            // Calcular nuevo rating del mapa con Glicko-1
            const mapCurrentRating: Glicko1Rating = {
              rating: mapRating.rating,
              rd: mapRating.deviation,
              period: Math.floor((mapRating.lastPlayed?.getTime() || 0) / (1000 * 60 * 60 * 24)),
              games: mapRating.totalGames,
            };

            const mapNewRating = updateGlicko1Rating(mapCurrentRating, matches, currentPeriod);
            const mapRatingChange = Math.round(mapNewRating.rating - mapCurrentRating.rating);
            const playerPerf = eligiblePerformances.find(p => p.steamId === player.steamId);
            const mapWin = playerPerf?.win === true;

            await prisma.mapRating.update({
              where: { id: mapRating.id },
              data: {
                rating: mapNewRating.rating,
                deviation: mapNewRating.rd,
                wins: mapWin ? { increment: 1 } : undefined,
                losses: !mapWin ? { increment: 1 } : undefined,
                totalGames: { increment: 1 },
                lastPlayed: effectiveDate,
                updatedAt: effectiveDate,
              },
            });

            console.log(`[MapRating] ${player.steamId} en ${mapName}: ${mapCurrentRating.rating.toFixed(0)} → ${mapNewRating.rating.toFixed(0)} (${mapRatingChange > 0 ? '+' : ''}${mapRatingChange})`);
          } catch (mapRatingError) {
            console.error(`[MapRating] Error para ${player.steamId}:`, mapRatingError);
          }
        }

        // QUIT ACUMULATIVO: Registrar quit de jugadores que pasaron el filtro de 50% pero tienen effectiveQuit
        if (effectiveQuit) {
          try {
            const { penalty, quitCount } = await recordQuitAndCheckPenalty(
              player.steamId,
              player.matchId,
              gameType,
            );
            if (penalty > 0) {
              await applyQuitAccumulationPenalty(
                player.steamId,
                gameType,
                penalty,
                quitCount,
                player.matchId,
                serverType,
                seasonId,
              );
            }
          } catch (quitError) {
            console.error(`[Quit] Error registrando quit acumulativo de ${player.steamId}:`, quitError);
          }
        }

      } catch (playerError) {
        console.error(`[Rating] Error procesando ${player.steamId}:`, playerError);
      }
    }

    console.log(`[Rating] Match completado: ${eligiblePlayers.length} jugadores procesados (${switchedPlayers.length} excluidos por cambio de equipo)`);

  } catch (error) {
    console.error('[Rating] Error al calcular ratings:', error);
    throw error;
  }
}

// ============================================
// SISTEMA ACTUAL: Glicko-1 original de QuakeClub
// ============================================
// calculateMatchRatingsQLStats es el sistema principal

// Alias para compatibilidad
export const calculateMatchRatings = calculateMatchRatingsQLStats
