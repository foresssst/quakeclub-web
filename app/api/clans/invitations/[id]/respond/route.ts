import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { calculateClanAverageElo } from '@/lib/clan-elo'

interface Params {
  params: Promise<{ id: string }>
}

// POST /api/clans/invitations/[id]/respond
// Responder a una invitación de clan (aceptar o rechazar)
export async function POST(request: NextRequest, context: Params) {
  try {
    const session = await getSession()
    if (!session?.user?.steamId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id: invitationId } = await context.params
    const { action } = await request.json()

    if (action !== 'accept' && action !== 'reject') {
      return NextResponse.json(
        { error: 'Acción inválida. Usa "accept" o "reject"' },
        { status: 400 }
      )
    }

    // Buscar la invitación
    const invitation = await prisma.clanInvitation.findUnique({
      where: { id: invitationId },
      include: {
        Clan: true,
        Player_ClanInvitation_inviteeIdToPlayer: true,
      },
    })

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitación no encontrada' },
        { status: 404 }
      )
    }

    // Verificar que el usuario es el invitado
    if (invitation.Player_ClanInvitation_inviteeIdToPlayer.steamId !== session.user.steamId) {
      return NextResponse.json(
        { error: 'No tienes permiso para responder a esta invitación' },
        { status: 403 }
      )
    }

    // Verificar que la invitación está pendiente
    if (invitation.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Esta invitación ya fue respondida' },
        { status: 400 }
      )
    }

    if (action === 'accept') {
      // Verificar que el usuario no está en otro clan
      const existingMembership = await prisma.clanMember.findFirst({
        where: {
          playerId: invitation.inviteeId,
        },
      })

      if (existingMembership) {
        // Rechazar la invitación automáticamente
        await prisma.clanInvitation.update({
          where: { id: invitationId },
          data: { status: 'REJECTED' },
        })

        return NextResponse.json(
          { error: 'Ya perteneces a otro clan. La invitación ha sido rechazada automáticamente.' },
          { status: 400 }
        )
      }

      // Obtener el rating del jugador
      const playerRating = await prisma.playerRating.findFirst({
        where: {
          steamId: session.user.steamId,
          gameType: 'OVERALL',
        },
        orderBy: { updatedAt: 'desc' },
      })

      const playerElo = playerRating?.rating || 900.0

      // Aceptar: Crear membresía, actualizar invitación, crear notificación
      const memberId = `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      await prisma.$transaction([
        // Crear membresía
        prisma.clanMember.create({
          data: {
            id: memberId,
            clanId: invitation.clanId,
            playerId: invitation.inviteeId,
            steamId: session.user.steamId,
            role: 'MEMBER',
          },
        }),
        // Actualizar estado de invitación
        prisma.clanInvitation.update({
          where: { id: invitationId },
          data: { status: 'ACCEPTED' },
        }),
        // Notificar al invitador/admins (opcional)
        prisma.notification.create({
          data: {
            id: notificationId,
            userId: invitation.inviterId,
            type: 'CLAN_INVITE',
            title: `¡${session.user.username} aceptó!`,
            message: `${session.user.username} ha aceptado la invitación a [${invitation.Clan.tag}] ${invitation.Clan.name}`,
            link: `/clanes/${invitation.Clan.slug}`,
          },
        }),
      ])

      // Recalcular ELO con la función centralizada
      const eloResult = await calculateClanAverageElo(invitation.clanId)
      await prisma.clan.update({ where: { id: invitation.clanId }, data: { averageElo: eloResult.averageElo, totalGames: eloResult.totalGames, totalWins: eloResult.totalWins, updatedAt: new Date() } })

      return NextResponse.json({
        success: true,
        message: `Te has unido a [${invitation.Clan.tag}] ${invitation.Clan.name}`,
        clan: {
          id: invitation.Clan.id,
          tag: invitation.Clan.tag,
          name: invitation.Clan.name,
        },
      })
    } else {
      // Rechazar: Actualizar invitación
      await prisma.clanInvitation.update({
        where: { id: invitationId },
        data: { status: 'REJECTED' },
      })

      return NextResponse.json({
        success: true,
        message: `Has rechazado la invitación a [${invitation.Clan.tag}] ${invitation.Clan.name}`,
      })
    }
  } catch (error) {
    console.error('Error responding to invitation:', error)
    return NextResponse.json(
      { error: 'Error al responder a la invitación' },
      { status: 500 }
    )
  }
}
