import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// GET /api/clans/invitations
// Obtener todas las invitaciones del usuario autenticado
export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user?.steamId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Buscar el jugador
    const player = await prisma.player.findUnique({
      where: { steamId: session.user.steamId },
    })

    if (!player) {
      return NextResponse.json({ invitations: [] })
    }

    // Obtener todas las invitaciones del jugador
    const invitations = await prisma.clanInvitation.findMany({
      where: {
        inviteeId: player.id,
      },
      include: {
        Clan: {
          select: {
            id: true,
            name: true,
            tag: true,
            slug: true,
            avatarUrl: true,
            averageElo: true,
            _count: {
              select: {
                ClanMember: true,
              },
            },
          },
        },
        Player_ClanInvitation_inviterIdToPlayer: {
          select: {
            steamId: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Formatear las invitaciones
    const formattedInvitations = invitations.map((inv) => ({
      id: inv.id,
      status: inv.status,
      message: inv.message,
      createdAt: inv.createdAt,
      Clan: {
        id: inv.Clan.id,
        name: inv.Clan.name,
        tag: inv.Clan.tag,
        slug: inv.Clan.slug,
        avatarUrl: inv.Clan.avatarUrl,
        averageElo: inv.Clan.averageElo,
        memberCount: inv.Clan._count.ClanMember,
      },
      Inviter: {
        steamId: inv.Player_ClanInvitation_inviterIdToPlayer.steamId,
        username: inv.Player_ClanInvitation_inviterIdToPlayer.username,
        avatar: inv.Player_ClanInvitation_inviterIdToPlayer.avatar,
      },
    }))

    return NextResponse.json({
      success: true,
      invitations: formattedInvitations,
    })
  } catch (error) {
    console.error('Error fetching invitations:', error)
    return NextResponse.json(
      { error: 'Error al obtener invitaciones' },
      { status: 500 }
    )
  }
}
