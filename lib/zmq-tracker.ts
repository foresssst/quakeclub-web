/**
 * Tracking Manual de Tiempo de Juego
 *
 * PLAY_TIME en ZMQ incluye warmup y tiempo de carga.
 * Este sistema trackea manualmente el tiempo real procesando:
 * - MATCH_STARTED: resetea timers
 * - PLAYER_CONNECT/DISCONNECT/SWITCHTEAM: trackea cambios de equipo
 * - ROUND_OVER: calcula tiempo por round (CA/FT/AD)
 * - MATCH_REPORT: usa playTimes calculados manualmente
 */

interface PlayerTrackingData {
  team: number;
  name: string;
  time: number;
  playTimes: [number, number, number];
  rounds: Record<number, number>;
  quit: boolean;
  dead: boolean;
  lastMsg: number;
  completedMatch: boolean;
}

interface RoundStats {
  teamWon: number;
  roundLength: number;
  TEAMS: {
    1: string[];
    2: string[];
  };
}

export interface PlayTimeInfo {
  total: number;
  players: Record<string, [number, number, number]>;
}

export interface RoundCountInfo {
  total: number;
  players: Record<string, { r: number; b: number }>;
  roundsWon: Record<string, number>;
}

export class MatchTracker {
  private matchStartTime = 0;
  private matchDuration = 0;
  private players: Record<string, PlayerTrackingData> = {};
  private gameType: string | null = null;
  private factory: string | null = null;
  private round = 0;
  private roundStartTime = 0;
  private roundStats: RoundStats[] = [];
  private roundTimer: NodeJS.Timeout | null = null;
  private quitters: string[] = [];
  private playerStats: any[] = [];
  private serverType: string; // "public" | "competitive"

  constructor(serverType: string = 'public') {
    this.serverType = serverType;
  }

  processMessage(type: string, data: any): void {
    const now = Date.now();

    switch (type) {
      case 'MATCH_STARTED':
        this.onMatchStarted(data, now);
        break;

      case 'PLAYER_CONNECT':
        this.setPlayerTeam(data, 3, now);
        break;

      case 'PLAYER_DISCONNECT':
        const p1 = this.players[data.STEAM_ID];
        if (p1) {
          // No marcar como quitter si el jugador completó el match
          // (desconexión durante endgame/intermission no es un quit)
          if (!p1.completedMatch) {
            this.checkQuitter(data.STEAM_ID);
            this.updatePlayerPlayTime(p1, now);
            p1.quit = true;
          }
          p1.team = 3;
        }
        break;

      case 'PLAYER_SWITCHTEAM':
        const p2 = this.players[data.KILLER?.STEAM_ID];
        if (p2) {
          this.updatePlayerPlayTime(p2, now);
          if ([3, 'SPECTATOR'].includes(data.KILLER.TEAM) && !p2.completedMatch) {
            this.checkQuitter(data.KILLER.STEAM_ID);
          }
          this.setPlayerTeam(data.KILLER, undefined, now);
        }
        break;

      case 'PLAYER_KILL':
        this.setPlayerTeam(data.KILLER, undefined, now).dead = false;
        this.setPlayerTeam(data.VICTIM, undefined, now);
        break;

      case 'PLAYER_DEATH':
        this.setPlayerTeam(data.VICTIM, undefined, now).dead = true;
        break;

      case 'ROUND_OVER':
        this.onRoundOver(data, now);
        break;

      case 'PLAYER_STATS':
        // Ignorar estadísticas fuera de un match activo.
        // Esto evita arrastrar PLAYER_STATS tardíos del intermission o del match anterior.
        if (!this.matchStartTime) {
          break;
        }

        // Solo guardar estadísticas que NO son warmup
        if (!data.WARMUP) {
          this.playerStats.push(data);
          // Marcar jugadores que completaron el match (QUIT=0/false)
          // PLAYER_STATS con QUIT=0 se envía al final del match para jugadores conectados
          const statsSteamId = String(data.STEAM_ID || '');
          if (statsSteamId && !data.QUIT && this.players[statsSteamId]) {
            this.players[statsSteamId].completedMatch = true;
          }
        }
        break;

      case 'MATCH_REPORT':
        // Procesar y enviar el partido al API
        this.onMatchReport(data, now);
        break;
    }
  }

