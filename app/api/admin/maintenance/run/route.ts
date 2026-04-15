import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditAsync } from "@/lib/audit"
import fs from "fs"
import path from "path"

// Patrones de usernames problemáticos
const BROKEN_PATTERNS = [
  /^\^[0-7]$/,
  /^\^[0-7]\s*$/,
  /^\^x[0-9A-Fa-f]{3}$/,
  /^\s*$/,
]

function isUsernameBroken(username: string | null): boolean {
  if (!username || username.trim() === '') return true
  return BROKEN_PATTERNS.some(pattern => pattern.test(username))
}

function stripQuakeColors(text: string): string {
  if (!text) return text
  let result = ""
  let i = 0

  while (i < text.length) {
    if (text[i] === "^" && i + 1 < text.length) {
      if (/[0-7]/.test(text[i + 1])) {
        i += 2
      } else if (text[i + 1] === 'x' && i + 4 < text.length && /[0-9A-Fa-f]{3}/.test(text.slice(i + 2, i + 5))) {
        i += 5
      } else {
        result += text[i]
        i++
      }
    } else {
      result += text[i]
      i++
    }
  }

  return result.trim()
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    const { action } = await request.json()

    logAuditAsync({ category: "SYSTEM", action: `MAINTENANCE_${(action || "unknown").toUpperCase()}`, details: { action } }, session, request)

    switch (action) {
      case "fix-usernames":
        return await fixBrokenUsernames()
      case "sync-stats":
        return await syncPlayerStats()
      case "sync-wins-losses":
        return await syncWinsLossesFromMatches()
      case "clean-sessions":
        return await cleanExpiredSessions()
      case "check-consistency":
        return await checkDataConsistency()
      case "sync-steam-profiles":
        return await syncSteamProfiles()
      case "clear-rankings-cache":
        return await clearRankingsCache()
      case "recalculate-clan-elo":
        return await recalculateClanElo()
      default:
        return NextResponse.json({ error: "Acción desconocida" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error en mantenimiento:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

async function fixBrokenUsernames() {
  const players = await prisma.player.findMany({
    select: { id: true, steamId: true, username: true }
  })

  const brokenPlayers = players.filter(p => isUsernameBroken(p.username))

  let fixed = 0
  let aliasUsed = 0
  let fallbackUsed = 0
  const details: string[] = []

  for (const player of brokenPlayers) {
    const bestAlias = await prisma.playerAlias.findFirst({
      where: {
        steamId: player.steamId,
        NOT: { alias: { in: ['^7', '', 'Unknown'] } }
      },
      orderBy: [{ timesUsed: 'desc' }, { lastSeen: 'desc' }]
    })

    let newUsername: string

    if (bestAlias && !isUsernameBroken(bestAlias.alias)) {
      newUsername = stripQuakeColors(bestAlias.alias) || `Player_${player.steamId.slice(-8)}`
      aliasUsed++
    } else {
      newUsername = `Player_${player.steamId.slice(-8)}`
      fallbackUsed++
    }

    if (newUsername && newUsername !== player.username) {
      await prisma.player.update({
        where: { id: player.id },
        data: { username: newUsername }
      })
      details.push(`${player.steamId}: "${player.username}" → "${newUsername}"`)
      fixed++
    }
  }

  return NextResponse.json({
    success: true,
    message: `Corregidos ${fixed} de ${brokenPlayers.length} usernames problemáticos`,
    stats: {
      total: brokenPlayers.length,
      fixed,
      aliasUsed,
      fallbackUsed
    },
    details: details.slice(0, 20) // Limitar a 20 detalles
  })
}

async function syncPlayerStats() {
  // Obtener todos los ratings con sus partidas
  const ratings = await prisma.playerRating.findMany({
    include: {
      Player: {
        include: {
          PlayerMatchStats: {
            include: {
              Match: {
                select: {
                  gameType: true,
                  winner: true,
                  team1Score: true,
                  team2Score: true,
                }
              }
            }
          }
        }
      }
    }
  })

  let synced = 0
  const issues: string[] = []

  for (const rating of ratings) {
    // Filtrar partidas por gameType
    const gameTypeMatches = rating.Player.PlayerMatchStats.filter(
      pm => pm.Match.gameType?.toLowerCase() === rating.gameType.toLowerCase()
    )

    // En Quake Live NO hay empates - SIEMPRE es W o L
    // Lógica XonStats: winner === team → WIN, else → LOSS
    let calculatedWins = 0
    let calculatedLosses = 0

    for (const pm of gameTypeMatches) {
      const match = pm.Match
      let matchWinner = match.winner

      // Si winner no está definido, calcularlo desde scores
      if (matchWinner === null || matchWinner === undefined) {
        const t1Score = match.team1Score ?? 0
        const t2Score = match.team2Score ?? 0

        if (t1Score > t2Score) {
          matchWinner = 1
        } else if (t2Score > t1Score) {
          matchWinner = 2
        } else {
          // Scores iguales - usar score individual
          matchWinner = pm.score > 0 ? pm.team : (pm.team === 1 ? 2 : 1)
        }
      }

      // Determinar resultado
      const isTeamGame = pm.team !== null && pm.team !== undefined && pm.team > 0

      const gt = rating.gameType.toLowerCase()

      if (gt === 'duel') {
        // DUEL: comparar scores de los 2 jugadores
        const allMatchStats = await prisma.playerMatchStats.findMany({
          where: { matchId: pm.matchId },
          select: { steamId: true, score: true }
        })
        if (allMatchStats.length === 2) {
          const opponent = allMatchStats.find(s => s.steamId !== pm.steamId)
          if (opponent) {
            if (pm.score > opponent.score) calculatedWins++
            else calculatedLosses++
          }
        } else {
          if (pm.score > 0) calculatedWins++
          else calculatedLosses++
        }
      } else if (gt === 'ffa') {
        // FFA: Solo RANK #1 gana (como XonStat/QLStats)
        const allMatchStats = await prisma.playerMatchStats.findMany({
          where: { matchId: pm.matchId },
          select: { steamId: true, score: true }
        })
        if (allMatchStats.length > 0) {
          const maxScore = Math.max(...allMatchStats.map(s => s.score))
          if (pm.score === maxScore && pm.score > 0) calculatedWins++
          else calculatedLosses++
        } else {
          calculatedLosses++
        }
      } else if (isTeamGame) {
        // XonStats: winner === team → WIN, else → LOSS
        if (matchWinner === pm.team) {
          calculatedWins++
        } else {
          calculatedLosses++
        }
      } else {
        // Otros modos: usar score como indicador
        if (pm.score > 0) {
          calculatedWins++
        } else {
          calculatedLosses++
        }
      }
    }

    const totalGames = calculatedWins + calculatedLosses

    // Solo actualizar si hay discrepancia
    if (
      rating.wins !== calculatedWins ||
      rating.losses !== calculatedLosses ||
      rating.draws !== 0 ||
      rating.totalGames !== totalGames
    ) {
      await prisma.playerRating.update({
        where: { id: rating.id },
        data: {
          wins: calculatedWins,
          losses: calculatedLosses,
          draws: 0, // SIEMPRE 0 - no hay draws en Quake Live
          totalGames: totalGames
        }
      })
      issues.push(`${rating.steamId} (${rating.gameType}): W:${rating.wins}→${calculatedWins}, L:${rating.losses}→${calculatedLosses}, D:${rating.draws}→0`)
      synced++
    }
  }

  return NextResponse.json({
    success: true,
    message: `Sincronizados ${synced} ratings de ${ratings.length} totales. Draws eliminados.`,
    stats: { total: ratings.length, synced },
    issues: issues.slice(0, 30)
  })
}

async function cleanExpiredSessions() {
  const sessionsPath = path.join(process.cwd(), "data", "sessions.json")

  if (!fs.existsSync(sessionsPath)) {
    return NextResponse.json({
      success: true,
      message: "No hay archivo de sesiones",
      stats: { cleaned: 0 }
    })
  }

  try {
    const data = fs.readFileSync(sessionsPath, "utf-8")
    const sessions = JSON.parse(data)
    const now = Date.now()

    let cleaned = 0

    // El formato es un array de [token, session] pairs
    if (!Array.isArray(sessions)) {
      // Si no es array, resetear a array vacío
      fs.writeFileSync(sessionsPath, "[]")
      return NextResponse.json({
        success: true,
        message: "Archivo de sesiones reseteado (formato incorrecto)",
        stats: { cleaned: 0, remaining: 0 }
      })
    }

    const activeSessions = sessions.filter(([_, session]: [string, any]) => {
      if (session && typeof session === "object" && "expiresAt" in session) {
        if (session.expiresAt > now) {
          return true
        }
        cleaned++
        return false
      }
      cleaned++
      return false
    })

    fs.writeFileSync(sessionsPath, JSON.stringify(activeSessions, null, 2))

    return NextResponse.json({
      success: true,
      message: `Eliminadas ${cleaned} sesiones expiradas`,
      stats: {
        cleaned,
        remaining: activeSessions.length
      }
    })
  } catch (error) {
    return NextResponse.json({
      error: "Error procesando sesiones",
      details: String(error)
    })
  }
}

async function checkDataConsistency() {
  const issues: string[] = []

  // 1. Jugadores sin ratings
  const playersWithoutRatings = await prisma.player.count({
    where: {
      PlayerRating: { none: {} }
    }
  })
  if (playersWithoutRatings > 0) {
    issues.push(`${playersWithoutRatings} jugadores sin ratings (normal para nuevos jugadores)`)
  }

  // 2. Clanes sin miembros
  const clansWithoutMembers = await prisma.clan.count({
    where: {
      ClanMember: { none: {} }
    }
  })
  if (clansWithoutMembers > 0) {
    issues.push(`⚠️ ${clansWithoutMembers} clanes sin miembros`)
  }

  // 3. Partidas sin jugadores
  const matchesWithoutPlayers = await prisma.match.count({
    where: {
      PlayerMatchStats: { none: {} }
    }
  })
  if (matchesWithoutPlayers > 0) {
    issues.push(`⚠️ ${matchesWithoutPlayers} partidas sin estadísticas de jugadores`)
  }

  // 4. EloHistory huérfanos (jugadores que ya no existen)
  // Nota: Si la relación es requerida, no pueden existir huérfanos
  // Solo verificamos si hay registros con playerId vacío
  const orphanedEloHistory = await prisma.eloHistory.count({
    where: {
      OR: [
        { playerId: '' },
        { steamId: '' }
      ]
    }
  })
  if (orphanedEloHistory > 0) {
    issues.push(`⚠️ ${orphanedEloHistory} registros de EloHistory con datos incompletos`)
  }

  // 5. Solicitudes de clan pendientes antiguas (> 30 días)
  const oldPendingRequests = await prisma.clanJoinRequest.count({
    where: {
      status: 'PENDING',
      createdAt: {
        lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      }
    }
  })
  if (oldPendingRequests > 0) {
    issues.push(`${oldPendingRequests} solicitudes de clan pendientes por más de 30 días`)
  }

  return NextResponse.json({
    success: true,
    message: issues.length > 0
      ? `Se encontraron ${issues.length} observaciones`
      : "✅ No se encontraron problemas de consistencia",
    issues
  })
}

async function syncSteamProfiles() {
  const STEAM_API_KEY = process.env.STEAM_API_KEY
  if (!STEAM_API_KEY) {
    return NextResponse.json({
      error: "STEAM_API_KEY no configurada",
    }, { status: 500 })
  }

  // Buscar jugadores que necesitan actualización:
  // 1. Sin avatar
  // 2. Con nombre "Player_XXXXX" (fallback)
  const playersNeedingUpdate = await prisma.player.findMany({
    where: {
      OR: [
        { avatar: null },
        { avatar: '' },
        { username: { startsWith: 'Player_' } }
      ]
    },
    select: { id: true, steamId: true, username: true, avatar: true }
  })

  if (playersNeedingUpdate.length === 0) {
    return NextResponse.json({
      success: true,
      message: "Todos los perfiles ya están actualizados",
      stats: { checked: 0, updated: 0 }
    })
  }

  const BATCH_SIZE = 100 // Steam API permite hasta 100 por llamada
  const batches: typeof playersNeedingUpdate[] = []

  for (let i = 0; i < playersNeedingUpdate.length; i += BATCH_SIZE) {
    batches.push(playersNeedingUpdate.slice(i, i + BATCH_SIZE))
  }

  let updated = 0
  let avatarsUpdated = 0
  let namesUpdated = 0
  const details: string[] = []

  for (const batch of batches) {
    const steamIds = batch.map(p => p.steamId).join(',')

    try {
      const response = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamIds}`,
        { next: { revalidate: 0 } }
      )

      if (!response.ok) {
        details.push(`⚠️ Error en batch: ${response.status}`)
        continue
      }

      const data = await response.json()
      const steamPlayers = data.response?.players || []

      // Crear mapa de steamId -> datos de Steam
      const steamDataMap = new Map(
        steamPlayers.map((p: any) => [p.steamid, {
          username: p.personaname,
          avatar: p.avatarfull || p.avatarmedium || p.avatar
        }])
      )

      // Actualizar cada jugador del batch
      for (const player of batch) {
        const steamData = steamDataMap.get(player.steamId)
        if (!steamData) continue

        const updates: { username?: string; avatar?: string } = {}
        let changes: string[] = []

        // Actualizar nombre si es un fallback
        if (player.username?.startsWith('Player_') && steamData.username) {
          updates.username = steamData.username
          changes.push(`nick: "${player.username}" → "${steamData.username}"`)
          namesUpdated++
        }

        // Actualizar avatar si no tiene
        if ((!player.avatar || player.avatar === '') && steamData.avatar) {
          updates.avatar = steamData.avatar
          changes.push(`avatar actualizado`)
          avatarsUpdated++
        }

        if (Object.keys(updates).length > 0) {
          await prisma.player.update({
            where: { id: player.id },
            data: updates
          })
          details.push(`${player.steamId}: ${changes.join(', ')}`)
          updated++
        }
      }

      // Pequeña pausa entre batches para no saturar la API
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (error) {
      details.push(`⚠️ Error procesando batch: ${String(error)}`)
    }
  }

  return NextResponse.json({
    success: true,
    message: `Actualizados ${updated} perfiles de ${playersNeedingUpdate.length} pendientes`,
    stats: {
      checked: playersNeedingUpdate.length,
      updated,
      namesUpdated,
      avatarsUpdated,
      batches: batches.length
    },
    details: details.slice(0, 30) // Mostrar hasta 30 detalles
  })
}

/**
 * Sincroniza wins/losses basándose en los PARTIDOS REALES (no en cambio de ELO)
 * Esto corrige el bug donde wins/losses se contaban por cambio de rating
 */
async function syncWinsLossesFromMatches() {
  const ratings = await prisma.playerRating.findMany({
    select: {
      id: true,
      steamId: true,
      gameType: true,
      wins: true,
      losses: true,
      draws: true,
      totalGames: true
    }
  })

  let corrected = 0
  const corrections: string[] = []

  for (const rating of ratings) {
    // Obtener todos los partidos de este jugador para este gameType
    const matches = await prisma.playerMatchStats.findMany({
      where: {
        steamId: rating.steamId,
        Match: {
          gameType: rating.gameType.toLowerCase()
        }
      },
      include: {
        Match: {
          select: {
            gameType: true,
            winner: true,
            team1Score: true,
            team2Score: true
          }
        }
      }
    })

    let calculatedWins = 0
    let calculatedLosses = 0
    const gt = rating.gameType.toLowerCase()

    for (const pm of matches) {
      const match = pm.Match
      let matchWinner = match.winner

      // Calcular winner desde scores si no está definido
      if (matchWinner === null || matchWinner === undefined) {
        const t1Score = match.team1Score ?? 0
        const t2Score = match.team2Score ?? 0

        if (t1Score > t2Score) {
          matchWinner = 1
        } else if (t2Score > t1Score) {
          matchWinner = 2
        }
      }

      // Determinar resultado según tipo de juego
      const playerTeam = pm.team
      const isTeamGame = playerTeam !== null && playerTeam !== undefined && playerTeam > 0

      if (gt === 'duel') {
        // DUEL: comparar scores individuales
        // Necesitamos encontrar al oponente
        const opponentStats = await prisma.playerMatchStats.findFirst({
          where: {
            matchId: pm.matchId,
            NOT: { steamId: rating.steamId }
          },
          select: { score: true }
        })

        if (opponentStats) {
          if (pm.score > opponentStats.score) {
            calculatedWins++
          } else if (pm.score < opponentStats.score) {
            calculatedLosses++
          } else {
            // Empate en duel (raro) - contar como loss
            calculatedLosses++
          }
        } else {
          // Sin oponente, usar score > 0 como win
          if (pm.score > 0) calculatedWins++
          else calculatedLosses++
        }
      } else if (gt === 'ffa') {
        // FFA: Solo RANK #1 gana, los demás pierden (como XonStat/QLStats)
        const allMatchStats = await prisma.playerMatchStats.findMany({
          where: { matchId: pm.matchId },
          select: { steamId: true, score: true }
        })
        if (allMatchStats.length > 0) {
          const maxScore = Math.max(...allMatchStats.map(s => s.score))
          if (pm.score === maxScore && pm.score > 0) {
            calculatedWins++
          } else {
            calculatedLosses++
          }
        } else {
          calculatedLosses++
        }
      } else if (isTeamGame) {
        // Juegos por equipos: winner === team
        if (matchWinner === playerTeam) {
          calculatedWins++
        } else {
          calculatedLosses++
        }
      } else {
        // Fallback: score positivo = win
        if (pm.score > 0) calculatedWins++
        else calculatedLosses++
      }
    }

    const totalGames = calculatedWins + calculatedLosses

    // Solo actualizar si hay discrepancia
    if (
      rating.wins !== calculatedWins ||
      rating.losses !== calculatedLosses ||
      rating.totalGames !== totalGames
    ) {
      await prisma.playerRating.update({
        where: { id: rating.id },
        data: {
          wins: calculatedWins,
          losses: calculatedLosses,
          draws: 0,
          totalGames: totalGames
        }
      })
      corrections.push(`${rating.steamId} (${rating.gameType}): W:${rating.wins}→${calculatedWins}, L:${rating.losses}→${calculatedLosses}`)
      corrected++
    }
  }

  return NextResponse.json({
    success: true,
    message: `Sincronizados ${corrected} de ${ratings.length} ratings`,
    stats: {
      total: ratings.length,
      corrected
    },
    corrections: corrections.slice(0, 50)
  })
}

/**
 * Limpia el caché de rankings para forzar recálculo
 */
async function clearRankingsCache() {
  try {
    // Importar dinámicamente para evitar problemas de dependencias circulares
    const { rankingsCache } = await import('@/lib/rankings-service')

    // Limpiar el caché interno
    if (rankingsCache && typeof rankingsCache.clear === 'function') {
      rankingsCache.clear()
    }

    return NextResponse.json({
      success: true,
      message: "Caché de rankings limpiado. Los próximos requests recalcularán los rankings.",
    })
  } catch (error) {
    return NextResponse.json({
      success: true,
      message: "Caché procesado (puede que no hubiera caché activo)",
      note: String(error)
    })
  }
}

/**
 * Recalcula el ELO promedio de todos los clanes
 */
async function recalculateClanElo() {
  const { computeClanEloFromMembers, buildRatingFilter } = await import('@/lib/clan-elo')

  const clans = await prisma.clan.findMany({
    include: {
      ClanMember: {
        include: {
          Player: {
            include: {
              PlayerRating: buildRatingFilter(null)
            }
          }
        }
      }
    }
  })

  let updated = 0
  const updates: string[] = []

  for (const clan of clans) {
    if (clan.ClanMember.length === 0) continue

    const eloResult = computeClanEloFromMembers(clan.ClanMember, null)

    if (Math.abs(clan.averageElo - eloResult.averageElo) > 1 ||
      clan.totalGames !== eloResult.totalGames ||
      clan.totalWins !== eloResult.totalWins) {

      await prisma.clan.update({
        where: { id: clan.id },
        data: {
          averageElo: eloResult.averageElo,
          totalGames: eloResult.totalGames,
          totalWins: eloResult.totalWins,
          updatedAt: new Date()
        }
      })

      updates.push(`[${clan.tag}] ${clan.name}: ELO ${Math.round(clan.averageElo)}→${eloResult.averageElo}, Games: ${eloResult.totalGames}, Wins: ${eloResult.totalWins}`)
      updated++
    }
  }

  return NextResponse.json({
    success: true,
    message: `Actualizados ${updated} de ${clans.length} clanes`,
    stats: {
      total: clans.length,
      updated
    },
    updates: updates.slice(0, 30)
  })
}
