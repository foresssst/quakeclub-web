import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';


export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tag: string }> }
) {
  try {
    // Verificar sesión
    const session = await getSession();
    if (!session?.user?.steamId) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { tag } = await context.params;

    // Buscar o crear el Player primero
    let player = await prisma.player.findUnique({
      where: { steamId: session.user.steamId }
    });

    if (!player) {
      const playerId = `player_${session.user.steamId}_${Date.now()}`;
      player = await prisma.player.create({
        data: {
          id: playerId,
          steamId: session.user.steamId,
          username: session.user.username || 'Unknown',
          updatedAt: new Date(),
        },
      });
    }

    // Buscar el clan por tag
    const clan = await prisma.clan.findUnique({
      where: { tag },
      include: {
        ClanMember: {
          where: {
            playerId: player.id
          }
        },
        ClanJoinRequest: {
          where: {
            playerId: player.id,
            status: 'PENDING'
          }
        }
      }
    });

    if (!clan) {
      return NextResponse.json(
        { error: 'Clan no encontrado' },
        { status: 404 }
      );
    }

    // Verificar si ya es miembro
    if (clan.ClanMember.length > 0) {
      return NextResponse.json(
        { error: 'Ya eres miembro de este clan' },
        { status: 400 }
      );
    }

    // Verificar si ya pertenece a OTRO clan
    const existingMembership = await prisma.clanMember.findFirst({
      where: { playerId: player.id },
      include: { Clan: { select: { name: true, tag: true } } }
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: `Ya perteneces al clan [${existingMembership.Clan.tag}] ${existingMembership.Clan.name}` },
        { status: 400 }
      );
    }

    // Verificar si ya tiene una solicitud pendiente
    if (clan.ClanJoinRequest.length > 0) {
      return NextResponse.json(
        { error: 'Ya tienes una solicitud pendiente para este clan' },
        { status: 400 }
      );
    }

    // Obtener founder y admins para notificarlos
    const adminMembers = await prisma.clanMember.findMany({
      where: {
        clanId: clan.id,
        role: {
          in: ['FOUNDER', 'ADMIN']
        }
      },
      select: {
        playerId: true
      }
    });

    // Crear la solicitud y notificaciones en una transacción
    const requestId = `join_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const joinRequest = await prisma.$transaction(async (tx) => {
      // Crear la solicitud
      const request = await tx.clanJoinRequest.create({
        data: {
          id: requestId,
          clanId: clan.id,
          playerId: player.id,
          steamId: session.user.steamId!,
          message: `${session.user.username} quiere unirse al clan`,
          status: 'PENDING',
        },
      });

      // Crear notificaciones para todos los admins/founders
      const notifications = adminMembers.map((member, index) => ({
        id: `notif_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
        userId: member.playerId,
        type: 'CLAN_REQUEST' as const,
        title: `Solicitud para unirse a [${clan.tag}]`,
        message: `${session.user.username} quiere unirse al clan ${clan.name}`,
        link: `/clanes/${clan.slug}/requests`,
        metadata: {
          requestId: requestId,
          clanId: clan.id,
          clanTag: clan.tag,
          clanName: clan.name,
          playerUsername: session.user.username,
          playerId: player.id,
        },
      }));

      if (notifications.length > 0) {
        await tx.notification.createMany({
          data: notifications,
        });
      }

      return request;
    });

    return NextResponse.json({
      success: true,
      joinRequest,
    });

  } catch (error) {
    console.error('Error creating join request:', error);
    return NextResponse.json(
      { error: 'Error al crear la solicitud' },
      { status: 500 }
    );
  }
}

// GET: Obtener todas las solicitudes pendientes de un clan (solo FOUNDER/ADMIN)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tag: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.steamId) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { tag } = await context.params;

    // Buscar el jugador primero
    const player = await prisma.player.findUnique({
      where: { steamId: session.user.steamId }
    });

    if (!player) {
      return NextResponse.json(
        { error: 'Jugador no encontrado' },
        { status: 404 }
      );
    }

    // Buscar el clan
    const clan = await prisma.clan.findUnique({
      where: { tag },
      include: {
        ClanMember: {
          where: {
            playerId: player.id
          }
        }
      }
    });

    if (!clan) {
      return NextResponse.json(
        { error: 'Clan no encontrado' },
        { status: 404 }
      );
    }

    // Verificar que sea FOUNDER o ADMIN
    const member = clan.ClanMember[0];
    if (!member || (member.role !== 'FOUNDER' && member.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'No tienes permisos para ver las solicitudes' },
        { status: 403 }
      );
    }

    // Obtener solicitudes pendientes
    const joinRequests = await prisma.clanJoinRequest.findMany({
      where: {
        clanId: clan.id,
        status: 'PENDING'
      },
      include: {
        Player: {
          select: {
            steamId: true,
            username: true,
            avatar: true,
            PlayerRating: {
              orderBy: {
                updatedAt: 'desc'
              },
              take: 1,
              select: {
                rating: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform to lowercase 'player' to match frontend interface
    const transformedRequests = joinRequests.map(req => ({
      id: req.id,
      message: req.message,
      createdAt: req.createdAt,
      steamId: req.steamId,
      player: {
        steamId: req.Player.steamId,
        username: req.Player.username,
        avatar: req.Player.avatar,
        PlayerRating: req.Player.PlayerRating
      }
    }));

    return NextResponse.json({
      success: true,
      requests: transformedRequests,
    });

  } catch (error) {
    console.error('Error fetching join requests:', error);
    return NextResponse.json(
      { error: 'Error al obtener las solicitudes' },
      { status: 500 }
    );
  }
}
