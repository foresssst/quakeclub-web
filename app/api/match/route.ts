import { NextRequest, NextResponse } from "next/server"
import { Weapon } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { calculateMatchRatings } from "@/lib/rating-calculator"
import { calculatePerformance } from "@/lib/performance"
import { getIdentifier, rateLimit } from "@/lib/rate-limit"
import { randomUUID } from "crypto"
import { cleanUsername } from "@/lib/quake-colors"
import { getSteamUserInfo } from "@/lib/steam-auth"
import { logAuditAsync } from "@/lib/audit"


// Constantes de validación y límites de seguridad
// Previenen ataques DoS y datos maliciosos del servidor de juego
const VALIDATION_LIMITS = {
  // Límites de strings
  MAX_PLAYER_NAME_LENGTH: 50,
  MAX_SERVER_NAME_LENGTH: 100,
  MAX_MAP_NAME_LENGTH: 50,
  MAX_MATCH_ID_LENGTH: 100,

  // Límites numéricos (valores razonables para Quake Live)
  MAX_KILLS: 1000,
  MAX_DEATHS: 1000,
  MAX_SCORE: 10000,
  MAX_DAMAGE: 100000,
  MAX_PLAY_TIME: 7200, // 2 horas en segundos
  MAX_MATCH_DURATION: 7200, // 2 horas en segundos
  MAX_ROUNDS: 200, // Para CA/FT con muchos rounds

  // Steam ID validation
  MIN_STEAM_ID_LENGTH: 17,
  MAX_STEAM_ID_LENGTH: 17,

  // Cantidad de jugadores
  MAX_PLAYERS_PER_MATCH: 32,
} as const

/**
 * Sanitiza una cadena de texto para prevenir inyección y ataques
 * 
 * @param str String a sanitizar
 * @param maxLength Longitud máxima permitida
 * @returns String sanitizado y truncado
 */
function sanitizeString(str: string | undefined | null, maxLength: number): string {
  if (!str || typeof str !== 'string') return ''

  // Truncar a longitud máxima
  let sanitized = str.slice(0, maxLength)

  // Eliminar caracteres de control (excepto \n y \t que pueden ser útiles)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  // Trim espacios
  return sanitized.trim()
}

/**
 * Valida que un Steam ID tenga formato correcto
 * 
 * @param steamId Steam ID a validar
 * @returns true si es válido, false si no
 */
function isValidSteamId(steamId: string | undefined | null): boolean {
  if (!steamId || typeof steamId !== 'string') return false

  // Steam ID64 tiene 17 dígitos y comienza con 7656119...
  if (steamId.length !== VALIDATION_LIMITS.MIN_STEAM_ID_LENGTH) return false
  if (!/^\d{17}$/.test(steamId)) return false
  if (!steamId.startsWith('7656119')) return false

  return true
}

/**
 * Valida y limita un valor numérico
 * 
 * @param value Valor a validar
 * @param min Valor mínimo permitido
 * @param max Valor máximo permitido
 * @param defaultValue Valor por defecto si es inválido
 * @returns Valor validado y limitado
 */
function validateNumber(
  value: any,
  min: number,
  max: number,
  defaultValue: number = 0
): number {
  if (typeof value !== 'number' || isNaN(value)) return defaultValue
  if (value < min) return min
  if (value > max) return max
  return Math.floor(value) // Asegurar que sea entero
}

// Tipos
interface MatchPlayer {
  steamId: string
  kills: number
  deaths: number
  score: number
  team?: number
  aliveTime?: number
  matchId?: string
}

interface MatchContext {
  matchId: string
  gameType: string
  matchDuration?: number
  mapName?: string
}

// Sistema de logs
const logger = {
  info: (msg: string, data?: any) => console.log(`[Match] ${msg}`, data || ""),
  warn: (msg: string, data?: any) => console.warn(`[Match] Advertencia: ${msg}`, data || ""),
  error: (msg: string, data?: any) => console.error(`[Match] Error: ${msg}`, data || ""),
  success: (msg: string, data?: any) => console.log(`[Match] Exito: ${msg}`, data || ""),
}

// Weapon statistics interface
interface WeaponStat {
  weapon: string
  kills: number
  hits: number
  shots: number
  damage: number
}

interface PlayerPayload {
  steamId: string
  playerName: string
  kills: number
  deaths: number
  damageDealt: number
  damageTaken: number
  score: number
  team?: number
  aliveTime: number
  quit?: boolean // QLStats quit detection (DUEL)
  weapons?: WeaponStat[]
  // Round-based game modes (CA, FT, AD)
  rounds?: number // Number of rounds participated
  roundsWon?: number // Number of rounds won
  // CTF específico
  flagsCaptured?: number
  flagsReturned?: number
  flagPicks?: number
  flagDrops?: number
  carrierTakedowns?: number
  // Medals
  medalAccuracy?: number
  medalAssists?: number
  medalCaptures?: number
  medalCombokill?: number
  medalDefends?: number
  medalExcellent?: number
  medalFirstfrag?: number
  medalHeadshot?: number
  medalHumiliation?: number
  medalImpressive?: number
  medalMidair?: number
  medalPerfect?: number
  medalPerforated?: number
  medalQuadgod?: number
  medalRampage?: number
  medalRevenge?: number
}

