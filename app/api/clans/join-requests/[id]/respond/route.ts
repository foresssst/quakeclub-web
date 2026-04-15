import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { calculateClanAverageElo } from '@/lib/clan-elo';


export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.steamId) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const { action } = await request.json(); // 'accept' or 'reject'

    if (action !== 'accept' && action !== 'reject') {
      return NextResponse.json(
        { error: 'Acción inválida. Usa "accept" o "reject"' },
        { status: 400 }
      );
    }

    // Buscar el jugador actual primero
    const currentPlayer = await prisma.player.findUnique({
      where: { steamId: session.user.steamId }
    });

    if (!currentPlayer) {
      return NextResponse.json(
        { error: 'Jugador no encontrado' },
        { status: 404 }
      );
    }

    // Buscar la solicitud
    const joinRequest = await prisma.clanJoinRequest.findUnique({
      where: { id },
      include: {
        Clan: {
          include: {
            ClanMember: {
              where: {
                playerId: currentPlayer.id
              }
            }
          }
        },
        Player: true
      }
    });

    if (!joinRequest) {
      return NextResponse.json(
        { error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    // Verificar que sea FOUNDER o ADMIN del clan
    const member = joinRequest.Clan.ClanMember[0];
    if (!member || (member.role !== 'FOUNDER' && member.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'No tienes permisos para gestionar solicitudes' },
        { status: 403 }
      );
    }

    // Verificar que la solicitud esté pendiente
    if (joinRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Esta solicitud ya fue procesada' },
        { status: 400 }
      );
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
            message: `Tu solicitud para unirte a ${joinRequest.Clan.name} ha sido aceptada`,
            link: `/clanes/${joinRequest.Clan.slug}`,
            metadata: {
              clanId: joinRequest.Clan.id,
              clanTag: joinRequest.Clan.tag,
              clanName: joinRequest.Clan.name,
              action: 'accepted',
            },
          },
        }),
        // Eliminar notificación de solicitud pendiente para los admins del clan
        prisma.notification.deleteMany({
          where: {
            type: 'CLAN_REQUEST',
            metadata: {
              path: ['requestId'],
              equals: id,
            },
          },
        }),
        // ELIMINAR solicitud en lugar de actualizar
        prisma.clanJoinRequest.delete({
          where: { id },
        }),
      ]);

      // Recalcular ELO con la función centralizada
      const eloResult = await calculateClanAverageElo(joinRequest.clanId);
      await prisma.clan.update({ where: { id: joinRequest.clanId }, data: { averageElo: eloResult.averageElo, totalGames: eloResult.totalGames, totalWins: eloResult.totalWins, updatedAt: new Date() } });

      return NextResponse.json({
        success: true,
        message: 'Solicitud aceptada. El jugador ahora es miembro del clan.',
      });
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
        // Eliminar notificación de solicitud pendiente para los admins del clan
        prisma.notification.deleteMany({
          where: {
            type: 'CLAN_REQUEST',
            metadata: {
              path: ['requestId'],
              equals: id,
            },
          },
        }),
        // Eliminar solicitud
        prisma.clanJoinRequest.delete({
          where: { id },
        }),
      ]);

      return NextResponse.json({
        success: true,
        message: 'Solicitud rechazada.',
      });
    }

  } catch (error) {
    console.error('Error responding to join request:', error);
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
}
