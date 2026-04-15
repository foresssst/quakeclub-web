import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

interface RouteParams {
  params: Promise<{
    steamId: string
  }>
}

// Requisitos consistentes con weapon-gods route y sistema de tiers
// Tier 1 (2000 ELO) = jugadores de alto nivel
const MIN_KILLS_RG = 300
const MIN_KILLS_LG = 300
const MIN_KILLS_RL = 300
const MIN_KILLS_SG = 30
const MIN_KILLS_PG = 10
const MIN_ELO = 2000  // Tier 1
const MIN_GAMES = 35

interface CurrentGod {
  username: string
  accuracy: number
  steamId: string
  avatar: string | null
}

interface WeaponProgress {
  weapon: string
  weaponKey: string
  weaponIcon: string
  currentKills: number
  requiredKills: number
  currentAccuracy: number
  meetsKillsReq: boolean
  meetsAllReqs: boolean
  currentRank: number | null
  potentialRank: number | null
  currentGod: CurrentGod | null
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { steamId } = await params
    const { searchParams } = new URL(request.url)
    const gameType = searchParams.get("gameType") || "ca"

    // Obtener info del jugador
    const player = await prisma.player.findUnique({
      where: { steamId },
      select: { id: true, steamId: true, username: true }
    })

    if (!player) {
      return NextResponse.json({ success: false, error: "Player not found" }, { status: 404 })
    }

    // Obtener rating en el gameType solicitado
    const playerRating = await prisma.playerRating.findFirst({
      where: { steamId, gameType },
      select: { rating: true, totalGames: true }
    })

    const playerElo = playerRating?.rating || 0
    const playerGames = playerRating?.totalGames || 0
    const meetsEloReq = playerElo >= MIN_ELO
    const meetsGamesReq = playerGames >= MIN_GAMES

    // Obtener stats de armas del jugador - filtrado por gameType
    const playerWeaponStats = await prisma.$queryRaw<Array<{
      weapon: string
      totalKills: bigint
      totalHits: bigint
      totalShots: bigint
    }>>`
      SELECT
        ws.weapon,
        SUM(ws.kills) as "totalKills",
        SUM(ws.hits) as "totalHits",
        SUM(ws.shots) as "totalShots"
      FROM "WeaponStats" ws
      JOIN "PlayerMatchStats" pms ON ws."playerMatchStatsId" = pms.id
      JOIN "Match" m ON pms."matchId" = m.id
      WHERE ws."playerId" = ${player.id}
        AND m."gameType" = ${gameType}
      GROUP BY ws.weapon
    `

    const weapons = [
      { key: "RG", name: "Railgun", icon: "/weapons/railgun.png", minKills: MIN_KILLS_RG },
      { key: "LG", name: "Lightning Gun", icon: "/weapons/lightning.png", minKills: MIN_KILLS_LG },
      { key: "RL", name: "Rocket Launcher", icon: "/weapons/rocket.png", minKills: MIN_KILLS_RL },
      { key: "SG", name: "Shotgun", icon: "/weapons/shotgun.png", minKills: MIN_KILLS_SG },
      { key: "PG", name: "Plasma Gun", icon: "/weapons/plasma.png", minKills: MIN_KILLS_PG },
    ]

    const progress: WeaponProgress[] = []