  private async onMatchReport(matchReport: any, now: number): Promise<void> {
    const matchId = matchReport.MATCH_GUID;

    // Validación temprana: ignorar matches sin ID
    if (!matchId) {
      console.log('[Tracker] ⚠️ Match sin MATCH_GUID, ignorando');
      return;
    }

    // Obtener datos finales del partido ANTES de validar
    const matchData = this.getMatchData(matchReport);

    // ═══════════════════════════════════════════════════════════════
    // FILTROS DE MATCHES INVÁLIDOS - No enviar al API
    // ═══════════════════════════════════════════════════════════════

    // 1. Match ABORTED por Shutdown con 0 jugadores = servidor reiniciado
    if (matchReport.ABORTED && matchReport.EXIT_MSG === 'Shutdown') {
      if (matchData.playerStats.length === 0) {
        // Ignorar silenciosamente - es un reinicio de servidor
        return;
      }
    }

    // 2. Match sin jugadores válidos
    if (matchData.playerStats.length === 0) {
      // Ignorar silenciosamente
      return;
    }

    // 3. Match con scores 0-0 y ABORTED (warmup interrumpido, etc.)
    if (matchReport.ABORTED && matchReport.TSCORE0 === 0 && matchReport.TSCORE1 === 0) {
      // Ignorar silenciosamente
      return;
    }

    // ═══════════════════════════════════════════════════════════════
    // Match válido - Enviar al API
    // ═══════════════════════════════════════════════════════════════

    const serverBadge = this.serverType === 'competitive' ? '🏆 LIGA' : '🎮 PÚBLICO';
    console.log(`[Tracker] 📤 ${serverBadge} match ${matchId}: ${matchReport.MAP} (${matchReport.GAME_TYPE}) - ${matchData.playerStats.length} jugadores`);

    // Preparar payload en formato ZMQ para el API
    const payload = {
      ...matchReport,
      PLAYERS: matchData.playerStats,
      PLAY_TIMES: matchData.playTimes,
      ROUND_COUNT: matchData.roundCount,
      QUITTERS: matchData.quitters,
      SERVER_TYPE: this.serverType, // "public" | "competitive"
    };

    try {
      const apiKey = process.env.MINQLX_API_KEY;
      if (!apiKey) {
        console.error('[Tracker] ❌ MINQLX_API_KEY no configurada');
        return;
      }

      const response = await fetch('http://localhost:3000/api/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        // Solo loggear errores que no sean duplicados (ya manejados silenciosamente)
        if (!errorText.includes('race condition') && !errorText.includes('already processed')) {
          console.error(`[Tracker] ❌ Error API ${response.status}:`, errorText);
        }
      } else {
        const result = await response.json();
        console.log(`[Tracker] ✅ Match ${matchId} guardado`);
      }
    } catch (error) {
      console.error('[Tracker] ❌ Error de red:', error);
    }
  }

  private onMatchStarted(data: any, now: number): void {
    this.matchStartTime = now;
    this.matchDuration = 0;
    this.gameType = (data.GAME_TYPE || '').toLowerCase() || null;
    this.factory = (data.FACTORY || '').toLowerCase() || null;

    // Resetear todos los jugadores
    Object.keys(this.players).forEach(steamid => {
      const p = this.players[steamid];
      p.time = now;
      p.playTimes = [0, 0, 0];
      p.rounds = {};
      p.dead = false;
      p.completedMatch = false;
    });

    this.round = 1;
    this.roundStartTime = now;
    this.roundStats = [];
    this.quitters = [];
    this.playerStats = [];

    // Instantánea inicial después de "prepare to fight!" (10 segundos)
    if (this.roundTimer) clearTimeout(this.roundTimer);
    this.roundTimer = setTimeout(() => this.roundSnapshot(), 10000);
  }

  private onRoundOver(data: any, now: number): void {
    const duration = Math.round((now - this.roundStartTime) / 1000);

    const roundStats: RoundStats = {
      teamWon: data.TEAM_WON,
      roundLength: duration,
      TEAMS: { 1: [], 2: [] },
    };

    if (this.matchStartTime) {
      this.roundStats.push(roundStats);
    }

    this.matchDuration += duration;

    // Actualizar playTimes por round
    Object.keys(this.players).forEach(steamid => {
      const p = this.players[steamid];
      const team = p.rounds[this.round];
      if (team === 1 || team === 2) {
        p.playTimes[team] += duration;
        roundStats.TEAMS[team].push(steamid);
      }
      p.dead = false;
    });

    this.round++;
    this.roundStartTime = now;

    // Retraso entre rounds: FT=8s, otros=14s
    const roundDelay = this.gameType === 'ft' ? 8 : 14;
    if (this.roundTimer) clearTimeout(this.roundTimer);
    this.roundTimer = setTimeout(() => this.roundSnapshot(), roundDelay * 1000);
  }

  private checkQuitter(steamid: string): void {
    if (this.matchStartTime === 0) return;

    const p = this.players[steamid];
    if (!p || (p.team !== 1 && p.team !== 2)) return;

    // Contar jugadores por equipo
    const teamSize = [0, 0, 0, 0];
    Object.keys(this.players).forEach(sid => {
      teamSize[this.players[sid].team]++;
    });

    // No es quitter si sale del equipo más grande
    if (teamSize[p.team] > teamSize[3 - p.team]) return;

    // No es quitter si el otro equipo tiene 3+ jugadores más
    if (teamSize[p.team] + 3 <= teamSize[3 - p.team]) return;

    this.quitters.push(steamid);
  }

