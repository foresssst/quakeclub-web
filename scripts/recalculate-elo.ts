/**
 * ELO Recalculation Script - QuakeClub
 *
 * Recalculates ALL player ratings from match #1 using the current production
 * Glicko-1 system (rating-calculator.ts, performance.ts, rating-improvements.ts).
 *
 * What it does:
 *   1. Backs up current PlayerRating + SeasonRating + MapRating to JSON
 *   2. Deletes EloHistory, QuitRecord, PlayerRating, SeasonRating, MapRating
 *   3. Resets PlayerMatchStats ELO fields (eloBefore/eloAfter/etc.)
 *   4. Replays all SUCCESS matches chronologically using the production calculator
 *   5. Shows comparison stats + top players
 *
 * Data sources:
 *   - PLAY_TIMES: from Match.playTimes (new field) — historical matches use aliveTime fallback
 *   - ROUND_COUNT: from Match.roundCount (new field), or reconstructed from PlayerMatchStats.rounds
 *   - QUIT flag: from PlayerMatchStats.quit (new field) — historical matches default to false
 *   - RD decay: applied using real match timestamps (matchDate → getRatingPeriod)
 *
 * Usage:
 *   npx tsx scripts/recalculate-elo.ts              # Full recalculation
 *   npx tsx scripts/recalculate-elo.ts --dry-run    # Preview only, no changes
 *
 * Estimated time: ~20-40 minutes for ~9600 matches
 */

import { prisma } from '../lib/prisma';
import { calculateMatchRatings } from '../lib/rating-calculator';
import * as fs from 'fs';
import * as path from 'path';

const BATCH_SIZE = 200;
const PROGRESS_INTERVAL = 200;

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
  matchDate?: Date;
  mapName?: string;
}