interface MatchPayload {
  // Metadata del match
  matchId: string // MATCH_GUID del servidor
  gameType: string
  map: string
  serverName: string
  timestamp: number // Unix timestamp
  duration?: number // Segundos

  // Array de jugadores
  players: PlayerPayload[]

  // Opcional: info de equipos
  teamScores?: {
    red?: number
    blue?: number
  }
}

/**
 * Agrega stats de múltiples PLAYER_STATS del mismo jugador
 * Un jugador puede cambiar de equipo y tener múltiples entries
 */
/**
 * Agrega las estadísticas de múltiples registros PLAYER_STATS del mismo jugador.
 * 
 * CRÍTICO: Filtra las estadísticas de warmup antes de agregar.
 * Los servidores de Quake envían múltiples registros PLAYER_STATS por jugador cuando:
 * - El jugador cambia de equipo
 * - Se producen eventos de warmup
 * 
 * SEGURIDAD: No confiar en PLAY_TIME de ZMQ (incluye warmup + carga).
 * Usar playTimes manuales del MatchTracker cuando estén disponibles.
 * 
 * @param players Array de registros PLAYER_STATS del reporte ZMQ
 * @returns Array de estadísticas agregadas por jugador (sin duplicados)
 */
function aggregatePlayerStats(players: any[]): any[] {
  const playerData: Record<string, any> = {};

  for (const p of players) {
    // CRÍTICO: Filtrar stats de warmup antes de procesar
    // Las stats de warmup contaminan los valores finales
    if (p.WARMUP === true) {
      continue; // Saltar este registro
    }

    const steamId = String(p.STEAM_ID || '');
    if (!steamId || steamId === '0') continue;

    if (!playerData[steamId]) {
      playerData[steamId] = {
        STEAM_ID: steamId,
        NAME: p.NAME || 'Unknown',
        TEAM: p.TEAM,
        KILLS: 0,
        DEATHS: 0,
        SCORE: 0,
        DAMAGE: { DEALT: 0, TAKEN: 0 },
        PLAY_TIME: 0, // NOTA: No usado para cálculos, se usan playTimes manuales
        QUIT: false,
        WARMUP: false, // Ya filtramos warmup arriba
        ABORTED: p.ABORTED,
        MEDALS: {},
        WEAPONS: {},
        RED_FLAG_PICKUPS: 0,
        BLUE_FLAG_PICKUPS: 0,
        NEUTRAL_FLAG_PICKUPS: 0,
      };
    }

    const pd = playerData[steamId];

    // Agregar stats (solo de registros no-warmup)
    pd.KILLS += p.KILLS || 0;
    pd.DEATHS += p.DEATHS || 0;
    pd.SCORE += p.SCORE || 0;
    pd.DAMAGE.DEALT += p.DAMAGE?.DEALT || 0;
    pd.DAMAGE.TAKEN += p.DAMAGE?.TAKEN || 0;
    // PLAY_TIME se agrega pero NO se usa para cálculos (incluye warmup)
    // Se usan playTimes manuales del MatchTracker
    pd.PLAY_TIME += p.PLAY_TIME || 0;
    // FIX: QUIT=0 es sticky - significa que el jugador completó el match
    // Cuando un jugador se desconecta o cambia de equipo, QL envía PLAYER_STATS
    // con QUIT=1 para esa "sesión". Si vuelve, al final del match envía QUIT=0.
    // Si luego se desconecta durante el endgame, QL envía otro QUIT=1.
    // QUIT=0 (match completado) tiene prioridad: no permitir que QUIT=1 lo sobreescriba.
    if (p.QUIT !== undefined) {
      const isQuit = Boolean(p.QUIT);
      if (!pd._matchCompleted) {
        pd.QUIT = isQuit;
        if (!isQuit) {
          pd._matchCompleted = true;
        }
      }
      // Si ya completó el match (QUIT=0 visto), ignorar QUIT=1 posteriores (endgame disconnect)
    }

    // Agregar medals
    if (p.MEDALS) {
      for (const [key, value] of Object.entries(p.MEDALS)) {
        pd.MEDALS[key] = (pd.MEDALS[key] || 0) + (value as number);
      }
    }

    // Agregar weapon stats
    if (p.WEAPONS) {
      for (const [weapon, stats] of Object.entries(p.WEAPONS)) {
        if (!pd.WEAPONS[weapon]) {
          pd.WEAPONS[weapon] = { K: 0, H: 0, S: 0, DG: 0 };
        }
        const ws = stats as any;
        pd.WEAPONS[weapon].K += ws.K || 0;
        pd.WEAPONS[weapon].H += ws.H || 0;
        pd.WEAPONS[weapon].S += ws.S || 0;
        pd.WEAPONS[weapon].DG += ws.DG || 0;
      }
    }

    // Agregar CTF stats (vienen directamente en el player, no en un campo CTF)
    pd.RED_FLAG_PICKUPS += p.RED_FLAG_PICKUPS || 0;
    pd.BLUE_FLAG_PICKUPS += p.BLUE_FLAG_PICKUPS || 0;
    pd.NEUTRAL_FLAG_PICKUPS += p.NEUTRAL_FLAG_PICKUPS || 0;

    // El último TEAM es el que cuenta (el jugador terminó en este equipo)
    if (p.TEAM !== undefined) {
      pd.TEAM = p.TEAM;
    }
  }

  return Object.values(playerData);
}

