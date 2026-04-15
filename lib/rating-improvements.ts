export interface RatingContext {
    playerRating: number;
    opponentRating: number;
    playerGames: number;
    opponentGames: number;
    isWin: boolean;
    marginOfVictory?: number;  // Ej: 15-14 = 1, 15-0 = 15
    maxScore?: number;         // Ej: 15 para CA
    consecutiveLosses?: number;
    consecutiveWins?: number;
    // Nuevos campos para Team Result Modifier
    teamWon?: boolean;         // Si el equipo del jugador ganó
    gameType?: string;         // Tipo de juego (ca, ctf, etc.)
    performanceRank?: number;  // Ranking de performance (0.0 = peor, 1.0 = mejor)
    hasQuit?: boolean;         // Si el jugador abandonó la partida
}

export interface RatingAdjustment {
    originalChange: number;
    adjustedChange: number;
    adjustments: {
        type: string;
        factor: number;
        reason: string;
    }[];
}


export const IMPROVEMENT_CONFIG = {
    lossForgiveness: {
        enabled: true,
        thresholds: [
            // Activa con diferencias de 200+
            { ratingDiff: 200, maxLoss: 18 },   // Favorito por 200+: máx -18
            { ratingDiff: 300, maxLoss: 12 },   // Favorito por 300+: máx -12
            { ratingDiff: 400, maxLoss: 8 },    // Favorito por 400+: máx -8
            { ratingDiff: 500, maxLoss: 5 },    // Favorito por 500+: máx -5
        ],
    },

    // Upset Bonus - MÁS GENEROSO
    // Recompensa significativamente ganar contra mejores jugadores
    upsetBonus: {
        enabled: true,
        thresholds: [
            // Activar desde diferencias menores para sentir progreso
            { ratingDiff: 100, bonus: 1.15 },   // Underdog por 100+: +15%
            { ratingDiff: 200, bonus: 1.25 },   // Underdog por 200+: +25%
            { ratingDiff: 300, bonus: 1.35 },   // Underdog por 300+: +35%
            { ratingDiff: 400, bonus: 1.50 },   // Underdog por 400+: +50%
        ],
    },

    // Anti-Farming - Reduce ganancias contra jugadores muy débiles
    antiFarming: {
        enabled: true,
        thresholds: [
            // Mantener igual para evitar farmeo
            { ratingDiff: 300, reduction: 0.80 },  // Favorito por 300+: -20% ganancia
            { ratingDiff: 400, reduction: 0.65 },  // Favorito por 400+: -35% ganancia
            { ratingDiff: 500, reduction: 0.50 },  // Favorito por 500+: -50% ganancia
        ],
    },

    // Margin of Victory - ACTIVADO
    // Partidos cerrados = menos cambio de rating
    // Un 10-9 no debería cambiar tanto como un 10-0
    marginOfVictory: {
        enabled: true,
        minFactor: 0.6,  // Mínimo 60% del cambio base para partidos muy cerrados
    },

    // Experience Scaling - DESACTIVADO
    // El sistema Glicko-1 ya maneja naturalmente la incertidumbre de jugadores nuevos
    // a través del RD alto. Mantener esto activado causaba inflación de ratings.
    experienceScaling: {
        enabled: false,  // DESACTIVADO - causaba inflación en jugadores nuevos
        tiers: [
            { games: 10, factor: 1.0 },   // Sin cambio
            { games: 25, factor: 1.0 },
            { games: 50, factor: 1.0 },
            { games: 100, factor: 1.0 },
            { games: 200, factor: 1.0 },
            { games: 400, factor: 1.0 },
        ],
    },

    // Streak Protection - ACTIVADO pero sutil
    // Protege contra tilts y recompensa consistencia
    streakProtection: {
        enabled: true,
        lossReduction: [
            // Reducción gradual de pérdidas en rachas perdedoras
            { streak: 4, factor: 0.90 },  // 4 pérdidas: -10% pérdida
            { streak: 6, factor: 0.80 },  // 6 pérdidas: -20% pérdida
            { streak: 8, factor: 0.70 },  // 8 pérdidas: -30% pérdida
        ],
        winBonus: [
            // Bonus por rachas ganadoras
            { streak: 4, factor: 1.10 },  // 4 victorias: +10% ganancia
            { streak: 6, factor: 1.15 },  // 6 victorias: +15% ganancia
        ],
    },

    teamResultModifier: {
        enabled: true,
        // Porcentaje del cambio base según rendimiento
        // Performance 0% (peor del server) -> minFactor
        // Performance 100% (mejor del server) -> maxFactor
        winnerMinElo: 1,      // Mínimo que gana el peor jugador del equipo ganador
        winnerMaxFactor: 1.5, // El mejor jugador del equipo ganador gana 50% más
        loserMinElo: -1,      // Mínimo que pierde el mejor jugador del equipo perdedor
        loserMaxFactor: 1.5,  // El peor jugador del equipo perdedor pierde 50% más
        // NUEVO: Excepción para performance excepcional en derrota
        exceptionalPerformanceThreshold: 0.78, // Top 2 del server (Top 22%)
        exceptionalPerformanceBonus: 5,        // Máximo +5 ELO por performance excepcional en derrota
        // Tipos de juego donde aplica (solo juegos por equipos)
        applicableGameTypes: ['ca', 'ctf', 'tdm', 'ft', 'ad', 'dom'],
    },

    // Quit Penalty - Castigo por abandonar
    quitPenalty: {
        enabled: true,
        penaltyFactor: 2.0, // Doble de pérdida si quiteas
        minPenalty: 30      // Mínimo 30 puntos de castigo
    }
};

