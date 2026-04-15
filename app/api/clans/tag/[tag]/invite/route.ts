import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';


export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tag: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !session.user.steamId) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { tag } = await params;
    const body = await request.json();
    const { playerSteamId, message } = body;

    if (!playerSteamId) {
      return NextResponse.json(
        { error: 'Steam ID del jugador es requerido' },
        { status: 400 }
      );
    }

    // Buscar el clan por tag
    const clan = await prisma.clan.findUnique({
      where: { tag: tag.toUpperCase() },
    });

    if (!clan) {
      return NextResponse.json(
        { error: 'Clan no encontrado' },
        { status: 404 }
      );
    }

    // Verificar que quien invita sea miembro del clan
    const inviter = await prisma.player.findUnique({
      where: { steamId: session.user.steamId },
    });

    if (!inviter) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Verificar que el inviter sea miembro del clan y tenga permisos
    const inviterMembership = await prisma.clanMember.findFirst({
      where: {
        clanId: clan.id,
        playerId: inviter.id,
      },
    });

    if (!inviterMembership) {
      return NextResponse.json(
        { error: 'No eres miembro de este clan' },
        { status: 403 }
      );
    }

    // Verificar que tenga permisos (FOUNDER o ADMIN)
    if (inviterMembership.role !== 'FOUNDER' && inviterMembership.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No tienes permisos para invitar jugadores' },
        { status: 403 }
      );
    }

    // Verificar que el jugador a invitar exista
    const invitee = await prisma.player.findUnique({
      where: { steamId: playerSteamId },
    });

    if (!invitee) {
      return NextResponse.json(
        { error: 'Jugador no encontrado' },
        { status: 404 }
      );
    }

    // Verificar que el invitado no esté ya en un clan
    const existingMembership = await prisma.clanMember.findFirst({
      where: { playerId: invitee.id },
      include: { Clan: { select: { name: true, tag: true } } }
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: `Este jugador ya pertenece al clan [${existingMembership.Clan.tag}] ${existingMembership.Clan.name}` },
        { status: 400 }
      );
    }

    // Verificar que no exista una invitación pendiente
    const existingInvitation = await prisma.clanInvitation.findFirst({
      where: {
        clanId: clan.id,
        inviteeId: invitee.id,
        status: 'PENDING',
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: 'Ya existe una invitación pendiente para este jugador' },
        { status: 400 }
      );
    }

    // Crear la invitación y la notificación en una transacción
    const invitationId = `invitation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const [invitation] = await prisma.$transaction([
      prisma.clanInvitation.create({
        data: {
          id: invitationId,
          clanId: clan.id,
          inviterId: inviter.id,
          inviteeId: invitee.id,
          message: message || null,
          status: 'PENDING',
        },
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
        clanId: clan.id,
        clanTag: clan.tag,
        inviteeUsername: invitee.username,
      },
    });
  } catch (error) {
    console.error('Error creating invitation:', error);
    return NextResponse.json(
      { error: 'Error al crear la invitación' },
      { status: 500 }
    );
  }
}