function getTrackerSteamIds(zmqData: any): Set<string> {
  const trackerSteamIds = new Set<string>();

  const roundPlayers = zmqData.ROUND_COUNT?.players;
  if (roundPlayers && typeof roundPlayers === 'object') {
    Object.keys(roundPlayers).forEach((steamId) => {
      if (isValidSteamId(steamId)) {
        trackerSteamIds.add(steamId);
      }
    });
  }

  const playTimePlayers = zmqData.PLAY_TIMES?.players;
  if (playTimePlayers && typeof playTimePlayers === 'object') {
    Object.keys(playTimePlayers).forEach((steamId) => {
      if (isValidSteamId(steamId)) {
        trackerSteamIds.add(steamId);
      }
    });
  }

  return trackerSteamIds;
}

// Parser de datos ZMQ nativos (MATCH_REPORT)
/**
 * Parsea y valida un reporte de match en formato ZMQ
 * 
 * SEGURIDAD: Valida todos los campos antes de procesarlos para prevenir
 * inyección de datos maliciosos y ataques DoS.
 * 
 * @param zmqData Datos crudos del reporte ZMQ
 * @returns Payload validado y sanitizado
 * @throws Error si los datos son inválidos o incompletos
 */
function parseZmqMatchReport(zmqData: any): MatchPayload {
  logger.info("Parseando MATCH_REPORT...")

  // Validación básica - campos requeridos
  if (!zmqData.MATCH_GUID || !zmqData.GAME_TYPE || !zmqData.MAP) {
    throw new Error("Datos ZMQ incompletos: falta MATCH_GUID, GAME_TYPE o MAP")
  }

  const rawPlayers = Array.isArray(zmqData.PLAYERS) ? zmqData.PLAYERS : []

  if (rawPlayers.length > VALIDATION_LIMITS.MAX_PLAYERS_PER_MATCH) {
    logger.warn(
      `Match con ${rawPlayers.length} PLAYER_STATS crudos. Se agruparán antes de aplicar el límite de ${VALIDATION_LIMITS.MAX_PLAYERS_PER_MATCH}`
    )
  }

  // Validar cada jugador antes de agregar
  logger.info(`Total jugadores en zmqData: ${rawPlayers.length}`)

  const validPlayers = rawPlayers.filter((p: any) => {
    // Validar Steam ID
    if (!isValidSteamId(p.STEAM_ID)) {
      logger.warn(`Jugador con Steam ID inválido ignorado: ${p.STEAM_ID}`)
      return false
    }

    // Validar valores numéricos
    if (typeof p.KILLS !== 'number' || typeof p.DEATHS !== 'number') {
      logger.warn(`Jugador ${p.STEAM_ID} con datos numéricos inválidos (KILLS: ${typeof p.KILLS}, DEATHS: ${typeof p.DEATHS})`)
      return false
    }

    logger.info(`✓ Jugador válido: ${p.STEAM_ID}`)
    return true
  })

  logger.info(`Jugadores válidos: ${validPlayers.length} de ${rawPlayers.length}`)

  // Si no hay jugadores válidos, retornar payload vacío
  // La validación principal lo manejará silenciosamente
  if (validPlayers.length === 0) {
    return {
      matchId: sanitizeString(zmqData.MATCH_GUID, 40),
      gameType: sanitizeString(zmqData.GAME_TYPE, 20).toLowerCase(),
      map: sanitizeString(zmqData.MAP, 50).toLowerCase(),
      duration: typeof zmqData.GAME_LENGTH === 'number' ? zmqData.GAME_LENGTH : 0,
      teamScores: { red: 0, blue: 0 },
      players: [], // Vacío - será manejado silenciosamente
    }
  }

  // Agregar stats de jugadores que cambiaron de equipo (ya filtra warmup)
  const aggregatedPlayers = aggregatePlayerStats(validPlayers)

  // Extraer ROUND_COUNT para rounds y roundsWon
  const roundCount = zmqData.ROUND_COUNT
  const playTimes = zmqData.PLAY_TIMES
  const roundsData: Record<string, { rounds: number; roundsWon: number }> = {}

  if (roundCount && roundCount.players) {
    logger.info(`ROUND_COUNT recibido: total=${roundCount.total}, players=${Object.keys(roundCount.players).length}`)
    Object.keys(roundCount.players).forEach(steamId => {
      const playerRounds = roundCount.players[steamId]
      const totalRounds = (playerRounds.r || 0) + (playerRounds.b || 0)
      const roundsWon = roundCount.roundsWon?.[steamId] || 0
      roundsData[steamId] = { rounds: totalRounds, roundsWon }
      logger.info(`Player ${steamId}: rounds=${totalRounds}, roundsWon=${roundsWon}`)
    })
  } else {
    logger.info('No ROUND_COUNT data (non-round-based game mode)')
  }

  const trackerSteamIds = getTrackerSteamIds(zmqData)
  let filteredPlayers = aggregatedPlayers

  if (trackerSteamIds.size > 0) {
    const trackerFilteredPlayers = aggregatedPlayers.filter((p: any) =>
      trackerSteamIds.has(String(p.STEAM_ID || ''))
    )

    const removed = aggregatedPlayers.length - trackerFilteredPlayers.length
    if (removed > 0) {
      logger.warn(
        `Se filtraron ${removed} jugador(es) no presentes en ROUND_COUNT/PLAY_TIMES para evitar contaminación de PLAYER_STATS`
      )
    }

    if (trackerFilteredPlayers.length > 0) {
      filteredPlayers = trackerFilteredPlayers
    } else {
      logger.warn('ROUND_COUNT/PLAY_TIMES no coincidieron con PLAYER_STATS; usando agregado completo como fallback')
    }
  }

  if (filteredPlayers.length > VALIDATION_LIMITS.MAX_PLAYERS_PER_MATCH) {
    logger.warn(
      `Match con ${filteredPlayers.length} jugadores únicos excede límite de ${VALIDATION_LIMITS.MAX_PLAYERS_PER_MATCH}; se truncará después de agrupar`
    )
    filteredPlayers = filteredPlayers.slice(0, VALIDATION_LIMITS.MAX_PLAYERS_PER_MATCH)
  }

  const gameTypeMapping: Record<string, string> = {
    'ca': 'ca', 'wo': 'ca', 'wipeout': 'ca', // WO (Wipeout) se procesa como CA
    'ctf': 'ctf', 'tdm': 'tdm', 'duel': 'duel',
    'ffa': 'ffa', 'ad': 'ad', 'ft': 'ft', 'dom': 'dom'
  }

  const weaponMapping: Record<string, string> = {
    'GAUNTLET': 'GT',
    'MACHINEGUN': 'MG',
    'SHOTGUN': 'SG',
    'GRENADE': 'GL',
    'ROCKET': 'RL',
    'LIGHTNING': 'LG',
    'RAILGUN': 'RG',
    'PLASMA': 'PG',
    'HMG': 'HMG'
    // BFG no está en el enum Weapon de Prisma, lo omitimos
  }

  const players: PlayerPayload[] = filteredPlayers.map((p: any) => {
    const weapons: WeaponStat[] = []
    const weaponsData = p.WEAPONS || {}

    for (const [zmqWeapon, apiWeapon] of Object.entries(weaponMapping)) {
      if (weaponsData[zmqWeapon]) {
        const w = weaponsData[zmqWeapon]
        // Solo agregar si el weapon está en el enum de Prisma
        weapons.push({
          weapon: apiWeapon,
          kills: w.K || 0,
          hits: w.H || 0,
          shots: w.S || 0,
          damage: w.DG || 0
        })
      }
    }

    // Convertir team de string/number a número según formato ZMQ
    // ZMQ puede enviar: 0/"FREE", 1/"RED", 2/"BLUE", 3/"SPECTATOR"
    let teamNumber: number = 0 // Default: FREE
    if (p.TEAM !== undefined && p.TEAM !== null) {
      if (typeof p.TEAM === 'number') {
        teamNumber = p.TEAM
      } else if (typeof p.TEAM === 'string') {
        const teamStr = p.TEAM.toUpperCase()
        if (teamStr === 'RED' || teamStr === '1') teamNumber = 1
        else if (teamStr === 'BLUE' || teamStr === '2') teamNumber = 2
        else if (teamStr === 'SPECTATOR' || teamStr === '3') teamNumber = 3
        else teamNumber = 0 // FREE or any other value
      }
    }

    const steamId = String(p.STEAM_ID || '')
    const playerRoundData = roundsData[steamId]
    const manualPlayTime = Array.isArray(playTimes?.players?.[steamId])
      ? playTimes.players[steamId].reduce((sum: number, time: number) => sum + (time || 0), 0)
      : undefined

    // Construir PlayerPayload con validación y sanitización de todos los campos
    const player: PlayerPayload = {
      steamId, // Ya validado en el filtro anterior
      playerName: sanitizeString(p.NAME, VALIDATION_LIMITS.MAX_PLAYER_NAME_LENGTH) || 'Unknown',

      // Validar valores numéricos con límites razonables
      kills: validateNumber(p.KILLS, 0, VALIDATION_LIMITS.MAX_KILLS, 0),
      deaths: validateNumber(p.DEATHS, 0, VALIDATION_LIMITS.MAX_DEATHS, 0),
      damageDealt: validateNumber(p.DAMAGE?.DEALT, 0, VALIDATION_LIMITS.MAX_DAMAGE, 0),
      damageTaken: validateNumber(p.DAMAGE?.TAKEN, 0, VALIDATION_LIMITS.MAX_DAMAGE, 0),
      score: validateNumber(p.SCORE, -1000, VALIDATION_LIMITS.MAX_SCORE, 0), // Score puede ser negativo en algunos modos

      team: teamNumber, // Ya validado arriba
      aliveTime: validateNumber(
        manualPlayTime ?? p.PLAY_TIME,
        0,
        VALIDATION_LIMITS.MAX_PLAY_TIME,
        0
      ),
      quit: Boolean(p.QUIT), // Asegurar que sea boolean

      weapons, // Ya validado en el loop anterior
      rounds: playerRoundData?.rounds ? validateNumber(playerRoundData.rounds, 0, VALIDATION_LIMITS.MAX_ROUNDS, undefined) : undefined,
      roundsWon: playerRoundData?.roundsWon ? validateNumber(playerRoundData.roundsWon, 0, VALIDATION_LIMITS.MAX_ROUNDS, undefined) : undefined,
    }

    // Medals
    const medals = p.MEDALS || {}
    player.medalAccuracy = medals.ACCURACY || 0
    player.medalAssists = medals.ASSISTS || 0
    player.medalCaptures = medals.CAPTURES || 0
    player.medalCombokill = medals.COMBOKILL || 0
    player.medalDefends = medals.DEFENDS || 0
    player.medalExcellent = medals.EXCELLENT || 0
    player.medalFirstfrag = medals.FIRSTFRAG || 0
    player.medalHeadshot = medals.HEADSHOT || 0
    player.medalHumiliation = medals.HUMILIATION || 0
    player.medalImpressive = medals.IMPRESSIVE || 0
    player.medalMidair = medals.MIDAIR || 0
    player.medalPerfect = medals.PERFECT || 0
    player.medalPerforated = medals.PERFORATED || 0
    player.medalQuadgod = medals.QUADGOD || 0
    player.medalRampage = medals.RAMPAGE || 0
    player.medalRevenge = medals.REVENGE || 0

    // CTF stats
    // CAPTURES viene de MEDALS.CAPTURES
    // RETURNS es el total de pickups de banderas enemigas (RED_FLAG_PICKUPS para equipo azul, BLUE_FLAG_PICKUPS para equipo rojo)
    // ASSISTS viene de MEDALS.ASSISTS
    player.flagsCaptured = medals.CAPTURES || 0
    player.medalAssists = medals.ASSISTS || 0 // Ya lo asignamos arriba, pero enfatizamos que es para CTF también

    // flagsReturned: pickups de bandera enemiga según el equipo
    // Si el jugador está en equipo RED (1), los returns son BLUE_FLAG_PICKUPS
    // Si el jugador está en equipo BLUE (2), los returns son RED_FLAG_PICKUPS
    if (teamNumber === 1) {
      player.flagsReturned = p.BLUE_FLAG_PICKUPS || 0
    } else if (teamNumber === 2) {
      player.flagsReturned = p.RED_FLAG_PICKUPS || 0
    } else {
      player.flagsReturned = 0
    }

    // Total de pickups (para referencia)
    player.flagPicks = (p.RED_FLAG_PICKUPS || 0) + (p.BLUE_FLAG_PICKUPS || 0) + (p.NEUTRAL_FLAG_PICKUPS || 0)

    return player
  })

  // Construir y retornar MatchPayload con todos los campos sanitizados
  return {
    matchId: sanitizeString(zmqData.MATCH_GUID, VALIDATION_LIMITS.MAX_MATCH_ID_LENGTH) || '',
    gameType: gameTypeMapping[String(zmqData.GAME_TYPE || '').toLowerCase()] || 'ca',
    map: sanitizeString(zmqData.MAP, VALIDATION_LIMITS.MAX_MAP_NAME_LENGTH) || 'unknown',
    serverName: sanitizeString(zmqData.SERVER_TITLE, VALIDATION_LIMITS.MAX_SERVER_NAME_LENGTH) || 'QuakeClub Server',
    timestamp: validateNumber(zmqData.MATCH_DATE, 0, Date.now() / 1000 + 86400, Math.floor(Date.now() / 1000)), // Permitir hasta 1 día en el futuro
    duration: validateNumber(zmqData.GAME_LENGTH, 0, VALIDATION_LIMITS.MAX_MATCH_DURATION, 0),
    players
  }
}

