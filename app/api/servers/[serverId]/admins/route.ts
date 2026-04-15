import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/servers/[serverId]/admins
 *
 * Returns the admin list for a specific game server.
 * Combines:
 *  - Global admins (Player.roles has "admin", "mod", or "founder")
 *  - Server-specific admins (ServerPermission for this serverId)
 *
 * Auth: x-api-key header (MINQLX_API_KEY) required.
 *
 * Response: { admins: [{ steamId, username, source }] }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  const apiKey = request.headers.get("x-api-key")
  if (apiKey !== process.env.MINQLX_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { serverId } = await params

  const [globalAdmins, serverPerms] = await Promise.all([
    prisma.player.findMany({
      where: {
        OR: [
          { roles: { has: "admin" } },
          { roles: { has: "mod" } },
          { roles: { has: "founder" } },
        ],
      },
      select: { steamId: true, username: true },
    }),
    prisma.serverPermission.findMany({
      where: { serverId },
      select: {
        steamId: true,
        player: { select: { username: true } },
      },
    }),
  ])

  // Merge, deduplicate by steamId
  const seen = new Set<string>()
  const admins: { steamId: string; username: string; source: string }[] = []

  for (const p of globalAdmins) {
    if (!seen.has(p.steamId)) {
      seen.add(p.steamId)
      admins.push({ steamId: p.steamId, username: p.username, source: "global" })
    }
  }

  for (const sp of serverPerms) {
    if (!seen.has(sp.steamId)) {
      seen.add(sp.steamId)
      admins.push({
        steamId: sp.steamId,
        username: sp.player.username,
        source: "server",
      })
    }
  }

  return NextResponse.json({ serverId, admins })
}
