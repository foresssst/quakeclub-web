import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

// Cache por modo de juego
const godsCache: Map<string, { data: WeaponGod[]; timestamp: number }> = new Map()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutos

interface WeaponGod {
  title: string
  weapon: string
  weaponIcon: string
  player: {
    steamId: string
    username: string
    avatar: string | null
    clan?: {
      tag: string
      name: string
      avatarUrl: string | null
    } | null
  }
  stat: number
  statLabel: string
}

// Requisitos para ser Weapon God - consistentes con sistema de tiers
// Tier 1 (2000 ELO) = jugadores de alto nivel
const MODE_REQUIREMENTS: Record<string, {
  minElo: number
  minGames: number
  minKillsRG: number
  minKillsLG: number
  minKillsRL: number
  minKillsSG: number
  minKillsPG: number
}> = {
  ca: {
    minElo: 2000,
    minGames: 35,
    minKillsRG: 300,
    minKillsLG: 300,
    minKillsRL: 300,
    minKillsSG: 30,
    minKillsPG: 10,
  },
  duel: {
    minElo: 2000,
    minGames: 35,
    minKillsRG: 300,
    minKillsLG: 300,
    minKillsRL: 300,
    minKillsSG: 30,
    minKillsPG: 10,
  },
  ctf: {
    minElo: 2000,
    minGames: 35,
    minKillsRG: 300,
    minKillsLG: 300,
    minKillsRL: 300,
    minKillsSG: 30,
    minKillsPG: 10,
  },
  tdm: {
    minElo: 2000,
    minGames: 35,
    minKillsRG: 300,
    minKillsLG: 300,
    minKillsRL: 300,
    minKillsSG: 30,
    minKillsPG: 10,
  },
  ffa: {
    minElo: 2000,
    minGames: 35,
    minKillsRG: 300,
    minKillsLG: 300,
    minKillsRL: 300,
    minKillsSG: 30,
    minKillsPG: 10,
  },
}

// Allowed weapon keys for validation
const VALID_WEAPONS = ["RG", "LG", "RL", "SG", "PG"] as const

const WEAPONS = [
  { key: "RG" as const, title: "railGod", name: "Railgun", icon: "/weapons/railgun.png", isPrimary: true },
  { key: "LG" as const, title: "lightningGod", name: "Lightning Gun", icon: "/weapons/lightning.png", isPrimary: true },
  { key: "RL" as const, title: "rocketGod", name: "Rocket Launcher", icon: "/weapons/rocket.png", isPrimary: true },
  { key: "SG" as const, title: "shotgunGod", name: "Shotgun", icon: "/weapons/shotgun.png", isPrimary: false },
  { key: "PG" as const, title: "plasmaGod", name: "Plasma Gun", icon: "/weapons/plasma.png", isPrimary: false },
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const gameType = searchParams.get("gameType") || "ca"

    // Validar modo de juego
    if (!MODE_REQUIREMENTS[gameType]) {
      return NextResponse.json({ gods: [], error: "Invalid game type" }, { status: 400 })
    }

    // Verificar cache para este modo
    const now = Date.now()
    const cached = godsCache.get(gameType)
    if (cached && now - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ gods: cached.data, gameType })
    }

    const reqs = MODE_REQUIREMENTS[gameType]
    const gods: WeaponGod[] = []

    // Obtener el mejor jugador para cada arma
    for (const weapon of WEAPONS) {
      const minKills = reqs[`minKills${weapon.key}` as keyof typeof reqs] as number

      try {
        // Use Prisma.sql with Prisma.raw for the enum cast
        // The weapon key is validated against a whitelist so this is safe from SQL injection
        const weaponEnum = Prisma.raw(`'${weapon.key}'::"Weapon"`)

        const godData = await prisma.$queryRaw<Array<{
          playerId: string
          steamId: string
          username: string
          avatar: string | null
          totalKills: bigint
          totalHits: bigint
          totalShots: bigint
          realAccuracy: number
        }>>(Prisma.sql`
          SELECT
            p.id as "playerId",
            p."steamId",
            p.username,
            p.avatar,
            SUM(ws.kills) as "totalKills",
            SUM(ws.hits) as "totalHits",
            SUM(ws.shots) as "totalShots",
            CASE WHEN SUM(ws.shots) > 0 THEN (SUM(ws.hits)::float / SUM(ws.shots)::float) * 100 ELSE 0 END as "realAccuracy"
          FROM "WeaponStats" ws
          JOIN "Player" p ON ws."playerId" = p.id
          JOIN "PlayerMatchStats" pms ON ws."playerMatchStatsId" = pms.id
          JOIN "Match" m ON pms."matchId" = m.id
          JOIN "PlayerRating" pr ON pr."steamId" = p."steamId" AND pr."gameType" = ${gameType} AND pr."ratingType" = 'public'
          WHERE ws.weapon = ${weaponEnum}
            AND ws.shots > 0
            AND m."gameType" = ${gameType}
            AND pr.rating >= ${reqs.minElo}
            AND pr."totalGames" >= ${reqs.minGames}
          GROUP BY p.id, p."steamId", p.username, p.avatar
          HAVING SUM(ws.kills) >= ${minKills}
          ORDER BY (SUM(ws.hits)::float / SUM(ws.shots)::float) DESC
          LIMIT 1
        `)

        if (godData.length > 0) {
          const data = godData[0]

          // Get clan info
          const clanMember = await prisma.clanMember.findFirst({
            where: { playerId: data.playerId },
            include: {
              Clan: {
                select: { tag: true, name: true, avatarUrl: true }
              }
            }
          })

          gods.push({
            title: weapon.title,
            weapon: weapon.name,
            weaponIcon: weapon.icon,
            player: {
              steamId: data.steamId,
              username: data.username,
              avatar: data.avatar,
              clan: clanMember ? {
                tag: clanMember.Clan.tag,
                name: clanMember.Clan.name,
                avatarUrl: clanMember.Clan.avatarUrl,
              } : null,
            },
            stat: Math.round(data.realAccuracy * 10) / 10,
            statLabel: "bestAccuracy",
          })
        }
      } catch (weaponError) {
        console.error(`Error fetching god for ${weapon.key}:`, weaponError)
        // Continue with other weapons even if one fails
      }
    }

    // Actualizar cache
    godsCache.set(gameType, { data: gods, timestamp: now })

    return NextResponse.json({ gods, gameType })
  } catch (error) {
    console.error("Error fetching weapon gods:", error)
    return NextResponse.json({ gods: [] }, { status: 500 })
  }
}