interface LadderContext {
  serverType: string;
  seasonId: string | null;
  isOfficial: boolean;
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const startTime = Date.now();

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  QUAKECLUB - RECÁLCULO COMPLETO DE ELO (Glicko-1)');
  console.log(`  Modo: ${isDryRun ? 'DRY RUN (solo preview)' : '⚡ RECÁLCULO EN VIVO'}`);
  console.log(`  Fecha: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  // ── STEP 1: CURRENT STATE ──────────────────────────────────
  const totalMatches = await prisma.match.count({ where: { gameStatus: 'SUCCESS' } });
  const totalRatings = await prisma.playerRating.count();
  const totalHistory = await prisma.eloHistory.count();
  const totalSeasonRatings = await prisma.seasonRating.count();
  const totalMapRatings = await prisma.mapRating.count();
  const totalQuits = await prisma.quitRecord.count();
  const totalPMS = await prisma.playerMatchStats.count();

  const byGameType = await prisma.match.groupBy({
    by: ['gameType'],
    where: { gameStatus: 'SUCCESS' },
    _count: true,
    orderBy: { _count: { gameType: 'desc' } },
  });

  const dateRange = await prisma.match.aggregate({
    _min: { timestamp: true },
    _max: { timestamp: true },
    where: { gameStatus: 'SUCCESS' },
  });

  console.log('📊 ESTADO ACTUAL:');
  console.log(`   Matches (SUCCESS):  ${totalMatches.toLocaleString()}`);
  console.log(`   PlayerMatchStats:   ${totalPMS.toLocaleString()}`);
  console.log(`   PlayerRating:       ${totalRatings.toLocaleString()}`);
  console.log(`   EloHistory:         ${totalHistory.toLocaleString()}`);
  console.log(`   SeasonRating:       ${totalSeasonRatings.toLocaleString()}`);
  console.log(`   MapRating:          ${totalMapRatings.toLocaleString()}`);
  console.log(`   QuitRecord:         ${totalQuits.toLocaleString()}`);
  console.log(`   Rango fechas:       ${dateRange._min.timestamp?.toISOString().slice(0, 10)} → ${dateRange._max.timestamp?.toISOString().slice(0, 10)}`);
  console.log('');
  console.log('   Por modo:');
  for (const gt of byGameType) {
    console.log(`     ${gt.gameType.toUpperCase().padEnd(6)} ${gt._count.toLocaleString().padStart(6)} matches`);
  }
  console.log('');

  // ── DRY RUN MODE ───────────────────────────────────────────
  if (isDryRun) {
    console.log('🔍 DRY RUN - Mostrando primeros 10 matches que serían procesados:\n');
    const sampleMatches = await prisma.match.findMany({
      where: { gameStatus: 'SUCCESS' },
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
      take: 10,
      include: { PlayerMatchStats: { select: { steamId: true } } },
    });

    for (const m of sampleMatches) {
      const players = m.PlayerMatchStats.length;
      const score = `${m.team1Score ?? '?'}-${m.team2Score ?? '?'}`;
      console.log(
        `  ${m.timestamp.toISOString().slice(0, 19)} | ${m.gameType.padEnd(5)} | ${score.padEnd(6)} | ${players} jugadores | ${m.serverType} | ${m.factory || '?'}`
      );
    }
    console.log('  ...');
    console.log(`\n  Total: ${totalMatches} matches serían reprocesados.`);
    console.log('\n  Ejecuta sin --dry-run para recalcular.\n');
    await prisma.$disconnect();
    return;
  }

  // ── STEP 2: BACKUP ────────────────────────────────────────
  console.log('💾 RESPALDANDO ratings actuales...');

  const currentRatings = await prisma.playerRating.findMany({
    include: { Player: { select: { username: true, steamId: true } } },
  });
  const currentSeasonRatings = await prisma.seasonRating.findMany();
  const currentMapRatings = await prisma.mapRating.findMany();

  const backupData = {
    timestamp: new Date().toISOString(),
    description: 'Backup pre-recálculo de ELO',
    stats: {
      totalMatches,
      totalRatings,
      totalHistory,
      totalSeasonRatings,
      totalMapRatings,
      totalQuits,
    },
    playerRatings: currentRatings.map((r) => ({
      steamId: r.steamId,
      username: r.Player.username,
      gameType: r.gameType,
      ratingType: r.ratingType,
      rating: r.rating,
      deviation: r.deviation,
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
      totalGames: r.totalGames,
      lastPlayed: r.lastPlayed,
    })),
    seasonRatings: currentSeasonRatings,
    mapRatings: currentMapRatings,
  };

  const backupPath = path.resolve(__dirname, `elo-backup-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
  console.log(`   ✅ Backup guardado: ${backupPath}`);
  console.log(`   ${currentRatings.length} PlayerRating + ${currentSeasonRatings.length} SeasonRating + ${currentMapRatings.length} MapRating respaldados\n`);

  // ── STEP 3: RESET ─────────────────────────────────────────
  console.log('🗑️  LIMPIANDO datos de rating...');

  const deletedHistory = await prisma.eloHistory.deleteMany();
  console.log(`   EloHistory eliminados:     ${deletedHistory.count.toLocaleString()}`);

  const deletedQuits = await prisma.quitRecord.deleteMany();
  console.log(`   QuitRecord eliminados:     ${deletedQuits.count.toLocaleString()}`);

  const deletedRatings = await prisma.playerRating.deleteMany();
  console.log(`   PlayerRating eliminados:   ${deletedRatings.count.toLocaleString()}`);

  const deletedSeasonR = await prisma.seasonRating.deleteMany();
  console.log(`   SeasonRating eliminados:   ${deletedSeasonR.count.toLocaleString()}`);

  const deletedMapRatings = await prisma.mapRating.deleteMany();
  console.log(`   MapRating eliminados:      ${deletedMapRatings.count.toLocaleString()}`);

  // Reset PlayerMatchStats ELO fields
  const resetPMS = await prisma.playerMatchStats.updateMany({
    data: {
      eloBefore: null,
      eloAfter: null,
      eloDelta: null,
      rdBefore: null,
      rdAfter: null,
      performance: 0,
      statusMessage: null,
    },
  });
  console.log(`   PlayerMatchStats reseteados: ${resetPMS.count.toLocaleString()}`);
  console.log('');

  // ── STEP 4: REPLAY MATCHES ────────────────────────────────
  console.log('🔄 PROCESANDO matches cronológicamente...');
  console.log(`   Total a procesar: ${totalMatches.toLocaleString()}`);
  console.log('');

  let processed = 0;
  let errors = 0;
  let skippedValidation = 0;
  let cursor: string | undefined;

  // Suppress verbose per-match logging from rating-calculator
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  let verboseLogging = false;

  const suppressedLog = (...args: any[]) => {
    if (verboseLogging) originalConsoleLog(...args);
  };

  // Track errors for final report
  const errorDetails: Array<{ matchId: string; gameType: string; error: string }> = [];
  // Track per-gameType stats
  const processedByType: Record<string, number> = {};

  while (true) {
    // Load batch of matches ordered chronologically
    const queryArgs: any = {
      where: { gameStatus: 'SUCCESS' },
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
      take: BATCH_SIZE,
      include: {
        PlayerMatchStats: {
          select: {
            id: true,
            steamId: true,
            kills: true,
            deaths: true,
            score: true,
            team: true,
            aliveTime: true,
            damageDealt: true,
            damageTaken: true,
            participationPct: true,
            rounds: true,
            roundsWon: true,
            flagsCaptured: true,
            medalAssists: true,
            medalCaptures: true,
            quit: true,
          },
        },
      },
    };
    if (cursor) {
      queryArgs.skip = 1;
      queryArgs.cursor = { id: cursor };
    }
    const matches: any[] = await prisma.match.findMany(queryArgs);

    if (matches.length === 0) break;
    cursor = matches[matches.length - 1].id;

    for (const match of matches) {
      try {
        // Reconstruct MatchContext
        const matchContext: MatchContext = {
          matchId: match.id,
          gameType: match.gameType.toLowerCase(),
          matchDuration: match.duration || undefined,
          matchDate: match.timestamp, // Fecha real del match para RD decay correcto
          mapName: match.map || undefined,
        };

        // Reconstruct MatchPlayers from stored PlayerMatchStats
        const matchPlayers: MatchPlayer[] = match.PlayerMatchStats.map((p) => ({
          steamId: p.steamId,
          kills: p.kills,
          deaths: p.deaths,
          score: p.score,
          team: p.team ?? undefined,
          aliveTime: p.aliveTime ?? undefined,
          damageDealt: p.damageDealt ?? undefined,
          damageTaken: p.damageTaken ?? undefined,
          quit: p.quit ?? false,
          matchId: p.id, // PlayerMatchStats.id (for EloHistory + updating stats)
        }));

        // Reconstruct roundCount from Match.roundCount or PlayerMatchStats.rounds
        let reconstructedRoundCount: any = undefined;
        if (match.roundCount) {
          // New field available — use directly
          reconstructedRoundCount = match.roundCount as any;
        } else {
          // Historical fallback: reconstruct from per-player rounds/roundsWon
          const playersWithRounds = match.PlayerMatchStats.filter(
            (p: any) => p.rounds != null && p.rounds > 0
          );
          if (playersWithRounds.length > 0) {
            const maxRounds = Math.max(...playersWithRounds.map((p: any) => p.rounds || 0));
            const players: Record<string, { r: number; b: number }> = {};
            const roundsWon: Record<string, number> = {};
            for (const p of playersWithRounds) {
              // Without per-team breakdown, assign all rounds to the player's team
              if ((p as any).team === 1) {
                players[(p as any).steamId] = { r: (p as any).rounds || 0, b: 0 };
              } else if ((p as any).team === 2) {
                players[(p as any).steamId] = { r: 0, b: (p as any).rounds || 0 };
              } else {
                players[(p as any).steamId] = { r: (p as any).rounds || 0, b: 0 };
              }
              if ((p as any).roundsWon) {
                roundsWon[(p as any).steamId] = (p as any).roundsWon;
              }
            }
            reconstructedRoundCount = { total: maxRounds, players, roundsWon };
          }
        }

        // Reconstruct matchStats from Match fields
        const matchStats = {
          GAME_LENGTH: match.duration || 0,
          TSCORE0: match.team1Score || 0,
          TSCORE1: match.team2Score || 0,
          FRAG_LIMIT: match.fragLimit || 0,
          SCORE_LIMIT: match.scoreLimit || 0,
          ROUND_LIMIT: match.roundLimit || 0,
          EXIT_MSG: match.exitMessage || '',
          ABORTED: match.aborted || false,
          INFECTED: match.infected || false,
          QUADHOG: match.quadhog || false,
          TRAINING: match.training || false,
          INSTAGIB: match.instagib || false,
          FACTORY: match.factory || '',
          FACTORY_TITLE: match.factoryTitle || '',
          // Tracker data for team switch detection + performance time factor
          playTimes: (match.playTimes as any) || undefined,
          roundCount: reconstructedRoundCount,
        };

        // Reconstruct LadderContext
        const ladderContext: LadderContext = {
          serverType: match.serverType || 'public',
          seasonId: match.seasonId || null,
          isOfficial: match.isOfficial || false,
        };

        // Suppress internal logging for speed
        console.log = suppressedLog;
        console.error = suppressedLog as any;

        await calculateMatchRatings(matchContext, matchPlayers, matchStats, ladderContext);

        // Restore logging
        console.log = originalConsoleLog;
        console.error = originalConsoleError;

        processed++;
        processedByType[match.gameType] = (processedByType[match.gameType] || 0) + 1;
      } catch (err: any) {
        // Restore logging on error
        console.log = originalConsoleLog;
        console.error = originalConsoleError;

        errors++;
        const errorMsg = err?.message || String(err);
        errorDetails.push({
          matchId: match.matchId,
          gameType: match.gameType,
          error: errorMsg.slice(0, 200),
        });
      }

      // Progress report
      const total = processed + errors;
      if (total % PROGRESS_INTERVAL === 0 && total > 0) {
        // Restore logging for progress
        console.log = originalConsoleLog;

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const pct = ((total / totalMatches) * 100).toFixed(1);
        const rate = (total / ((Date.now() - startTime) / 1000)).toFixed(1);
        const eta = ((totalMatches - total) / parseFloat(rate)).toFixed(0);

        console.log(
          `   [${elapsed}s] ${total.toLocaleString()}/${totalMatches.toLocaleString()} (${pct}%) | ` +
            `${processed} ok, ${errors} err | ` +
            `${rate} matches/s | ETA: ${eta}s`
        );

        console.log = suppressedLog;
      }
    }
  }

  // Restore logging
  console.log = originalConsoleLog;
  console.error = originalConsoleError;

  // ── STEP 5: RESULTS ───────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  RECÁLCULO COMPLETO');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log(`  ⏱️  Tiempo total: ${elapsed}s`);
  console.log(`  ✅ Procesados:    ${processed.toLocaleString()}`);
  console.log(`  ❌ Errores:       ${errors}`);
  console.log('');

  // Procesados por tipo
  console.log('  Por modo:');
  for (const [gt, count] of Object.entries(processedByType).sort(([, a], [, b]) => b - a)) {
    console.log(`    ${gt.toUpperCase().padEnd(6)} ${count.toLocaleString().padStart(6)} matches procesados`);
  }
  console.log('');

  // New state
  const newRatings = await prisma.playerRating.count();
  const newHistory = await prisma.eloHistory.count();
  const newSeasonRatings = await prisma.seasonRating.count();
  const newMapRatings = await prisma.mapRating.count();
  const newQuits = await prisma.quitRecord.count();

  console.log('📊 NUEVO ESTADO:');
  console.log(`   PlayerRating:   ${newRatings.toLocaleString()} (antes: ${totalRatings.toLocaleString()})`);
  console.log(`   EloHistory:     ${newHistory.toLocaleString()} (antes: ${totalHistory.toLocaleString()})`);
  console.log(`   SeasonRating:   ${newSeasonRatings.toLocaleString()}`);
  console.log(`   MapRating:      ${newMapRatings.toLocaleString()} (antes: ${totalMapRatings.toLocaleString()})`);
  console.log(`   QuitRecord:     ${newQuits.toLocaleString()}`);
  console.log('');

  // Top players per game type
  for (const gt of ['ca', 'duel', 'ctf', 'ffa', 'tdm', 'dom']) {
    const topPlayers = await prisma.playerRating.findMany({
      where: { gameType: gt, ratingType: 'public' },
      orderBy: { rating: 'desc' },
      take: 10,
      include: { Player: { select: { username: true } } },
    });

    if (topPlayers.length > 0) {
      console.log(`  🏆 Top 10 ${gt.toUpperCase()} (Público):`);
      topPlayers.forEach((p, i) => {
        const name = p.Player.username.padEnd(20);
        const rating = Math.round(p.rating).toString().padStart(5);
        const rd = p.deviation.toFixed(0).padStart(4);
        const games = `${p.totalGames}G (${p.wins}W/${p.losses}L)`;
        console.log(`     ${(i + 1).toString().padStart(2)}. ${name} ${rating} ELO  RD:${rd}  ${games}`);
      });
      console.log('');
    }
  }

  // Ladder ratings if any
  const ladderRatings = await prisma.playerRating.findMany({
    where: { ratingType: 'ladder' },
    orderBy: { rating: 'desc' },
    take: 10,
    include: { Player: { select: { username: true } } },
  });

  if (ladderRatings.length > 0) {
    console.log('  🏆 Top 10 LADDER:');
    ladderRatings.forEach((p, i) => {
      const name = p.Player.username.padEnd(20);
      const rating = Math.round(p.rating).toString().padStart(5);
      console.log(`     ${(i + 1).toString().padStart(2)}. ${name} ${rating} ELO  (${p.gameType})`);
    });
    console.log('');
  }

  // Show errors if any
  if (errorDetails.length > 0) {
    console.log(`  ❌ ERRORES (${errorDetails.length}):`);
    const shown = errorDetails.slice(0, 20);
    for (const e of shown) {
      console.log(`     ${e.gameType.padEnd(5)} ${e.matchId.slice(0, 8)}... ${e.error.slice(0, 100)}`);
    }
    if (errorDetails.length > 20) {
      console.log(`     ... y ${errorDetails.length - 20} más`);
    }
    console.log('');
  }

  // Comparison with backup
  console.log('  📋 COMPARACIÓN (antes → después):');

  // Compare top CA players
  const oldTopCA = backupData.playerRatings
    .filter((r) => r.gameType === 'ca' && r.ratingType === 'public')
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5);

  const newTopCA = await prisma.playerRating.findMany({
    where: { gameType: 'ca', ratingType: 'public' },
    orderBy: { rating: 'desc' },
    take: 5,
    include: { Player: { select: { username: true, steamId: true } } },
  });

  if (oldTopCA.length > 0) {
    console.log('');
    console.log('     CA - Antes (top 5):');
    oldTopCA.forEach((p, i) => {
      console.log(`       ${i + 1}. ${p.username?.toString().padEnd(18)} ${Math.round(p.rating)} ELO (${p.totalGames}G)`);
    });
    console.log('     CA - Después (top 5):');
    newTopCA.forEach((p, i) => {
      console.log(`       ${i + 1}. ${p.Player.username.padEnd(18)} ${Math.round(p.rating)} ELO (${p.totalGames}G)`);
    });
  }

  console.log('');
  console.log(`  ✅ Backup disponible en: ${backupPath}`);
  console.log(`  💡 Para restaurar: npx tsx scripts/restore-elo-backup.ts ${path.basename(backupPath)}`);
  console.log('');
}

main()
  .catch((err) => {
    // Restore console if suppressed
    console.error('FATAL ERROR:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