    for (const weapon of weapons) {
      const playerStats = playerWeaponStats.find(w => w.weapon === weapon.key)
      const kills = Number(playerStats?.totalKills || 0)
      const hits = Number(playerStats?.totalHits || 0)
      const shots = Number(playerStats?.totalShots || 0)
      const accuracy = shots > 0 ? (hits / shots) * 100 : 0

      const meetsKillsReq = kills >= weapon.minKills
      const meetsAllReqs = meetsEloReq && meetsGamesReq && meetsKillsReq

      // Obtener ranking potencial si calificara
      let potentialRank: number | null = null
      let currentRank: number | null = null

      // Obtener el actual #1 (god) de esta arma
      const currentGodData = await prisma.$queryRaw<Array<{
        username: string
        realAccuracy: number
        steamId: string
        avatar: string | null
      }>>`
        SELECT
          p.username,
          p."steamId",
          p.avatar,
          (SUM(ws.hits)::float / SUM(ws.shots)::float) * 100 as "realAccuracy"
        FROM "WeaponStats" ws
        JOIN "Player" p ON ws."playerId" = p.id
        JOIN "PlayerMatchStats" pms ON ws."playerMatchStatsId" = pms.id
        JOIN "Match" m ON pms."matchId" = m.id
        JOIN "PlayerRating" pr ON pr."steamId" = p."steamId" AND pr."gameType" = ${gameType} AND pr."ratingType" = 'public'
        WHERE ws.weapon = ${weapon.key}::"Weapon"
          AND ws.shots > 0
          AND m."gameType" = ${gameType}
          AND pr.rating >= ${MIN_ELO}
          AND pr."totalGames" >= ${MIN_GAMES}
        GROUP BY p.id, p.username, p."steamId", p.avatar
        HAVING SUM(ws.kills) >= ${weapon.minKills}
        ORDER BY (SUM(ws.hits)::float / SUM(ws.shots)::float) DESC
        LIMIT 1
      `

      const currentGod: CurrentGod | null = currentGodData.length > 0
        ? {
            username: currentGodData[0].username,
            accuracy: Math.round(currentGodData[0].realAccuracy * 10) / 10,
            steamId: currentGodData[0].steamId,
            avatar: currentGodData[0].avatar,
          }
        : null

      if (meetsAllReqs) {
        // Contar cuantos jugadores tienen mejor accuracy y cumplen requisitos (solo CA)
        const betterPlayers = await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(DISTINCT p.id) as count
          FROM "WeaponStats" ws
          JOIN "Player" p ON ws."playerId" = p.id
          JOIN "PlayerMatchStats" pms ON ws."playerMatchStatsId" = pms.id
          JOIN "Match" m ON pms."matchId" = m.id
          JOIN "PlayerRating" pr ON pr."steamId" = p."steamId" AND pr."gameType" = ${gameType}
          WHERE ws.weapon = ${weapon.key}::"Weapon"
            AND ws.shots > 0
            AND m."gameType" = ${gameType}
            AND pr.rating >= ${MIN_ELO}
            AND pr."totalGames" >= ${MIN_GAMES}
            AND p."steamId" != ${steamId}
          GROUP BY p.id
          HAVING SUM(ws.kills) >= ${weapon.minKills}
            AND (SUM(ws.hits)::float / SUM(ws.shots)::float) > ${accuracy / 100}
        `
        currentRank = (betterPlayers.length || 0) + 1
      } else if (shots > 0) {
        // Calcular posicion potencial si cumpliera todos los requisitos (solo CA)
        const betterAccuracyCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(DISTINCT p.id) as count
          FROM "WeaponStats" ws
          JOIN "Player" p ON ws."playerId" = p.id
          JOIN "PlayerMatchStats" pms ON ws."playerMatchStatsId" = pms.id
          JOIN "Match" m ON pms."matchId" = m.id
          JOIN "PlayerRating" pr ON pr."steamId" = p."steamId" AND pr."gameType" = ${gameType}
          WHERE ws.weapon = ${weapon.key}::"Weapon"
            AND ws.shots > 0
            AND m."gameType" = ${gameType}
            AND pr.rating >= ${MIN_ELO}
            AND pr."totalGames" >= ${MIN_GAMES}
          GROUP BY p.id
          HAVING SUM(ws.kills) >= ${weapon.minKills}
            AND (SUM(ws.hits)::float / SUM(ws.shots)::float) > ${accuracy / 100}
        `
        potentialRank = (betterAccuracyCount.length || 0) + 1
      }

      progress.push({
        weapon: weapon.name,
        weaponKey: weapon.key,
        weaponIcon: weapon.icon,
        currentKills: kills,
        requiredKills: weapon.minKills,
        currentAccuracy: Math.round(accuracy * 10) / 10,
        meetsKillsReq,
        meetsAllReqs,
        currentRank,
        potentialRank,
        currentGod,
      })
    }

    return NextResponse.json({
      success: true,
      steamId,
      requirements: {
        minElo: MIN_ELO,
        minGames: MIN_GAMES,
        playerElo,
        playerGames,
        meetsEloReq,
        meetsGamesReq,
      },
      progress,
    })
  } catch (error) {
    console.error("Error fetching weapon gods progress:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch progress" },
      { status: 500 }
    )
  }
}
