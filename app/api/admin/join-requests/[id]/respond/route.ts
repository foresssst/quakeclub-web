import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { calculateClanAverageElo } from '@/lib/clan-elo'

interface Params {
  params: Promise<{ id: string }>
}

// POST /api/admin/join-requests/[id]/respond
// Responder a solicitud de unión (solo admin)
export async function POST(request: NextRequest, context: Params) {
  try {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await context.params
    const { action } = await request.json() // 'accept' or 'reject'

    if (action !== 'accept' && action !== 'reject') {
      return NextResponse.json(
        { error: 'Acción inválida. Usa "accept" o "reject"' },
        { status: 400 }
      )
    }

    // Buscar la solicitud
    const joinRequest = await prisma.clanJoinRequest.findUnique({
      where: { id },
      include: {
        Clan: true,
        Player: true,
      },
    })

    if (!joinRequest) {
      return NextResponse.json(
        { error: 'Solicitud no encontrada' },
        { status: 404 }
      )
    }

    // Verificar que la solicitud esté pendiente
    if (joinRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Esta solicitud ya fue procesada' },
        { status: 400 }
      )
    }

    if (action === 'accept') {
      // Aceptar: agregar al clan, eliminar solicitud y notificar
      await prisma.$transaction([
        // Crear membresía
        prisma.clanMember.create({
          data: {
            id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            clanId: joinRequest.clanId,
            playerId: joinRequest.Player.id,
            steamId: joinRequest.steamId,
            role: 'MEMBER',
          },
        }),
        // Crear notificación para el jugador
        prisma.notification.create({
          data: {
            id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId: joinRequest.Player.id,
            type: 'CLAN_REQUEST',
            title: `¡Bienvenido a [${joinRequest.Clan.tag}]!`,
            message: `Tu solicitud para unirte a ${joinRequest.Clan.name} ha sido aceptada por un administrador`,
            link: `/clanes/${joinRequest.Clan.slug}`,
            metadata: {
              clanId: joinRequest.Clan.id,
              clanTag: joinRequest.Clan.tag,
              clanName: joinRequest.Clan.name,
              action: 'accepted',
            },
          },
        }),
        // ELIMINAR solicitud
        prisma.clanJoinRequest.delete({
          where: { id },
        }),
      ])

      // Recalcular ELO con la función centralizada
      const eloResult = await calculateClanAverageElo(joinRequest.clanId)
      await prisma.clan.update({ where: { id: joinRequest.clanId }, data: { averageElo: eloResult.averageElo, totalGames: eloResult.totalGames, totalWins: eloResult.totalWins, updatedAt: new Date() } })

      return NextResponse.json({
        success: true,
        message: 'Solicitud aceptada. El jugador ahora es miembro del clan.',
      })
    } else {
      // Rechazar: ELIMINAR solicitud y notificar
      await prisma.$transaction([
        // Crear notificación para el jugador
        prisma.notification.create({
          data: {
            id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId: joinRequest.Player.id,
            type: 'CLAN_REQUEST',
            title: `Solicitud rechazada`,
            message: `Tu solicitud para unirte a [${joinRequest.Clan.tag}] ${joinRequest.Clan.name} ha sido rechazada`,
            link: '/clanes',
            metadata: {
              clanId: joinRequest.Clan.id,
              clanTag: joinRequest.Clan.tag,
              clanName: joinRequest.Clan.name,
              action: 'rejected',
            },
          },
        }),
        // Eliminar solicitud
        prisma.clanJoinRequest.delete({
          where: { id },
        }),
      ])

      return NextResponse.json({
        success: true,
        message: 'Solicitud rechazada.',
      })
    }
  } catch (error) {
    console.error('Error responding to join request:', error)
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    )
  }
}
