import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';


interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: Params) {
  try {
    // Verificar autenticación
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const inviterSteamId = session.user.steamId;

    if (!inviterSteamId) {
      return NextResponse.json({ error: 'Se requiere Steam ID' }, { status: 400 });
    }

    // Obtener el ID del clan desde los parámetros
    const { id: clanId } = await context.params;

    // Obtener datos del request
    const body = await request.json();
    const { inviteeSteamId, message } = body;

    // Validaciones
    if (!inviteeSteamId) {
      return NextResponse.json({ error: 'Se requiere el Steam ID del jugador a invitar' }, { status: 400 });
    }

    // Verificar que el invitador existe
    const inviter = await prisma.player.findUnique({
      where: { steamId: inviterSteamId }
    });

    if (!inviter) {
      return NextResponse.json({ error: 'Invitador no encontrado' }, { status: 404 });
    }

    // Verificar que el clan existe
    const clan = await prisma.clan.findUnique({
      where: { id: clanId }
    });

    if (!clan) {
      return NextResponse.json({ error: 'Clan no encontrado' }, { status: 404 });
    }

    // Verificar permisos (FOUNDER o ADMIN)
    const inviterMembership = await prisma.clanMember.findFirst({
      where: {
        clanId: clanId,
        playerId: inviter.id
      }
    });

    if (!inviterMembership) {
      return NextResponse.json({ error: 'No eres miembro de este clan' }, { status: 403 });
    }

    if (inviterMembership.role !== 'FOUNDER' && inviterMembership.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No tienes permisos para invitar jugadores' },
        { status: 403 }
      );
    }

    // Verificar que el invitado existe
    const invitee = await prisma.player.findUnique({
      where: { steamId: inviteeSteamId }
    });

    if (!invitee) {
      return NextResponse.json(
        { error: 'El jugador que intentas invitar no existe' },
        { status: 404 }
      );
    }

    // Verificar que el invitado no está ya en el clan
    const existingMembership = await prisma.clanMember.findFirst({
      where: {
        clanId: clanId,
        playerId: invitee.id
      }
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: 'Este jugador ya es miembro del clan' },
        { status: 400 }
      );
    }

    // Verificar que el invitado no está en otro clan
    const otherClanMembership = await prisma.clanMember.findFirst({
      where: { playerId: invitee.id },
      include: { Clan: { select: { name: true, tag: true } } }
    });

    if (otherClanMembership) {
      return NextResponse.json(
        { error: `Este jugador ya pertenece al clan [${otherClanMembership.Clan.tag}] ${otherClanMembership.Clan.name}` },
        { status: 400 }
      );
    }

    // Verificar que no existe una invitación pendiente
    const existingInvitation = await prisma.clanInvitation.findFirst({
      where: {
        clanId: clanId,
        inviteeId: invitee.id,
        status: 'PENDING'
      }
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: 'Ya existe una invitación pendiente para este jugador' },
        { status: 400 }
      );
    }

    // Crear la invitación y notificación en una transacción
    const invitationId = `invitation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const [invitation] = await prisma.$transaction([
      // Crear invitación
      prisma.clanInvitation.create({
        data: {
          id: invitationId,
          clanId: clanId,
          inviterId: inviter.id,
          inviteeId: invitee.id,
          status: 'PENDING',
          message: message?.trim() || null
        },
        include: {
          Clan: {
            select: {
              id: true,
              name: true,
              tag: true
            }
          },
          Player_ClanInvitation_inviterIdToPlayer: {
            select: {
              steamId: true,
              username: true
            }
          },
          Player_ClanInvitation_inviteeIdToPlayer: {
            select: {
              steamId: true,
              username: true
            }
          }
        }
      }),
      // Crear notificación para el invitado
      prisma.notification.create({
        data: {
          id: notificationId,
          userId: invitee.id,
          type: 'CLAN_INVITE',
          title: `Invitación de [${clan.tag}]`,
          message: `${inviter.username} te ha invitado a unirte al clan ${clan.name}`,
          link: '/clanes/invitaciones',
          metadata: {
            invitationId: invitationId,
            clanId: clan.id,
            clanTag: clan.tag,
            clanName: clan.name,
            inviterUsername: inviter.username,
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        clan: {
          id: invitation.Clan.id,
          name: invitation.Clan.name,
          tag: invitation.Clan.tag
        },
        inviter: {
          steamId: invitation.Player_ClanInvitation_inviterIdToPlayer.steamId,
          username: invitation.Player_ClanInvitation_inviterIdToPlayer.username
        },
        invitee: {
          steamId: invitation.Player_ClanInvitation_inviteeIdToPlayer.steamId,
          username: invitation.Player_ClanInvitation_inviteeIdToPlayer.username
        },
        message: invitation.message,
        status: invitation.status,
        createdAt: invitation.createdAt
      }
    });

  } catch (error) {
    console.error('Error creating invitation:', error);
    return NextResponse.json(
      { error: 'Error al crear la invitación' },
      { status: 500 }
    );
  }
}