export function applyLossForgiveness(
    ratingChange: number,
    ratingDiff: number,  // playerRating - opponentRating (positivo = favorito)
    isWin: boolean
): { change: number; applied: boolean; maxLoss?: number } {
    if (!IMPROVEMENT_CONFIG.lossForgiveness.enabled) {
        return { change: ratingChange, applied: false };
    }

    // Solo aplica a pérdidas del favorito
    if (isWin || ratingDiff <= 0 || ratingChange >= 0) {
        return { change: ratingChange, applied: false };
    }

    const thresholds = IMPROVEMENT_CONFIG.lossForgiveness.thresholds;
    for (let i = thresholds.length - 1; i >= 0; i--) {
        if (ratingDiff >= thresholds[i].ratingDiff) {
            const maxLoss = -thresholds[i].maxLoss;
            if (ratingChange < maxLoss) {
                return {
                    change: maxLoss,
                    applied: true,
                    maxLoss: thresholds[i].maxLoss
                };
            }
            break;
        }
    }

    return { change: ratingChange, applied: false };
}

/**
 * Upset Bonus: Bonus extra cuando un underdog gana
 */
export function applyUpsetBonus(
    ratingChange: number,
    ratingDiff: number,  // playerRating - opponentRating (negativo = underdog)
    isWin: boolean
): { change: number; applied: boolean; bonus?: number } {
    if (!IMPROVEMENT_CONFIG.upsetBonus.enabled) {
        return { change: ratingChange, applied: false };
    }

    // Solo aplica a victorias del underdog
    if (!isWin || ratingDiff >= 0 || ratingChange <= 0) {
        return { change: ratingChange, applied: false };
    }

    const diff = Math.abs(ratingDiff);
    const thresholds = IMPROVEMENT_CONFIG.upsetBonus.thresholds;

    for (let i = thresholds.length - 1; i >= 0; i--) {
        if (diff >= thresholds[i].ratingDiff) {
            const bonus = thresholds[i].bonus;
            return {
                change: ratingChange * bonus,
                applied: true,
                bonus
            };
        }
    }

    return { change: ratingChange, applied: false };
}

/**
 * Anti-Farming: Reduce ganancias cuando vences a jugadores mucho más débiles
 */
export function applyAntiFarming(
    ratingChange: number,
    ratingDiff: number,  // playerRating - opponentRating (positivo = favorito)
    isWin: boolean
): { change: number; applied: boolean; reduction?: number } {
    if (!IMPROVEMENT_CONFIG.antiFarming.enabled) {
        return { change: ratingChange, applied: false };
    }

    // Solo aplica a victorias del favorito
    if (!isWin || ratingDiff <= 0 || ratingChange <= 0) {
        return { change: ratingChange, applied: false };
    }

    const thresholds = IMPROVEMENT_CONFIG.antiFarming.thresholds;

    for (let i = thresholds.length - 1; i >= 0; i--) {
        if (ratingDiff >= thresholds[i].ratingDiff) {
            const reduction = thresholds[i].reduction;
            return {
                change: ratingChange * reduction,
                applied: true,
                reduction
            };
        }
    }

    return { change: ratingChange, applied: false };
}