  private setPlayerTeam(
    playerData: any,
    overrideTeam: number | undefined,
    now: number
  ): PlayerTrackingData {
    const steamid = playerData.STEAM_ID;
    let player = this.players[steamid];

    if (!player) {
      player = {
        team: -1,
        time: now,
        rounds: {},
        quit: false,
        playTimes: [0, 0, 0],
        dead: false,
        name: '',
        lastMsg: now,
        completedMatch: false,
      };
      this.players[steamid] = player;
    }

    const teams = [0, 'FREE', 1, 'RED', 2, 'BLUE', 3, 'SPECTATOR'];
    const team = overrideTeam !== undefined ? overrideTeam : playerData.TEAM;
    player.team = Math.floor(teams.indexOf(team) / 2);
    player.name = playerData.NAME || player.name;
    player.quit = false;

    // Si el jugador vuelve a un equipo activo, revertir el quit
    if (player.team === 1 || player.team === 2) {
      const idx = this.quitters.indexOf(steamid);
      if (idx !== -1) {
        this.quitters.splice(idx, 1);
        console.log(`[Tracker] ${steamid} reconectó al equipo, quit revertido`);
      }
    }
    player.lastMsg = now;

    return player;
  }

  private updatePlayerPlayTime(p: PlayerTrackingData, now: number): void {
    if (!p || p.quit) return;

    // Para juegos round-based, el tiempo se actualiza en onRoundOver
    if (['ca', 'ft', 'ad'].includes(this.gameType || '')) return;

    // Para juegos no round-based, actualizar inmediatamente
    if (p.team >= 0 && p.team <= 2) {
      p.playTimes[p.team] += Math.round((now - p.time) / 1000);
    }

    p.time = now;
  }

  private roundSnapshot(): void {
    // Instantánea de jugadores que participan en este round
    Object.keys(this.players).forEach(steamid => {
      const p = this.players[steamid];
      if ((p.team === 1 || p.team === 2) && !p.quit) {
        p.rounds[this.round] = p.team;
        if (p.team !== p.rounds[this.round - 1]) {
          p.time = this.roundStartTime;
        }
      }
    });
  }

  /**
   * Obtiene datos finales del partido para enviar al API
   */
  getMatchData(matchReport: any): {
    playTimes?: PlayTimeInfo;
    roundCount?: RoundCountInfo;
    quitters: string[];
    playerStats: any[];
  } {
    const now = Date.now();

    // Actualizar playTimes finales
    Object.keys(this.players).forEach(steamid => {
      const p = this.players[steamid];
      this.updatePlayerPlayTime(p, now);
    });

    // Para juegos sin rounds
    if (this.round <= 1) {
      this.matchDuration = Math.round((now - this.matchStartTime) / 1000);
    }

    if (this.roundTimer) clearTimeout(this.roundTimer);

    const result = {
      playTimes: this.getPlayTimeInformation(),
      roundCount: this.getRoundsInformation(),
      quitters: this.quitters,
      playerStats: this.playerStats,
    };

    // Limpiar jugadores que quitearon o están inactivos por 2 horas
    Object.keys(this.players).forEach(steamid => {
      const p = this.players[steamid];
      if (p.quit || p.lastMsg + 2 * 3600 * 1000 < now) {
        delete this.players[steamid];
      }
    });

    // Resetear para próximo partido
    this.playerStats = [];
    this.matchStartTime = 0;

    return result;
  }

  private getRoundsInformation(): RoundCountInfo | undefined {
    if (!(this.matchStartTime && this.round > 1)) return undefined;

    const playerRounds: Record<string, { r: number; b: number }> = {};
    const roundsWon: Record<string, number> = {};

    Object.keys(this.players).forEach(steamid => {
      const p = this.players[steamid];
      const count = { r: 0, b: 0 };
      let wins = 0;

      Object.keys(p.rounds).forEach(roundStr => {
        const roundNum = parseInt(roundStr);
        const team = p.rounds[roundNum];
        if (team === 2) {
          count.b++;
        } else if (team === 1) {
          count.r++;
        }

        // Check if player's team won this round
        // roundStats array is 0-indexed, round numbers are 1-indexed
        const roundIndex = roundNum - 1;
        if (roundIndex >= 0 && roundIndex < this.roundStats.length) {
          const roundResult = this.roundStats[roundIndex];
          if (roundResult.teamWon === team) {
            wins++;
          }
        }
      });

      if (count.r || count.b) {
        playerRounds[steamid] = count;
        roundsWon[steamid] = wins;
      }
    });

    return { total: this.round - 1, players: playerRounds, roundsWon };
  }

  private getPlayTimeInformation(): PlayTimeInfo | undefined {
    if (!this.matchStartTime) return undefined;

    const playTimes: Record<string, [number, number, number]> = {};

    Object.keys(this.players).forEach(steamid => {
      const times = this.players[steamid].playTimes;
      if (times[0] + times[1] + times[2]) {
        playTimes[steamid] = times.slice() as [number, number, number];
      }
    });

    return { total: this.matchDuration, players: playTimes };
  }

  reset(): void {
    if (this.roundTimer) clearTimeout(this.roundTimer);
    this.matchStartTime = 0;
    this.matchDuration = 0;
    this.players = {};
    this.gameType = null;
    this.factory = null;
    this.round = 0;
    this.roundStartTime = 0;
    this.roundStats = [];
    this.quitters = [];
    this.playerStats = [];
  }
}
