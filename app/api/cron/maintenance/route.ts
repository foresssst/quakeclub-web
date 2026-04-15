import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Secret para autenticación del cron job
const CRON_SECRET = process.env.CRON_SECRET
if (!CRON_SECRET) {
  console.warn("WARNING: CRON_SECRET env var is not set. Cron endpoint will reject all requests.")
}

/**
 * API endpoint para tareas de mantenimiento ejecutadas por cron
 * 
 * Solo acepta requests desde localhost con el secret correcto
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar que viene de localhost o tiene el secret correcto
    const cronSecret = request.headers.get("X-Cron-Secret")
    const forwarded = request.headers.get("x-forwarded-for")
    const realIp = request.headers.get("x-real-ip")
    
    const isLocalhost = !forwarded && !realIp
    const hasValidSecret = cronSecret === CRON_SECRET

    if (!isLocalhost && !hasValidSecret) {
      console.log("[Cron] Acceso denegado - IP:", forwarded || realIp || "unknown")
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    const { action } = await request.json()
    const startTime = Date.now()

    console.log(`[Cron] Ejecutando: ${action}`)

    let result: any

    switch (action) {
      case "sync-wins-losses":
        result = await syncWinsLosses()
        break
      case "clear-rankings-cache":
        result = await clearCache()
        break
      case "check-consistency":
        result = await checkConsistency()
        break
      case "clean-sessions":
        result = await cleanSessions()
        break
      case "fix-usernames":
        result = await fixUsernames()
        break
      case "recalculate-clan-elo":
        result = await recalculateClanElo()
        break
      case "sync-steam-profiles":
        result = await syncSteamProfiles()
        break
      case "fix-elo-bounds":
        result = await fixEloBounds()
        break
      default:
        return NextResponse.json({ error: "Acción desconocida" }, { status: 400 })
    }

    const duration = Date.now() - startTime
    console.log(`[Cron] Completado: ${action} en ${duration}ms`)

    return NextResponse.json({
      success: true,
      action,
      duration: `${duration}ms`,
      ...result
    })
  } catch (error) {
    console.error("[Cron] Error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

async function syncWinsLosses() {
  const ratings = await prisma.playerRating.findMany({
    select: {
      id: true,
      steamId: true,
      gameType: true,
      wins: true,
      losses: true,
      totalGames: true
    }
  })

  let corrected = 0

  for (const rating of ratings) {
    const matches = await prisma.playerMatchStats.findMany({
      where: {
        steamId: rating.steamId,
        Match: { gameType: rating.gameType.toLowerCase() }
      },
      include: {
        Match: {
          select: { winner: true, team1Score: true, team2Score: true }
        }
      }
    })

    let wins = 0, losses = 0
    const gt = rating.gameType.toLowerCase()

    for (const pm of matches) {
      const match = pm.Match
      let winner = match.winner

      if (winner === null) {
        const t1 = match.team1Score ?? 0
        const t2 = match.team2Score ?? 0
        if (t1 > t2) winner = 1
        else if (t2 > t1) winner = 2
      }

      if (gt === 'duel') {
        const opponent = await prisma.playerMatchStats.findFirst({
          where: { matchId: pm.matchId, NOT: { steamId: rating.steamId } },
          select: { score: true }
        })
        if (opponent) {
          if (pm.score > opponent.score) wins++
          else losses++
        }
      } else if (gt === 'ffa') {
        // FFA: Solo RANK #1 gana, los demás pierden (como XonStat/QLStats)
        const allMatchStats = await prisma.playerMatchStats.findMany({
          where: { matchId: pm.matchId },
          select: { steamId: true, score: true }
        })
        if (allMatchStats.length > 0) {
          const maxScore = Math.max(...allMatchStats.map(s => s.score))
          if (pm.score === maxScore && pm.score > 0) wins++
          else losses++
        } else {
          losses++
        }
      } else if (pm.team && pm.team > 0) {
        if (winner === pm.team) wins++
        else losses++
      } else {
        if (pm.score > 0) wins++
        else losses++
      }
    }

    if (rating.wins !== wins || rating.losses !== losses) {
      await prisma.playerRating.update({
        where: { id: rating.id },
        data: { wins, losses, draws: 0, totalGames: wins + losses }
      })
      corrected++
    }
  }

  return { corrected, total: ratings.length }
}

async function clearCache() {
  try {
    const { rankingsCache } = await import('@/lib/rankings-service')
    if (rankingsCache?.clear) rankingsCache.clear()
    return { cleared: true }
  } catch {
    return { cleared: false, note: "No cache to clear" }
  }
}

async function checkConsistency() {
  const issues: string[] = []

  const clansWithoutMembers = await prisma.clan.count({
    where: { ClanMember: { none: {} } }
  })
  if (clansWithoutMembers > 0) issues.push(`${clansWithoutMembers} clanes sin miembros`)

  const matchesWithoutPlayers = await prisma.match.count({
    where: { PlayerMatchStats: { none: {} } }
  })
  if (matchesWithoutPlayers > 0) issues.push(`${matchesWithoutPlayers} partidas sin jugadores`)

  return { issues: issues.length, details: issues }
}

async function cleanSessions() {
  const fs = await import('fs')
  const path = await import('path')
  
  const sessionsPath = path.join(process.cwd(), "data", "sessions.json")
  if (!fs.existsSync(sessionsPath)) return { cleaned: 0 }

  try {
    const data = fs.readFileSync(sessionsPath, "utf-8")
    const sessions = JSON.parse(data)
    const now = Date.now()
    
    if (!Array.isArray(sessions)) {
      fs.writeFileSync(sessionsPath, "[]")
      return { cleaned: 0, reset: true }
    }

    const active = sessions.filter(([_, s]: [string, any]) => s?.expiresAt > now)
    const cleaned = sessions.length - active.length

    fs.writeFileSync(sessionsPath, JSON.stringify(active, null, 2))
    return { cleaned, remaining: active.length }
  } catch {
    return { cleaned: 0, error: true }
  }
}

async function fixUsernames() {
  const brokenPatterns = [/^\^[0-7]$/, /^\^[0-7]\s*$/, /^\s*$/]
  
  const players = await prisma.player.findMany({
    select: { id: true, steamId: true, username: true }
  })

  const broken = players.filter(p => 
    !p.username || brokenPatterns.some(pat => pat.test(p.username || ''))
  )

  let fixed = 0
  for (const player of broken) {
    const alias = await prisma.playerAlias.findFirst({
      where: { steamId: player.steamId, NOT: { alias: { in: ['^7', '', 'Unknown'] } } },
      orderBy: [{ timesUsed: 'desc' }]
    })

    const newName = alias?.alias?.replace(/\^[0-7]/g, '').trim() || `Player_${player.steamId.slice(-8)}`
    
    if (newName !== player.username) {
      await prisma.player.update({
        where: { id: player.id },
        data: { username: newName }
      })
      fixed++
    }
  }

  return { fixed, total: broken.length }
}

async function recalculateClanElo() {
  const { computeClanEloFromMembers, buildRatingFilter } = await import('@/lib/clan-elo')

  const clans = await prisma.clan.findMany({
    include: {
      ClanMember: {
        include: {
          Player: {
            include: {
              PlayerRating: buildRatingFilter(null) // overall: all public ratings
            }
          }
        }
      }
    }
  })

  let updated = 0
  for (const clan of clans) {
    if (clan.ClanMember.length === 0) continue

    const eloResult = computeClanEloFromMembers(clan.ClanMember, null)

    if (Math.abs(clan.averageElo - eloResult.averageElo) > 1) {
      await prisma.clan.update({
        where: { id: clan.id },
        data: {
          averageElo: eloResult.averageElo,
          totalGames: eloResult.totalGames,
          totalWins: eloResult.totalWins,
          updatedAt: new Date()
        }
      })
      updated++
    }
  }

  return { updated, total: clans.length }
}

async function syncSteamProfiles() {
  const STEAM_API_KEY = process.env.STEAM_API_KEY
  if (!STEAM_API_KEY) return { error: "No STEAM_API_KEY" }

  const players = await prisma.player.findMany({
    where: {
      OR: [
        { avatar: null },
        { avatar: '' },
        { username: { startsWith: 'Player_' } }
      ]
    },
    select: { id: true, steamId: true, username: true, avatar: true },
    take: 100 // Limitar a 100 por ejecución
  })

  if (players.length === 0) return { updated: 0, message: "All profiles up to date" }

  const steamIds = players.map(p => p.steamId).join(',')
  
  try {
    const res = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamIds}`
    )
    const data = await res.json()
    const steamPlayers = data.response?.players || []

    const steamMap = new Map(steamPlayers.map((p: any) => [
      p.steamid,
      { username: p.personaname, avatar: p.avatarfull || p.avatar }
    ]))

    let updated = 0
    for (const player of players) {
      const steam = steamMap.get(player.steamId) as any
      if (!steam) continue

      const updates: any = {}
      if (player.username?.startsWith('Player_') && steam.username) {
        updates.username = steam.username
      }
      if (!player.avatar && steam.avatar) {
        updates.avatar = steam.avatar
      }

      if (Object.keys(updates).length > 0) {
        await prisma.player.update({ where: { id: player.id }, data: updates })
        updated++
      }
    }

    return { updated, checked: players.length }
  } catch (error) {
    return { error: String(error) }
  }
}

const MIN_ELO = 100
const MAX_ELO_CHANGE = 150

async function fixEloBounds() {
  let fixedRatings = 0
  let fixedDeltas = 0
  let fixedWinners = 0

  // 1. Arreglar ratings < 100
  const lowRatings = await prisma.playerRating.findMany({
    where: { rating: { lt: MIN_ELO } }
  })

  for (const r of lowRatings) {
    await prisma.playerRating.update({
      where: { id: r.id },
      data: { rating: MIN_ELO }
    })
    fixedRatings++
  }

  // 2. Arreglar deltas extremos
  const extremeDeltas = await prisma.playerMatchStats.findMany({
    where: {
      OR: [
        { eloDelta: { gt: MAX_ELO_CHANGE } },
        { eloDelta: { lt: -MAX_ELO_CHANGE } }
      ]
    },
    take: 100
  })

  for (const pms of extremeDeltas) {
    let newDelta = pms.eloDelta || 0
    if (newDelta > MAX_ELO_CHANGE) newDelta = MAX_ELO_CHANGE
    else if (newDelta < -MAX_ELO_CHANGE) newDelta = -MAX_ELO_CHANGE

    const eloBefore = pms.eloBefore || 900
    let newEloAfter = eloBefore + newDelta
    if (newEloAfter < MIN_ELO) {
      newDelta = MIN_ELO - eloBefore
      if (newDelta > 0) newDelta = 0
      newEloAfter = Math.max(MIN_ELO, eloBefore + newDelta)
    }

    await prisma.playerMatchStats.update({
      where: { id: pms.id },
      data: { eloDelta: newDelta, eloAfter: newEloAfter }
    })
    fixedDeltas++
  }

  // 3. Arreglar ganadores que perdieron ELO
  const winnersWhoLost = await prisma.playerMatchStats.findMany({
    where: {
      eloDelta: { lt: 0 },
      team: { gt: 0 }
    },
    include: {
      Match: { select: { winner: true, team1Score: true, team2Score: true } }
    },
    take: 100
  })

  for (const pms of winnersWhoLost) {
    const match = pms.Match
    if (!match) continue

    let winningTeam = match.winner
    if (winningTeam === null) {
      const t1 = match.team1Score || 0
      const t2 = match.team2Score || 0
      if (t1 > t2) winningTeam = 1
      else if (t2 > t1) winningTeam = 2
    }

    if (winningTeam && pms.team === winningTeam) {
      const eloBefore = pms.eloBefore || 900
      await prisma.playerMatchStats.update({
        where: { id: pms.id },
        data: { eloDelta: 1, eloAfter: eloBefore + 1 }
      })
      fixedWinners++
    }
  }

  return { fixedRatings, fixedDeltas, fixedWinners }
}