/**
 * Margin of Victory: Ajusta cambio según qué tan cerrado fue el partido
 */
export function applyMarginOfVictory(
    ratingChange: number,
    margin: number | undefined,
    maxMargin: number | undefined
): { change: number; applied: boolean; factor?: number } {
    if (!IMPROVEMENT_CONFIG.marginOfVictory.enabled) {
        return { change: ratingChange, applied: false };
    }

    if (margin === undefined || maxMargin === undefined || maxMargin <= 0) {
        return { change: ratingChange, applied: false };
    }

    const config = IMPROVEMENT_CONFIG.marginOfVictory;
    const normalizedMargin = Math.min(margin, maxMargin) / maxMargin;
    const factor = config.minFactor + (1 - config.minFactor) * normalizedMargin;

    return {
        change: ratingChange * factor,
        applied: true,
        factor
    };
}

/**
 * Experience Scaling: Ajusta cambio según experiencia del jugador
 */
export function applyExperienceScaling(
    ratingChange: number,
    playerGames: number
): { change: number; applied: boolean; factor?: number } {
    if (!IMPROVEMENT_CONFIG.experienceScaling.enabled) {
        return { change: ratingChange, applied: false };
    }

    const tiers = IMPROVEMENT_CONFIG.experienceScaling.tiers;

    for (let i = 0; i < tiers.length; i++) {
        if (playerGames < tiers[i].games) {
            const factor = tiers[i].factor;
            return {
                change: ratingChange * factor,
                applied: true,
                factor
            };
        }
    }

    // Último tier para veteranos
    const lastTier = tiers[tiers.length - 1];
    return {
        change: ratingChange * lastTier.factor,
        applied: true,
        factor: lastTier.factor
    };
}

/**
 * Streak Protection: Reduce pérdidas en rachas perdedoras
 */
export function applyStreakProtection(
    ratingChange: number,
    consecutiveLosses: number | undefined,
    consecutiveWins: number | undefined,
    isWin: boolean
): { change: number; applied: boolean; factor?: number } {
    if (!IMPROVEMENT_CONFIG.streakProtection.enabled) {
        return { change: ratingChange, applied: false };
    }

    // Protección contra rachas perdedoras
    if (!isWin && consecutiveLosses !== undefined && consecutiveLosses > 0) {
        const reductions = IMPROVEMENT_CONFIG.streakProtection.lossReduction;

        for (let i = reductions.length - 1; i >= 0; i--) {
            if (consecutiveLosses >= reductions[i].streak) {
                const factor = reductions[i].factor;
                // Reducir la pérdida (ratingChange es negativo)
                return {
                    change: ratingChange * factor,
                    applied: true,
                    factor
                };
            }
        }
    }

    // Bonus por rachas ganadoras
    if (isWin && consecutiveWins !== undefined && consecutiveWins > 0) {
        const bonuses = IMPROVEMENT_CONFIG.streakProtection.winBonus;

        for (let i = bonuses.length - 1; i >= 0; i--) {
            if (consecutiveWins >= bonuses[i].streak) {
                const factor = bonuses[i].factor;
                return {
                    change: ratingChange * factor,
                    applied: true,
                    factor
                };
            }
        }
    }

    return { change: ratingChange, applied: false };
}

/**
 * Team Result Modifier: Garantiza que el resultado del equipo afecte el ELO
 * 
 * REGLA PRINCIPAL:
 * - Si tu equipo GANA → siempre ganas ELO (mínimo +1)
 * - Si tu equipo PIERDE → siempre pierdes ELO (mínimo -1)
 * 
 * El cambio se escala según tu rendimiento relativo:
 * - Mejor performance = más ganancia/menos pérdida
 * - Peor performance = menos ganancia/más pérdida
 */
