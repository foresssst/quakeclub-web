import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Patrones de usernames problemáticos
const BROKEN_PATTERNS = [
  /^\^[0-7]$/,           // Solo código de color
  /^\^[0-7]\s*$/,        // Código de color con espacios
  /^\^x[0-9A-Fa-f]{3}$/, // Solo código de color extendido
  /^\s*$/,               // Solo espacios o vacío
]

function isUsernameBroken(username: string | null): boolean {
  if (!username || username.trim() === '') return true
  return BROKEN_PATTERNS.some(pattern => pattern.test(username))
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    // Obtener estadísticas de la base de datos
    const [
      allPlayers,
      totalClans,
      totalMatches,
      totalRatings,
      pendingJoinRequests,
      totalAliases,
      activePlayersCount
    ] = await Promise.all([
      prisma.player.findMany({ select: { username: true } }),
      prisma.clan.count(),
      prisma.match.count(),
      prisma.playerRating.count(),
      prisma.clanJoinRequest.count({ where: { status: 'PENDING' } }),
      prisma.playerAlias.count(),
      prisma.playerRating.findMany({
        where: {
          totalGames: { gte: 1 },
          lastPlayed: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Últimos 30 días
          }
        },
        select: { steamId: true },
        distinct: ['steamId']
      }).then(rows => rows.length)
    ])

    // Contar usernames rotos
    const brokenUsernames = allPlayers.filter(p => isUsernameBroken(p.username)).length

    return NextResponse.json({
      totalPlayers: allPlayers.length,
      brokenUsernames,
      activePlayers: activePlayersCount,
      totalClans,
      totalMatches,
      totalRatings,
      pendingJoinRequests,
      totalAliases,
    })
  } catch (error) {
    console.error("Error fetching maintenance stats:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
