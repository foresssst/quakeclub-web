import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// GET /api/admin/join-requests
// Obtener todas las solicitudes de unión pendientes (admin only)
export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const joinRequests = await prisma.clanJoinRequest.findMany({
      where: {
        status: 'PENDING',
      },
      include: {
        Clan: {
          select: {
            id: true,
            name: true,
            tag: true,
            slug: true,
            avatarUrl: true,
            _count: {
              select: {
                ClanMember: true,
              },
            },
          },
        },
        Player: {
          select: {
            id: true,
            steamId: true,
            username: true,
            avatar: true,
            countryCode: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const formattedRequests = joinRequests.map((req) => ({
      id: req.id,
      status: req.status,
      createdAt: req.createdAt,
      Clan: {
        id: req.Clan.id,
        name: req.Clan.name,
        tag: req.Clan.tag,
        slug: req.Clan.slug,
        avatarUrl: req.Clan.avatarUrl,
        memberCount: req.Clan._count.ClanMember,
      },
      Player: {
        id: req.Player.id,
        steamId: req.Player.steamId,
        username: req.Player.username,
        avatar: req.Player.avatar,
        countryCode: req.Player.countryCode,
      },
    }))

    return NextResponse.json({
      success: true,
      requests: formattedRequests,
      total: formattedRequests.length,
    })
  } catch (error) {
    console.error('Error fetching join requests:', error)
    return NextResponse.json(
      { error: 'Error al obtener solicitudes' },
      { status: 500 }
    )
  }
}