export function applyTeamResultModifier(
    ratingChange: number,
    teamWon: boolean | undefined,
    gameType: string | undefined,
    performanceRank: number | undefined  // 0.0 = peor del server, 1.0 = mejor del server
): { change: number; applied: boolean; reason?: string } {
    const config = IMPROVEMENT_CONFIG.teamResultModifier;

    if (!config.enabled) {
        return { change: ratingChange, applied: false };
    }

    // Solo aplica a juegos por equipos
    if (!gameType || !config.applicableGameTypes.includes(gameType.toLowerCase())) {
        return { change: ratingChange, applied: false };
    }

    // Si no sabemos el resultado del equipo, no modificar
    if (teamWon === undefined) {
        return { change: ratingChange, applied: false };
    }

    // Performance rank por defecto = 0.5 (medio)
    const perfRank = performanceRank ?? 0.5;

    if (teamWon) {
        // EQUIPO GANÓ - Garantizar que siempre gane ELO (excepto si performance es muy mala)
        if (ratingChange <= 0) {
            // El sistema base dice que perdería ELO, pero su equipo ganó
            // Si performance < 10%, no garantizar ganancia mínima
            const minGain = perfRank < 0.1 ? 0 : config.winnerMinElo;
            const baseGain = Math.abs(ratingChange) * 0.5;
            const scaledGain = Math.max(minGain, baseGain * (0.5 + perfRank * 0.5));

            // Si la ganancia es 0, no aplicar el modificador
            if (scaledGain === 0) {
                return { change: 0, applied: true, reason: `Tu equipo ganó pero tu rendimiento fue muy bajo (${(perfRank * 100).toFixed(0)}%), no sumaste ELO` };
            }

            return {
                change: Math.ceil(scaledGain),
                applied: true,
                reason: `Tu equipo ganó y tu rendimiento fue de ${(perfRank * 100).toFixed(0)}%, sumaste +${Math.ceil(scaledGain)}`
            };
        } else {
            // Ya iba a ganar ELO, escalar según performance
            const scaleFactor = 0.7 + perfRank * (config.winnerMaxFactor - 0.7);
            const newChange = ratingChange * scaleFactor;

            if (Math.abs(newChange - ratingChange) < 1) {
                return { change: ratingChange, applied: false };
            }

            return {
                change: Math.round(newChange),
                applied: true,
                reason: `Tu equipo ganó y tu rendimiento fue de ${(perfRank * 100).toFixed(0)}%, eso te dio un x${scaleFactor.toFixed(2)}`
            };
        }
    } else {
        // EQUIPO PERDIÓ
        // EXCEPCIÓN: Si tuvo performance excepcional (top 15%), puede ganar un poco
        const exceptionalThreshold = config.exceptionalPerformanceThreshold || 0.85;
        const exceptionalBonus = config.exceptionalPerformanceBonus || 5;

        if (perfRank >= exceptionalThreshold) {
            // MVP en derrota: protegido con 0 ELO (no gana ni pierde)
            return {
                change: 0,
                applied: true,
                reason: `Tu equipo perdió pero fuiste el mejor jugador (${(perfRank * 100).toFixed(0)}%), tu ELO fue protegido`
            };
        }

        // Caso normal: equipo perdió, debe perder ELO
        if (ratingChange >= 0) {
            // El sistema base dice que ganaría ELO, pero su equipo perdió
            // Darle una pérdida mínima según su performance
            const minLoss = config.loserMinElo;
            const baseLoss = Math.abs(ratingChange) * 0.5; // 50% de lo que habría ganado como base
            const scaledLoss = Math.max(Math.abs(minLoss), baseLoss * (0.5 + (1 - perfRank) * 0.5));

            return {
                change: -Math.ceil(scaledLoss),
                applied: true,
                reason: `Tu equipo perdió, perdiste -${Math.ceil(scaledLoss)} ELO (tu rendimiento: ${(perfRank * 100).toFixed(0)}%)`
            };
        } else {
            // Ya iba a perder ELO, escalar según performance (mejor perf = menos pérdida)
            const scaleFactor = 0.7 + (1 - perfRank) * (config.loserMaxFactor - 0.7);
            const newChange = ratingChange * scaleFactor;

            if (Math.abs(newChange - ratingChange) < 1) {
                return { change: ratingChange, applied: false };
            }

            return {
                change: Math.round(newChange),
                applied: true,
                reason: `Tu equipo perdió, tu rendimiento fue de ${(perfRank * 100).toFixed(0)}% (x${scaleFactor.toFixed(2)})`
            };
        }
    }
}


/**
 * Quit Penalty: Castigo severo por abandonar la partida
 */