/**
 * POST /api/match
 * Recibe una partida completa con todos los jugadores en un solo request
 * Arquitectura: 1 Match → N PlayerMatchStats → calcular ratings una vez
 * Acepta tanto formato API como formato RAW de ZMQ
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = getIdentifier(request)
    const rateLimitResult = rateLimit(identifier, {
      limit: 50, // Menos requests porque cada uno tiene muchos jugadores
      window: 60 * 1000,
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      )
    }

    // Auth: verificar API key de variable de entorno
    const apiKey = request.headers.get("x-api-key")
    const expectedApiKey = process.env.MINQLX_API_KEY

    if (!expectedApiKey) {
      logger.error("MINQLX_API_KEY no configurada en variables de entorno")
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 })
    }

    if (apiKey !== expectedApiKey) {
      logger.error("API key inválida")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rawBody = await request.json()

    // Detectar formato ZMQ RAW vs API
    const isZmqFormat = rawBody.MATCH_GUID !== undefined || rawBody.PLAYERS !== undefined

    const body: MatchPayload = isZmqFormat
      ? parseZmqMatchReport(rawBody)
      : rawBody

    logger.info(`New match: ${body.matchId} | ${body.gameType} | ${body.map} | ${body.players?.length || 0} players`)

    // Validación básica - campos mínimos requeridos
    if (!body.matchId || !body.gameType || !body.map) {
      logger.error(`Validation failed: missing required fields`)
      return NextResponse.json(
        { error: "Missing required fields: matchId, gameType, map" },
        { status: 400 }
      )
    }

    // Validación de jugadores - rechazar partidas vacías o warmup solamente
    if (!body.players || body.players.length === 0) {
      logger.warn(`Match ${body.matchId} sin jugadores - ignorando (warmup/restart)`)
      return NextResponse.json({
        success: true,
        message: "Match ignored - no players (warmup or restart)",
        matchId: body.matchId,
      })
    }

    // Filtrar jugadores con datos válidos
    // Excluir: steamId=0, spectators (team=3), y jugadores sin actividad
    const validPlayers = body.players.filter(p => {
      // Rechazar steamId inválidos
      if (!p.steamId || p.steamId === '0' || p.steamId === '') return false

      // Rechazar spectators explícitos (team=3)
      if (p.team === 3) return false

      // Requiere al menos alguna actividad en la partida
      return p.kills > 0 || p.deaths > 0 || p.score > 0 || p.aliveTime > 0
    })

    if (validPlayers.length === 0) {
      logger.warn(`Match ${body.matchId} sin jugadores válidos - ignorando (warmup)`)
      return NextResponse.json({
        success: true,
        message: "Match ignored - no valid players (warmup match)",
        matchId: body.matchId,
      })
    }

    // Usar solo jugadores válidos
    body.players = validPlayers
    logger.info(`Valid players: ${validPlayers.length}`)

    // Validación específica para DUEL con forfeit
    if (body.gameType.toLowerCase() === 'duel') {
      const totalKills = validPlayers.reduce((sum, p) => sum + p.kills, 0)
      const totalDamage = validPlayers.reduce((sum, p) => sum + p.damageDealt, 0)
      const duration = body.duration || 0

      // Validación: GAME_LENGTH >= 10*60-5 || "forfeited" en EXIT_MSG
      // Si hay forfeit temprano (< 9:55 mins) Y sin actividad, ignorar
      if (duration < 595 && totalKills === 0 && totalDamage === 0) {
        logger.warn(`Match ${body.matchId} DUEL forfeit sin actividad - ignorando`)
        return NextResponse.json({
          success: true,
          message: "Match ignored - forfeit without activity",
          matchId: body.matchId,
        })
      }
    }

    // Verificar duplicados (mismo matchId ya procesado)
    const existingMatch = await prisma.match.findUnique({
      where: { matchId: body.matchId },
    })

    if (existingMatch) {
      logger.warn(`Match ${body.matchId} ya existe - ignorando duplicado`)
      return NextResponse.json({
        success: true,
        message: "Match already processed",
        matchId: body.matchId,
      })
    }

    // Detectar tipo de servidor y temporada activa para sistema de liga
    const serverType = rawBody.SERVER_TYPE || 'public'
    let seasonId: string | null = null
    let isOfficial = false
    // Si es servidor competitivo, buscar temporada activa
    if (serverType === 'competitive') {
      try {
        const activeSeason = await prisma.season.findFirst({
          where: {
            status: 'ACTIVE',
            startDate: { lte: new Date() },
            endDate: { gte: new Date() },
            gameTypes: { has: body.gameType.toLowerCase() }
          }
        })
        if (activeSeason) {
          seasonId = activeSeason.id
          isOfficial = true
          logger.info(`Partida de Liga - Temporada: ${activeSeason.name}`)
        } else {
          logger.info(`Partida Competitiva (Off-Season)`)
        }
      } catch (seasonError) {
        logger.warn('Error buscando temporada activa:', seasonError)
      }
    }

    // PASO 1: Crear el Match (con manejo de condición de carrera)
    let match
    try {
      match = await prisma.match.create({
        data: {
          id: `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          matchId: body.matchId,
          gameType: body.gameType.toLowerCase(),
          map: body.map,
          serverName: body.serverName || "Unknown Server",
          duration: body.duration || null,
          timestamp: new Date(body.timestamp * 1000),
          gameStatus: "SUCCESS", // Will be updated if validation fails
          ratingProcessed: false,
          // Sistema de Liga/Ladder
          serverType: serverType,
          seasonId: seasonId,
          isOfficial: isOfficial,
          // QLStats validation fields
          team1Score: rawBody.TSCORE0 || body.teamScores?.red || 0,
          team2Score: rawBody.TSCORE1 || body.teamScores?.blue || 0,
          aborted: rawBody.ABORTED || false,
          factory: rawBody.FACTORY || null,
          factoryTitle: rawBody.FACTORY_TITLE || null,
          fragLimit: rawBody.FRAG_LIMIT || null,
          scoreLimit: rawBody.SCORE_LIMIT || null,
          roundLimit: rawBody.ROUND_LIMIT || null,
          exitMessage: rawBody.EXIT_MSG || null,
          infected: Boolean(rawBody.INFECTED),
          quadhog: Boolean(rawBody.QUADHOG),
          training: Boolean(rawBody.TRAINING),
          instagib: Boolean(rawBody.INSTAGIB),
          // Datos del tracker para recálculo fiel
          playTimes: rawBody.PLAY_TIMES || undefined,
          roundCount: rawBody.ROUND_COUNT || undefined,
        },
      })
    } catch (createError: any) {
      // Si es error de unique constraint (condición de carrera), ignorar silenciosamente
      if (createError?.code === 'P2002') {
        logger.warn(`Match ${body.matchId} duplicado (condición de carrera) - ignorando`)
        return NextResponse.json({
          success: true,
          message: "Match already processed (race condition)",
          matchId: body.matchId,
        })
      }
      throw createError // Re-lanzar si es otro tipo de error
    }

    logger.success(`Match creado: ${match.id}`)

    // PASO 2: Crear/obtener jugadores y crear PlayerMatchStats
    const playerMatchStatsIds: string[] = []
    const playersForRating: Array<{
      playerMatchStatsId: string
      steamId: string
      score: number
      team?: number
      kills: number
      deaths: number
      damageDealt: number
      damageTaken: number
      aliveTime: number
      quit?: boolean // QLStats quit detection
    }> = []

    for (const playerData of body.players) {
      try {
        logger.info(`Procesando jugador: ${playerData.playerName} (${playerData.steamId})`)

        // Crear/actualizar jugador (limpiar códigos de color de Quake)
        const cleanedName = cleanUsername(playerData.playerName, playerData.steamId)

        // Verificar si el jugador existe y tiene país
        const existingPlayer = await prisma.player.findUnique({
          where: { steamId: playerData.steamId },
          select: { id: true, countryCode: true }
        })

        let countryCode = existingPlayer?.countryCode || null

        // Si es jugador nuevo o no tiene país, obtener de Steam
        if (!existingPlayer || !existingPlayer.countryCode) {
          try {
            const steamInfo = await getSteamUserInfo(playerData.steamId)
            countryCode = steamInfo?.countryCode || "CL"
          } catch (e) {
            countryCode = "CL"
          }
        }

        const player = await prisma.player.upsert({
          where: { steamId: playerData.steamId },
          update: {
            username: cleanedName,
            updatedAt: new Date(),
            ...(countryCode && !existingPlayer?.countryCode ? { countryCode } : {}),
          },
          create: {
            id: playerData.steamId,
            steamId: playerData.steamId,
            username: cleanedName,
            countryCode: countryCode || "CL",
            updatedAt: new Date(),
          },
        })

        logger.info(`Player upsert exitoso: ${player.id}`)

        // Trackear alias automáticamente si el nombre es diferente
        if (playerData.playerName && playerData.playerName.trim()) {
          try {
            await prisma.playerAlias.upsert({
              where: {
                steamId_alias: {
                  steamId: playerData.steamId,
                  alias: playerData.playerName,
                },
              },
              update: {
                lastSeen: new Date(),
                timesUsed: { increment: 1 },
              },
              create: {
                id: `alias_${playerData.steamId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                playerId: player.id,
                steamId: playerData.steamId,
                alias: playerData.playerName,
                firstSeen: new Date(),
                lastSeen: new Date(),
                timesUsed: 1,
              },
            })
          } catch (aliasError) {
            logger.error(`Error tracking alias for ${playerData.steamId}: ${aliasError}`)
          }
        }

        // Calculate performance score
        const gameDuration = body.duration || 0
        const timeFactor = playerData.aliveTime && gameDuration > 0
          ? playerData.aliveTime / gameDuration
          : 1.0

        const performance = calculatePerformance({
          gameType: body.gameType.toLowerCase(),
          kills: playerData.kills,
          deaths: playerData.deaths,
          score: playerData.score,
          damageDealt: playerData.damageDealt,
          damageTaken: playerData.damageTaken,
          win: false, // Will be determined later by rating calculator
          aliveTime: playerData.aliveTime || 0,
          matchDuration: gameDuration,
          quit: playerData.quit || false,
          assists: playerData.medalAssists || 0, // For FT
          captures: playerData.medalCaptures || 0, // For AD
        })

        logger.info(`Performance calculado para ${playerData.playerName}: ${performance}`)

        // Crear PlayerMatchStats
        const playerMatchStats = await prisma.playerMatchStats.create({
          data: {
            id: randomUUID(),
            matchId: match.id,
            playerId: player.id,
            steamId: playerData.steamId,
            playerName: playerData.playerName,
            team: playerData.team,
            score: playerData.score,
            kills: playerData.kills,
            deaths: playerData.deaths,
            damageDealt: playerData.damageDealt,
            damageTaken: playerData.damageTaken,
            aliveTime: playerData.aliveTime,
            performance: performance,
            quit: playerData.quit || false,
            // Round-based stats (CA, FT, AD)
            rounds: playerData.rounds,
            roundsWon: playerData.roundsWon,
            // CTF stats
            flagsCaptured: playerData.flagsCaptured || 0,
            flagsReturned: playerData.flagsReturned || 0,
            flagPicks: playerData.flagPicks || 0,
            flagDrops: playerData.flagDrops || 0,
            carrierTakedowns: playerData.carrierTakedowns || 0,
            // Medals
            medalAccuracy: playerData.medalAccuracy || 0,
            medalAssists: playerData.medalAssists || 0,
            medalCaptures: playerData.medalCaptures || 0,
            medalCombokill: playerData.medalCombokill || 0,
            medalDefends: playerData.medalDefends || 0,
            medalExcellent: playerData.medalExcellent || 0,
            medalFirstfrag: playerData.medalFirstfrag || 0,
            medalHeadshot: playerData.medalHeadshot || 0,
            medalHumiliation: playerData.medalHumiliation || 0,
            medalImpressive: playerData.medalImpressive || 0,
            medalMidair: playerData.medalMidair || 0,
            medalPerfect: playerData.medalPerfect || 0,
            medalPerforated: playerData.medalPerforated || 0,
            medalQuadgod: playerData.medalQuadgod || 0,
            medalRampage: playerData.medalRampage || 0,
            medalRevenge: playerData.medalRevenge || 0,
          },
        })

        playerMatchStatsIds.push(playerMatchStats.id)

        // Crear WeaponStats si existen
        if (playerData.weapons && playerData.weapons.length > 0) {
          await prisma.weaponStats.createMany({
            data: playerData.weapons.map((w) => ({
              id: randomUUID(),
              playerId: player.id,
              playerMatchStatsId: playerMatchStats.id,
              weapon: w.weapon as Weapon, // Cast al enum de Prisma
              kills: w.kills,
              hits: w.hits,
              shots: w.shots,
              damage: w.damage,
              accuracy: w.shots > 0 ? (w.hits / w.shots) * 100 : 0,
            })),
          })
        }

        // Agregar a lista para cálculo de rating
        playersForRating.push({
          playerMatchStatsId: playerMatchStats.id,
          steamId: playerData.steamId,
          score: playerData.score,
          team: playerData.team,
          kills: playerData.kills,
          deaths: playerData.deaths,
          damageDealt: playerData.damageDealt,
          damageTaken: playerData.damageTaken,
          aliveTime: playerData.aliveTime,
          quit: playerData.quit || false, // QLStats quit detection
        })

        logger.info(`✓ Jugador ${playerData.playerName} agregado a playersForRating (total: ${playersForRating.length})`)

        logger.info(`PlayerMatchStats creado: ${playerData.playerName}`)
      } catch (error) {
        logger.error(`Error procesando jugador ${playerData.steamId} (${playerData.playerName}):`, error)
        // Log del error completo con stack
        console.error("Error completo:", error)
      }
    }

    // PASO 3: Calcular ratings (una sola vez para todo el match)
    logger.info(`Calculando ratings para ${playersForRating.length} jugadores...`)

    try {
      const matchContext: MatchContext = {
        matchId: match.id,
        gameType: body.gameType.toLowerCase(),
        matchDuration: body.duration,
        mapName: body.map || undefined,
      }

      // Contexto de liga para el calculador de ratings
      const ladderContext = {
        serverType: serverType,
        seasonId: seasonId,
        isOfficial: isOfficial,
      }

      const matchPlayers: MatchPlayer[] = playersForRating.map((p) => ({
        steamId: p.steamId,
        kills: p.kills,
        deaths: p.deaths,
        score: p.score,
        team: p.team,
        aliveTime: p.aliveTime,
        damageDealt: p.damageDealt, // For performance score
        damageTaken: p.damageTaken, // For performance score
        quit: p.quit, // QLStats quit detection (DUEL)
        matchId: p.playerMatchStatsId, // Pasar el PlayerMatchStats.id
      }))

      // Pasar match completo para validación de QLStats
      // FIX: Incluir playTimes y roundCount del tracker para detección de team switch
      // y cálculo correcto de timeFactor en performance
      const matchStatsForValidation = {
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
        // Datos del tracker manual (team switch detection + time factor)
        playTimes: rawBody.PLAY_TIMES || undefined,
        roundCount: rawBody.ROUND_COUNT || undefined,
      };

      await calculateMatchRatings(matchContext, matchPlayers, matchStatsForValidation, ladderContext)

      // Marcar match como procesado
      await prisma.match.update({
        where: { id: match.id },
        data: {
          gameStatus: "SUCCESS",
          ratingProcessed: true,
        },
      })

      logger.success(`Ratings calculados exitosamente para match ${match.matchId}`)
    } catch (error) {
      logger.error("Error calculando ratings:", error)

      // Marcar match como error
      await prisma.match.update({
        where: { id: match.id },
        data: {
          gameStatus: "SERVER_ERROR",
          ratingProcessed: false,
        },
      })
    }

    logAuditAsync({ category: "MATCH", action: "MATCH_PROCESSED", actorType: "SYSTEM", targetType: "match", targetId: match.matchId, details: { gameType: body.gameType, map: body.map, players: playersForRating.length, serverType: match.serverType, score: `${match.team1Score || 0}-${match.team2Score || 0}` } }, null, request)

    return NextResponse.json({
      success: true,
      matchId: match.matchId,
      playersProcessed: playersForRating.length,
      message: "Match processed successfully",
    })
  } catch (error: any) {
    logger.error("Error procesando match:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    )
  }
}
