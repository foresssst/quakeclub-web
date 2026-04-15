import { type NextRequest, NextResponse } from "next/server"
import { type GameStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getPlayerStats } from "@/lib/rating-system"
import { calculateMatchRatings } from "@/lib/rating-calculator"
import { statsLogger, ratingLogger } from "@/lib/logger"
import { randomUUID } from "crypto"
import { rateLimit, getIdentifier } from "@/lib/rate-limit"
import { cleanUsername } from "@/lib/quake-colors"
import { logAuditAsync } from "@/lib/audit"
// Constantes de validación de partidas
const MIN_ALIVETIME = 120 // Mínimo 2 minutos de tiempo vivo
const MIN_TIME_RATIO = 0.5 // Debe jugar al menos 50% de la duración
const MIN_REAL_PLAYERS = 2 // Mínimo 2 jugadores reales (no bots)
// Jugadores mínimos por modo de juego
const MIN_PLAYERS_BY_GAMETYPE: Record<string, number> = {
  ca: 6, // CA requiere 3v3 mínimo
  tdm: 4, // TDM requiere 2v2 mínimo
  ctf: 4, // CTF requiere 2v2 mínimo
  duel: 2, // Duel es 1v1
  ffa: 3, // FFA necesita al menos 3 jugadores
  dom: 4, // Domination 2v2 mínimo
  ad: 6, // Attack/Defend requiere 3v3 mínimo
  ft: 6, // Freeze Tag requiere 3v3 mínimo
}
// Reglas de validación por modo (score/duración mínima)
const GAME_VALIDATION_RULES: Record<string, any> = {
  ca: { minScore: 8, minScoreDiff: 5 },
  tdm: { minScore: 100, minScoreDiff: 30, minDuration: 900 },
  ctf: { minScore: 5, minScoreDiff: 5, minDuration: 900 },
  duel: { minDuration: 600 },
  ffa: { fragLimit: 50 },
  ad: { scoreLimit: 15 },
  ft: { minScore: 8, minScoreDiff: 5 },
}
// Valida si una partida es legítima
function validateMatch(
  payload: MatchStatsPayload,
  allPlayersInMatch: MatchStatsPayload[],
  matchDuration?: number,
): { valid: boolean; reason?: string } {
  const { steamId, playerName, gameType, aliveTime, team } = payload
  // Detectar bots
  if (playerName.toLowerCase().startsWith("bot")) {
    return { valid: false, reason: "Player is a bot" }
  }
  // Detectar warmup/spectadores
  if (!aliveTime || aliveTime === 0) {
    return { valid: false, reason: "Warmup only (aliveTime = 0)" }
  }
  // Tiempo mínimo de juego (excepción: duel siempre cuenta)
  if (gameType.toLowerCase() !== 'duel' && aliveTime < MIN_ALIVETIME) {
    return { valid: false, reason: `Match too short (${aliveTime}s < ${MIN_ALIVETIME}s)` }
  }
  // Debe jugar al menos 50% de la partida (excepción: duel)
  if (gameType.toLowerCase() !== 'duel' && matchDuration && aliveTime < MIN_TIME_RATIO * matchDuration) {
    return {
      valid: false,
      reason: `Played too little (${aliveTime}s < 50% of ${matchDuration}s)`,
    }
  }
  // Contar jugadores reales (no bots)
  const realPlayers = allPlayersInMatch.filter(
    (p) => !p.playerName.toLowerCase().startsWith("bot") && p.aliveTime && p.aliveTime > 0,
  )
  if (realPlayers.length < MIN_REAL_PLAYERS) {
    return {
      valid: false,
      reason: `Not enough players (${realPlayers.length} < ${MIN_REAL_PLAYERS})`,
    }
  }
  // Validar jugadores mínimos según el modo
  const minPlayersForGameType = MIN_PLAYERS_BY_GAMETYPE[gameType.toLowerCase()] || MIN_REAL_PLAYERS
  if (realPlayers.length < minPlayersForGameType) {
    return {
      valid: false,
      reason: `Not enough players for ${gameType.toUpperCase()} (${realPlayers.length} < ${minPlayersForGameType})`,
    }
  }
  // Verificar balance de equipos
  if (team !== undefined && team > 0) {
    const team1Players = realPlayers.filter((p) => p.team === 1)
    const team2Players = realPlayers.filter((p) => p.team === 2)
    if (team1Players.length === 0 || team2Players.length === 0) {
      return {
        valid: false,
        reason: "Unbalanced teams (one team empty)",
      }
    }
  }
  return { valid: true }
}
// Valida si la partida cumple requisitos mínimos de score/duración
function validateGameCompletion(
  gameType: string,
  allPlayers: MatchStatsPayload[],
  matchDuration: number
): { valid: boolean; reason?: string } {
  const rules = GAME_VALIDATION_RULES[gameType.toLowerCase()]
  if (!rules) return { valid: true }
  // Modos por equipos
  const teamPlayers = allPlayers.filter((p) => p.team && p.team > 0)
  if (teamPlayers.length > 0) {
    const team1 = teamPlayers.filter((p) => p.team === 1)
    const team2 = teamPlayers.filter((p) => p.team === 2)
    const team1Score = team1.reduce((sum, p) => sum + (p.score || 0), 0)
    const team2Score = team2.reduce((sum, p) => sum + (p.score || 0), 0)
    const maxScore = Math.max(team1Score, team2Score)
    const scoreDiff = Math.abs(team1Score - team2Score)
    if (rules.minScore && maxScore < rules.minScore) {
      return {
        valid: false,
        reason: `Game too short: max score ${maxScore} < ${rules.minScore}`
      }
    }
    if (rules.minScoreDiff && rules.minDuration) {
      if (scoreDiff < rules.minScoreDiff && matchDuration < rules.minDuration) {
        return {
          valid: false,
          reason: `Game inconclusive: score diff ${scoreDiff} < ${rules.minScoreDiff} and duration ${matchDuration}s < ${rules.minDuration}s`
        }
      }
    }
  }
  // Modo FFA
  if (gameType.toLowerCase() === 'ffa' && rules.fragLimit) {
    const topScore = Math.max(...allPlayers.map((p) => p.score || 0))
    if (topScore < rules.fragLimit) {
      return {
        valid: false,
        reason: `FFA frag limit not reached: ${topScore} < ${rules.fragLimit}`
      }
    }
  }
  // Duel siempre cuenta, incluso forfeit
  if (gameType.toLowerCase() === 'duel') {
    return { valid: true }
  }
  return { valid: true }
}
function mapValidationReasonToGameStatus(reason?: string): GameStatus {
  if (!reason) return "INVALID_DATA"
  const normalized = reason.toLowerCase()
  if (normalized.includes("bot")) return "BOTMATCH"
  if (normalized.includes("warmup") || normalized.includes("aliveTime = 0")) return "WARMUP_ONLY"
  if (normalized.includes("unbalanced")) return "UNBALANCED_TEAMS"
  if (normalized.includes("not enough players")) return "TOO_FEW_PLAYERS"
  if (normalized.includes("too short") || normalized.includes("played too little") || normalized.includes("frag limit")) {
    return "TOO_SHORT"
  }
  return "INVALID_DATA"
}
// Estructura de datos para estadísticas de armas
interface WeaponStatsData {
  weapon: string // LG, RL, RG, SG, PG
  hits: number
  shots: number
  damage: number
  kills: number
}
interface MatchStatsPayload {
  steamId: string
  playerName: string
  map: string
  gameType: string // ca, duel, tdm, ffa, ctf
  kills: number
  deaths: number
  damageDealt: number
  damageTaken: number
  score?: number // Score total del jugador
  team?: number // Team 1 o 2 (null para FFA/Duel)
  aliveTime?: number // Tiempo vivo en segundos
  rounds?: number // Rounds ganados (CA)
  weapons: WeaponStatsData[]
  lifetimes?: {
    min?: number
    max?: number
    avg?: number
  }
  // Timestamp del servidor de Quake
  timestamp?: number
  // Match Group ID
  matchGroupId?: string
  // Nombre del servidor (sv_hostname)
  serverName?: string
  flagsCaptured?: number
  flagsReturned?: number
  flagPicks?: number
  flagDrops?: number
  carrierTakedowns?: number
  // Medallas (16 tipos disponibles en ZMQ match report)
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
  // Tipo de servidor (opcional, para distinguir público vs competitivo)
  serverType?: string
  // Puerto del servidor de juego (para lookup de tipo)
  gamePort?: number
}
export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 100 requests por minuto por IP
    const identifier = getIdentifier(request)
    const rateLimitResult = rateLimit(identifier, {
      limit: 100,
      window: 60 * 1000, // 1 minuto
    })
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "100",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(rateLimitResult.reset).toISOString(),
          },
        }
      )
    }
    // Verificar autenticación básica (API key de variable de entorno)
    const apiKey = request.headers.get("x-api-key")
    const expectedApiKey = process.env.MINQLX_API_KEY
    if (!expectedApiKey) {
      statsLogger.error("MINQLX_API_KEY no configurada en variables de entorno")
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 })
    }
    if (apiKey !== expectedApiKey) {
      statsLogger.error("API key inválida recibida")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const body: MatchStatsPayload = await request.json()
    statsLogger.header("ESTADÍSTICAS DE MATCH RECIBIDAS")
    statsLogger.info("Jugador", body.playerName)
    statsLogger.info("Steam ID", body.steamId)
    statsLogger.info("Modo de juego", body.gameType)
    statsLogger.info("Mapa", body.map)
    statsLogger.info("K/D", `${body.kills}/${body.deaths}`)
    statsLogger.info("Daño Infligido/Recibido", `${body.damageDealt}/${body.damageTaken}`)
    statsLogger.info("Cantidad de armas", body.weapons?.length || 0)
    if (body.gameType.toLowerCase() === "ctf") {
      statsLogger.header("ESTADÍSTICAS ESPECÍFICAS DE CTF DETECTADAS")
      statsLogger.ctf("Banderas Capturadas", body.flagsCaptured || 0)
      statsLogger.ctf("Banderas Devueltas", body.flagsReturned || 0)
      statsLogger.ctf("Banderas Recogidas", body.flagPicks || 0)
      statsLogger.ctf("Banderas Soltadas", body.flagDrops || 0)
      statsLogger.ctf("Portadores Eliminados", body.carrierTakedowns || 0)
      // Check if CTF stats are actually being sent
      const hasCTFStats =
        (body.flagsCaptured || 0) > 0 ||
        (body.flagsReturned || 0) > 0 ||
        (body.flagPicks || 0) > 0 ||
        (body.flagDrops || 0) > 0 ||
        (body.carrierTakedowns || 0) > 0
      if (!hasCTFStats) {
        statsLogger.warning("CTF detectado pero NO se recibieron estadísticas de objetivos!")
        statsLogger.warning("El plugin minqlx NO está enviando datos específicos de CTF")
        statsLogger.warning("Verificar si los hooks de CTF están funcionando en el plugin")
      } else {
        statsLogger.success("Estadísticas de objetivos CTF están presentes")
      }
    }
    statsLogger.info("Timestamp", body.timestamp ? new Date(body.timestamp).toISOString() : "No proporcionado")
    statsLogger.debug("========================================\n")
    // Validar datos requeridos
    if (!body.steamId || !body.playerName || !body.map || !body.gameType) {
      statsLogger.error("Faltan campos requeridos")
      return NextResponse.json(
        { error: "Missing required fields: steamId, playerName, map, gameType" },
        { status: 400 },
      )
    }
    statsLogger.debug(`Procesando estadísticas de ${body.playerName} (${body.steamId})`)
    // 1. Crear o encontrar el jugador (limpiar códigos de color de Quake)
    const cleanedName = cleanUsername(body.playerName, body.steamId)
    const player = await prisma.player.upsert({
      where: { steamId: body.steamId },
      update: {
        username: cleanedName,
        updatedAt: new Date(),
      },
      create: {
        id: randomUUID(),
        steamId: body.steamId,
        username: cleanedName,
        updatedAt: new Date(),
      },
    })
    // 1b. Registrar/actualizar el alias usado en esta partida
    await prisma.playerAlias.upsert({
      where: {
        steamId_alias: {
          steamId: body.steamId,
          alias: body.playerName,
        },
      },
      update: {
        lastSeen: new Date(),
        timesUsed: {
          increment: 1,
        },
      },
      create: {
        id: randomUUID(),
        playerId: player.id,
        steamId: body.steamId,
        alias: body.playerName,
        firstSeen: new Date(),
        lastSeen: new Date(),
        timesUsed: 1,
      },
    })
    // 2. Calcular K/D ratio
    const kdRatio = body.kills / Math.max(body.deaths, 1)
    // 3. Crear registro de match stats
    const matchData = {
      id: randomUUID(),
      playerId: player.id,
      steamId: body.steamId,
      playerName: body.playerName,
      map: body.map,
      gameType: body.gameType.toLowerCase(),
      serverName: body.serverName || null,
      kills: body.kills,
      deaths: body.deaths,
      damageDealt: body.damageDealt,
      damageTaken: body.damageTaken,
      kdRatio: kdRatio,
      score: body.score || 0,
      team: body.team,
      aliveTime: body.aliveTime,
      rounds: body.rounds,
      minLifetime: body.lifetimes?.min,
      maxLifetime: body.lifetimes?.max,
      avgLifetime: body.lifetimes?.avg,
      matchGroupId: body.matchGroupId, // ID único para agrupar jugadores del mismo match
      flagsCaptured: body.flagsCaptured || 0,
      flagsReturned: body.flagsReturned || 0,
      flagPicks: body.flagPicks || 0,
      flagDrops: body.flagDrops || 0,
      carrierTakedowns: body.carrierTakedowns || 0,
      // Medallas
      medalAccuracy: body.medalAccuracy || 0,
      medalAssists: body.medalAssists || 0,
      medalCaptures: body.medalCaptures || 0,
      medalCombokill: body.medalCombokill || 0,
      medalDefends: body.medalDefends || 0,
      medalExcellent: body.medalExcellent || 0,
      medalFirstfrag: body.medalFirstfrag || 0,
      medalHeadshot: body.medalHeadshot || 0,
      medalHumiliation: body.medalHumiliation || 0,
      medalImpressive: body.medalImpressive || 0,
      medalMidair: body.medalMidair || 0,
      medalPerfect: body.medalPerfect || 0,
      medalPerforated: body.medalPerforated || 0,
      medalQuadgod: body.medalQuadgod || 0,
  // Game validation (will be updated after checking all players)
  gameStatus: "SUCCESS" as GameStatus, // Valor por defecto; se revisa más tarde
      statusMessage: null,
      medalRampage: body.medalRampage || 0,
      medalRevenge: body.medalRevenge || 0,
      playedAt: body.timestamp ? new Date(body.timestamp) : new Date(),
    }
    const matchStats = await prisma.matchStats.create({ data: matchData })
    statsLogger.success(`Estadísticas de match guardadas con ID: ${matchStats.id}`)
    if (body.gameType.toLowerCase() === "ctf") {
      statsLogger.ctf("Stats CTF guardadas en base de datos", "")
      statsLogger.ctf("  - Banderas capturadas", matchData.flagsCaptured)
      statsLogger.ctf("  - Banderas devueltas", matchData.flagsReturned)
      statsLogger.ctf("  - Banderas recogidas", matchData.flagPicks)
      statsLogger.ctf("  - Banderas soltadas", matchData.flagDrops)
      statsLogger.ctf("  - Portadores eliminados", matchData.carrierTakedowns)
    }
    // 4. Crear registros de weapon stats
    const weaponStatsPromises = body.weapons.map((weaponData) => {
      const accuracy = weaponData.shots > 0 ? (weaponData.hits / weaponData.shots) * 100 : 0
      // Mapear nombre de arma a enum
      const weaponEnum = weaponData.weapon.toUpperCase() as "LG" | "RL" | "RG" | "SG" | "PG" | "GL" | "MG" | "GT"
      return prisma.weaponStats.create({
        data: {
          id: randomUUID(),
          playerId: player.id,
          matchId: matchStats.id,
          weapon: weaponEnum,
          hits: weaponData.hits,
          shots: weaponData.shots,
          damage: weaponData.damage,
          kills: weaponData.kills,
          accuracy: accuracy,
        },
      })
    })
    await Promise.all(weaponStatsPromises)
    statsLogger.success(
      `Stats guardadas para ${body.playerName}: ${body.kills}/${body.deaths} K/D en ${body.map} (${body.gameType})`
    )
    // 6. Calcular rating instantáneamente (sin esperar cron)
    try {
      // Buscar si hay otros jugadores en este mismo match
      // PRIORIDAD 1: Usar matchGroupId si está disponible (más confiable)
      // PRIORIDAD 2: Usar timestamp window como fallback (backward compatibility)
      let relatedMatches
      if (body.matchGroupId) {
        relatedMatches = await prisma.matchStats.findMany({
          where: {
            matchGroupId: body.matchGroupId,
          },
          select: {
            id: true,
            steamId: true,
            playerName: true,
            score: true,
            team: true,
            kills: true,
            deaths: true,
            damageDealt: true,
            damageTaken: true,
            aliveTime: true,
            medalAssists: true,
            flagsCaptured: true,
            playedAt: true,
            gameStatus: true,
            statusMessage: true,
          },
        })
        ratingLogger.group("matchGroupId", relatedMatches.length, body.matchGroupId)
      } else {
        const matchWindow = 5 * 60 * 1000
        const matchTimestamp = body.timestamp ? new Date(body.timestamp) : new Date()
        const windowStart = new Date(matchTimestamp.getTime() - matchWindow)
        const windowEnd = new Date(matchTimestamp.getTime() + matchWindow)
        relatedMatches = await prisma.matchStats.findMany({
          where: {
            map: body.map,
            gameType: body.gameType,
            playedAt: {
              gte: windowStart,
              lte: windowEnd,
            },
          },
          select: {
            id: true,
            steamId: true,
            playerName: true,
            score: true,
            team: true,
            kills: true,
            deaths: true,
            damageDealt: true,
            damageTaken: true,
            aliveTime: true,
            medalAssists: true,
            flagsCaptured: true,
            playedAt: true,
            gameStatus: true,
            statusMessage: true,
          },
        })
        ratingLogger.group("timestamp window", relatedMatches.length)
      }
      const minPlayersRequired: Record<string, number> = {
        ca: 6,
        tdm: 4,
        ctf: 4,
        duel: 2,
        ffa: 3,
      }
      const gameTypeKey = body.gameType.toLowerCase()
      const requiredPlayers = minPlayersRequired[gameTypeKey] || 2
      if (relatedMatches.length >= requiredPlayers) {
        const matchDurationSeconds = Math.max(...relatedMatches.map((m) => m.aliveTime || 0), 0)
        const allPlayersPayload: MatchStatsPayload[] = relatedMatches.map((m) => ({
          steamId: m.steamId,
          playerName: m.playerName,
          map: body.map,
          gameType: body.gameType,
          kills: m.kills,
          deaths: m.deaths,
          damageDealt: m.damageDealt,
          damageTaken: m.damageTaken,
          score: m.score || 0,
          team: m.team ?? undefined,
          aliveTime: m.aliveTime || 0,
          weapons: [],
          flagsCaptured: m.flagsCaptured || 0,
        }))
        const gameValidation = validateGameCompletion(body.gameType, allPlayersPayload, matchDurationSeconds)
        const updatePromises: Array<Promise<unknown>> = []
        const playersForRating: Array<{
          matchId: string
          steamId: string
          score: number
          team?: number
          kills: number
          deaths: number
          damageDealt: number
          damageTaken: number
          aliveTime: number
          assists: number
          captures: number
        }> = []
        relatedMatches.forEach((record, index) => {
          const payload = allPlayersPayload[index]
          const playerValidation = validateMatch(payload, allPlayersPayload, matchDurationSeconds)
          const combinedValidation = !playerValidation.valid ? playerValidation : gameValidation
          let gameStatus: GameStatus = "SUCCESS"
          let statusMessage: string | null = null
          if (!combinedValidation.valid) {
            gameStatus = mapValidationReasonToGameStatus(combinedValidation.reason)
            statusMessage = combinedValidation.reason || null
            ratingLogger.warn(
              `Jugador excluido del rating ${record.playerName} (${record.steamId}): ${statusMessage ?? "motivo desconocido"}`,
            )
          }
          const participationPct = matchDurationSeconds > 0 && payload.aliveTime
            ? Math.min(1, payload.aliveTime / matchDurationSeconds)
            : null
          updatePromises.push(
            prisma.matchStats.update({
              where: { id: record.id },
              data: {
                gameStatus,
                statusMessage,
                matchDuration: matchDurationSeconds || null,
                participationPct,
              },
            }),
          )
          if (gameStatus === "SUCCESS") {
            playersForRating.push({
              matchId: record.id,
              steamId: record.steamId,
              score: record.score || 0,
              team: record.team ?? undefined,
              kills: record.kills,
              deaths: record.deaths,
              damageDealt: record.damageDealt,
              damageTaken: record.damageTaken,
              aliveTime: record.aliveTime || 0,
              assists: record.medalAssists || 0,
              captures: record.flagsCaptured || 0,
            })
          }
        })
        await Promise.all(updatePromises)
        if (playersForRating.length >= requiredPlayers) {
          // FIX: Usar matchGroupId (match-level) en lugar de matchStats.id (player-level)
          // Jugadores comparten matchId
          const matchId = body.matchGroupId || matchStats.id
          
          // Crear contexto del match para calculateMatchRatings
          const matchContext = {
            matchId,
            gameType: body.gameType.toLowerCase(),
            matchDuration: matchDurationSeconds,
          }
          
          // Convertir playersForRating al formato MatchPlayer esperado
          const matchPlayers = playersForRating.map((p) => ({
            steamId: p.steamId,
            kills: p.kills,
            deaths: p.deaths,
            score: p.score,
            team: p.team,
            aliveTime: p.aliveTime,
            damageDealt: p.damageDealt,
            damageTaken: p.damageTaken,
            matchId: p.matchId, // PlayerMatchStats.id
          }))
          
          // Detectar tipo de servidor para sistema de liga
          let detectedServerType = body.serverType || 'public'
          // Si no se especificó serverType, intentar detectar por serverName
          if (!body.serverType && body.serverName) {
            const serverNameLower = body.serverName.toLowerCase()
            if (serverNameLower.includes('liga') || serverNameLower.includes('comp') ||
                serverNameLower.includes('ladder') || serverNameLower.includes('scrim') ||
                serverNameLower.includes('torneo') || serverNameLower.includes('tournament')) {
              detectedServerType = 'competitive'
            }
          }
          // Si aún no detectado, buscar en ZmqServerConfig por gamePort
          if (detectedServerType === 'public' && body.gamePort) {
            try {
              const zmqConfig = await prisma.zmqServerConfig.findFirst({
                where: { gamePort: body.gamePort },
                select: { serverType: true },
              })
              if (zmqConfig?.serverType) {
                detectedServerType = zmqConfig.serverType
              }
            } catch (e) {
              // Ignorar errores de lookup
            }
          }
          // Construir ladderContext si es competitivo
          let ladderContext: { serverType: string; seasonId: string | null; isOfficial: boolean } | undefined
          if (detectedServerType === 'competitive') {
            let seasonId: string | null = null
            let isOfficial = false
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
              }
            } catch (e) {
              // Ignorar errores de búsqueda de temporada
            }
            ladderContext = { serverType: detectedServerType, seasonId, isOfficial }
            ratingLogger.info(`Partida competitiva detectada - Temporada: ${seasonId || 'Off-Season'}`)
          }
          await calculateMatchRatings(matchContext, matchPlayers, undefined, ladderContext)
          ratingLogger.calculation(matchId, playersForRating.length, requiredPlayers)
          try {
            const matchGroupPlayers = await prisma.matchStats.findMany({
              where: body.matchGroupId
                ? { matchGroupId: body.matchGroupId }
                : { id: { in: playersForRating.map((p) => p.matchId) } },
              select: {
                id: true,
                steamId: true,
                playerName: true,
              },
            })
            const matchPlayerIds = matchGroupPlayers.map((p) => p.id)
            const eloHistoryRecords = await prisma.eloHistory.findMany({
              where: {
                matchId: { in: matchPlayerIds },
              },
              select: { matchId: true },
            })
            
            const playerIdsWithElo = new Set(eloHistoryRecords.map((e) => e.matchId))
            const playersWithoutElo = matchGroupPlayers.filter((p) => !playerIdsWithElo.has(p.id))
            if (playersWithoutElo.length > 0) {
              ratingLogger.warn(
                ` ${playersWithoutElo.length} jugadores sin EloHistory detectados, intentando corrección automática...`,
              )
              for (const player of playersWithoutElo) {
                const orphanedElo = await prisma.eloHistory.findFirst({
                  where: {
                    steamId: player.steamId,
                    gameType: body.gameType,
                    matchId: null,
                    recordedAt: {
                      gte: new Date(Date.now() - 60000),
                      lte: new Date(Date.now() + 60000),
                    },
                  },
                })
                if (orphanedElo) {
                  await prisma.eloHistory.update({
                    where: { id: orphanedElo.id },
                    data: { matchId: player.id },
                  })
                  ratingLogger.info(`✓ EloHistory corregido automáticamente para ${player.playerName}`)
                } else {
                  ratingLogger.warn(` No se encontró EloHistory huérfano para ${player.playerName}`)
                }
              }
            }
          } catch (safetyError) {
            ratingLogger.error("Error en verificación de seguridad de EloHistory (no fatal)", safetyError)
          }
        } else {
          ratingLogger.warn(
            `Jugadores válidos insuficientes para calcular rating (${playersForRating.length}/${requiredPlayers})`,
          )
          ratingLogger.calculation(matchStats.id, playersForRating.length, requiredPlayers)
        }
      } else {
        ratingLogger.calculation(matchStats.id, relatedMatches.length, requiredPlayers)
      }
    } catch (ratingError) {
      // No fallar el request si falla el cálculo de rating
      ratingLogger.error("Error al calcular rating (no fatal)", ratingError)
    }
    logAuditAsync({ category: "MATCH", action: "STATS_PROCESSED", actorType: "SYSTEM", targetType: "player", targetId: body.steamId, targetName: body.playerName, details: { gameType: body.gameType, map: body.map, matchId: matchStats.id } }, null, request)
    return NextResponse.json({
      success: true,
      message: "Stats saved successfully",
      playerId: player.id,
      matchId: matchStats.id,
    })
  } catch (error) {
    statsLogger.error("Error al guardar estadísticas", error)
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 },
    )
  }
}
// Endpoint GET para verificar que la API está funcionando
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/stats",
    methods: ["POST"],
    description: "Endpoint para recibir estadísticas desde minqlx plugin",
    requiredHeaders: {
      "x-api-key": "API key para autenticación",
      "Content-Type": "application/json",
    },
    examplePayload: {
      steamId: "76561198123456789",
      playerName: "PlayerName",
      map: "campgrounds",
      gameType: "ca",
      kills: 25,
      deaths: 10,
      damageDealt: 5000,
      damageTaken: 3000,
      weapons: [
        {
          weapon: "LG",
          hits: 120,
          shots: 200,
          damage: 1500,
          kills: 5,
        },
      ],
      lifetimes: {
        min: 15.5,
        max: 120.3,
        avg: 45.7,
      },
      flagsCaptured: 0,
      flagsReturned: 0,
      flagPicks: 0,
      flagDrops: 0,
      carrierTakedowns: 0,
      serverName: "QuakeClub Server",
    },
  })
}