export function applyQuitPenalty(
    ratingChange: number,
    hasQuit: boolean | undefined,
    gameType: string | undefined
): { change: number; applied: boolean; factor?: number } {
    // En Duel, el castigo ya viene dado por performance = -1 (según QLStats)
    // No aplicar castigo doble x2
    if (gameType?.toLowerCase() === 'duel') {
        return { change: ratingChange, applied: false };
    }

    if (!IMPROVEMENT_CONFIG.quitPenalty.enabled || !hasQuit) {
        return { change: ratingChange, applied: false };
    }

    const config = IMPROVEMENT_CONFIG.quitPenalty;

    // El cambio siempre debe ser negativo (pérdida)
    // Si por alguna razón Glicko calculó ganancia (raro en quit), forzar a negativo
    let baseChange = ratingChange > 0 ? -ratingChange : ratingChange;
    if (baseChange === 0) baseChange = -10; // Castigo base si era 0

    // Aplicar factor
    let newChange = baseChange * config.penaltyFactor;

    // Asegurar castigo mínimo
    if (Math.abs(newChange) < config.minPenalty) {
        newChange = -config.minPenalty;
    }

    return {
        change: Math.round(newChange),
        applied: true,
        factor: config.penaltyFactor
    };
}

// ============================================
// FUNCIÓN PRINCIPAL DE AJUSTE
// ============================================

/**
 * Aplica todas las mejoras de rating en orden
 * 
 * @param originalChange Cambio de rating calculado por Glicko-1
 * @param context Contexto del partido (ratings, juegos, etc.)
 * @returns Cambio ajustado con detalle de todos los ajustes aplicados
 */
// Constantes de límites (como QLStats/XonStat)
// MAX_ELO_CHANGE removido - sin limite de cambio por partida
const MIN_ELO_FLOOR = 300;  // ELO mínimo absoluto

