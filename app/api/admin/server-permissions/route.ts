import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SERVER_CATALOG } from "@/lib/server-catalog"

/**
 * GET /api/admin/server-permissions
 *
 * Returns global admins + per-server permissions + server catalog.
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [globalAdmins, serverPerms] = await Promise.all([
    prisma.player.findMany({
      where: {
        OR: [
          { roles: { has: "admin" } },
          { roles: { has: "mod" } },
          { roles: { has: "founder" } },
        ],
      },
      select: { steamId: true, username: true, avatar: true, roles: true },
      orderBy: { username: "asc" },
    }),
    prisma.serverPermission.findMany({
      include: {
        player: { select: { username: true, avatar: true } },
      },
      orderBy: { grantedAt: "desc" },
    }),
  ])

  return NextResponse.json({
    servers: SERVER_CATALOG,
    globalAdmins,
    serverPermissions: serverPerms,
  })
}

/**
 * POST /api/admin/server-permissions
 *
 * Add a per-server permission.
 * Body: { steamId: string, serverId: string, notes?: string }
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { steamId, serverId, notes } = body

  if (!steamId || !serverId) {
    return NextResponse.json(
      { error: "steamId y serverId son requeridos" },
      { status: 400 }
    )
  }

  // Validate server exists
  if (!SERVER_CATALOG.find((s) => s.id === serverId)) {
    return NextResponse.json(
      { error: "Servidor no válido" },
      { status: 400 }
    )
  }

  // Validate player exists
  const player = await prisma.player.findUnique({
    where: { steamId },
    select: { steamId: true, username: true, roles: true },
  })

  if (!player) {
    return NextResponse.json(
      { error: "Jugador no encontrado" },
      { status: 404 }
    )
  }

  // Check if already a global admin
  const isGlobal = player.roles.some((r) =>
    ["admin", "mod", "founder"].includes(r)
  )
  if (isGlobal) {
    return NextResponse.json(
      { error: "Este jugador ya es admin global (tiene rol admin/mod/founder)" },
      { status: 409 }
    )
  }

  const perm = await prisma.serverPermission.upsert({
    where: { steamId_serverId: { steamId, serverId } },
    update: {
      grantedBy: session.user.steamId || session.user.username,
      notes,
    },
    create: {
      steamId,
      serverId,
      grantedBy: session.user.steamId || session.user.username,
      notes,
    },
    include: {
      player: { select: { username: true, avatar: true } },
    },
  })

  return NextResponse.json({ success: true, permission: perm })
}

/**
 * DELETE /api/admin/server-permissions
 *
 * Remove a per-server permission.
 * Body: { steamId: string, serverId: string }
 */
export async function DELETE(request: NextRequest) {
  const session = await getSession()
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { steamId, serverId } = body

  if (!steamId || !serverId) {
    return NextResponse.json(
      { error: "steamId y serverId son requeridos" },
      { status: 400 }
    )
  }

  await prisma.serverPermission.deleteMany({
    where: { steamId, serverId },
  })

  return NextResponse.json({ success: true })
}