export function applyRatingImprovements(
    originalChange: number,
    context: RatingContext
): RatingAdjustment {
    const adjustments: RatingAdjustment['adjustments'] = [];
    let currentChange = originalChange;
    const ratingDiff = context.playerRating - context.opponentRating;

    // 1. Loss Forgiveness (solo para pérdidas)
    if (!context.isWin) {
        const lf = applyLossForgiveness(currentChange, ratingDiff, context.isWin);
        if (lf.applied) {
            adjustments.push({
                type: 'Loss Forgiveness',
                factor: lf.change / (currentChange || 1),
                reason: `Tenías ${Math.round(ratingDiff)} puntos más que tu rival, así que la pérdida se limitó a -${lf.maxLoss}`
            });
            currentChange = lf.change;
        }
    }

    // 2. Upset Bonus (solo para victorias del underdog)
    if (context.isWin) {
        const ub = applyUpsetBonus(currentChange, ratingDiff, context.isWin);
        if (ub.applied) {
            adjustments.push({
                type: 'Upset Bonus',
                factor: ub.bonus!,
                reason: `Tu rival tenía ${Math.round(Math.abs(ratingDiff))} puntos más, ganaste un +${Math.round((ub.bonus! - 1) * 100)}% extra por vencerlo`
            });
            currentChange = ub.change;
        }
    }

    // 3. Anti-Farming (solo para victorias del favorito)
    if (context.isWin) {
        const af = applyAntiFarming(currentChange, ratingDiff, context.isWin);
        if (af.applied) {
            adjustments.push({
                type: 'Anti-Farming',
                factor: af.reduction!,
                reason: `Tu rival era mucho más débil, se redujo un ${Math.round((1 - af.reduction!) * 100)}% lo que ganaste`
            });
            currentChange = af.change;
        }
    }

    // 4. Margin of Victory
    if (context.marginOfVictory !== undefined && context.maxScore !== undefined) {
        const mov = applyMarginOfVictory(currentChange, context.marginOfVictory, context.maxScore);
        if (mov.applied) {
            const percentage = Math.round(mov.factor! * 100);
            adjustments.push({
                type: 'Margin of Victory',
                factor: mov.factor!,
                reason: `El marcador fue ${context.marginOfVictory} de ${context.maxScore}, se aplicó el ${percentage}% del cambio`
            });
            currentChange = mov.change;
        }
    }

    // 5. Experience Scaling
    const es = applyExperienceScaling(currentChange, context.playerGames);
    if (es.applied && es.factor !== 1.0) {
        const percentage = Math.round(es.factor! * 100);
        adjustments.push({
            type: 'Experience Scaling',
            factor: es.factor!,
            reason: `Llevas ${context.playerGames} partidas, tu ELO se mueve un ${percentage}% de lo normal`
        });
        currentChange = es.change;
    }

    // 6. Streak Protection
    const sp = applyStreakProtection(
        currentChange,
        context.consecutiveLosses,
        context.consecutiveWins,
        context.isWin
    );
    if (sp.applied) {
        const streak = context.isWin ? context.consecutiveWins : context.consecutiveLosses;
        const type = context.isWin ? 'Win Streak Bonus' : 'Loss Streak Protection';
        adjustments.push({
            type,
            factor: sp.factor!,
            reason: context.isWin
                ? `Llevas ${streak} victorias seguidas, ganaste ELO extra`
                : `Llevas ${streak} derrotas seguidas, la pérdida fue suavizada`
        });
        currentChange = sp.change;
    }

    // 7. Team Result Modifier (NUEVO - Garantiza que resultado del equipo afecte ELO)
    const trm = applyTeamResultModifier(
        currentChange,
        context.teamWon,
        context.gameType,
        context.performanceRank
    );
    if (trm.applied) {
        adjustments.push({
            type: 'Team Result',
            factor: trm.change / (currentChange || 1),
            reason: trm.reason || 'Ajuste por resultado del equipo'
        });
        currentChange = trm.change;
    }

    // 8. Quit Penalty (Castigo por abandonar)
    // Duel excluido dentro de la función
    const qp = applyQuitPenalty(currentChange, context.hasQuit, context.gameType);
    if (qp.applied) {
        adjustments.push({
            type: 'Quit Penalty',
            factor: qp.factor!,
            reason: `Abandonaste la partida, la penalización fue de x${qp.factor}`
        });
        currentChange = qp.change;
    }

    // ============================================
    // 9. REGLA FUNDAMENTAL: GANADORES SIEMPRE GANAN ELO
    // ============================================
    // En juegos de equipo: si tu equipo ganó, DEBES ganar ELO (mínimo +1)
    // Esto es como funciona QLStats/XonStat
    if (context.teamWon === true && currentChange <= 0) {
        const minGain = 1;
        adjustments.push({
            type: 'Winner Guarantee',
            factor: 1,
            reason: `Equipo ganó: forzando mínimo +${minGain} (era ${currentChange})`
        });
        currentChange = minGain;
    }

    // ============================================
    // 11. FLOOR: No permitir que ELO baje de 300
    // ============================================
    const projectedRating = context.playerRating + currentChange;
    if (projectedRating < MIN_ELO_FLOOR) {
        const maxLoss = context.playerRating - MIN_ELO_FLOOR;
        if (maxLoss > 0) {
            currentChange = -maxLoss;
            adjustments.push({
                type: 'Floor Protection',
                factor: 1,
                reason: `ELO no puede bajar de ${MIN_ELO_FLOOR} (limitando pérdida a -${maxLoss})`
            });
        } else {
            currentChange = 0;
            adjustments.push({
                type: 'Floor Protection',
                factor: 0,
                reason: `ELO ya en mínimo (${MIN_ELO_FLOOR}), sin cambio`
            });
        }
    }

    return {
        originalChange,
        adjustedChange: Math.round(currentChange),
        adjustments
    };
}

// ============================================
// UTILIDADES
// ============================================

/**
 * Calcula el margen de victoria para diferentes tipos de juego
 */
export function calculateMarginOfVictory(
    score1: number,
    score2: number,
    gameType: string
): { margin: number; maxMargin: number } | null {
    const gt = gameType.toLowerCase();

    if (gt === 'ca') {
        // CA: diferencia de rondas, máximo típico 8
        return { margin: Math.abs(score1 - score2), maxMargin: 8 };
    }

    if (gt === 'duel') {
        // Duel: diferencia de frags, máximo típico 15-20
        return { margin: Math.abs(score1 - score2), maxMargin: 15 };
    }

    if (gt === 'ctf') {
        // CTF: diferencia de caps, máximo típico 5-8
        return { margin: Math.abs(score1 - score2), maxMargin: 5 };
    }

    if (gt === 'tdm') {
        // TDM: diferencia de frags, máximo típico 30
        return { margin: Math.abs(score1 - score2), maxMargin: 30 };
    }

    if (gt === 'ffa') {
        // FFA: diferencia de frags con el segundo lugar
        return { margin: Math.abs(score1 - score2), maxMargin: 20 };
    }

    return null;
}

