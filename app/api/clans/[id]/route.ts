import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateClanAverageElo } from '@/lib/clan-elo';

interface Params {
  params: Promise<{ id: string }>;
}

// GET /api/clans/[id] - Detalles de un clan específico
export async function GET(request: NextRequest, context: Params) {
  try {
    const { id: clanId } = await context.params;

    const clan = await prisma.clan.findUnique({
      where: { id: clanId },
      include: {
        Player: {
          select: { steamId: true, username: true }
        },
        ClanMember: {
          include: {
            Player: {
              select: { steamId: true, username: true },
              include: {
                PlayerRating: { where: { ratingType: 'public' } }
              }
            }
          },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }]
        },
        _count: {
          select: { ClanMember: true, ClanInvitation: true }
        }
      }
    });

    if (!clan) {
      return NextResponse.json({ error: 'Clan no encontrado' }, { status: 404 });
    }

    // Calcular ELO en tiempo real usando la función centralizada
    const eloStats = await calculateClanAverageElo(clanId, 'overall');

    return NextResponse.json({
      success: true,
      clan: {
        id: clan.id,
        name: clan.name,
        tag: clan.tag,
        description: clan.description,
        averageElo: eloStats.averageElo,
        totalGames: eloStats.totalGames,
        totalWins: eloStats.totalWins,
        createdAt: clan.createdAt,
        updatedAt: clan.updatedAt,
        founder: {
          steamId: clan.Player.steamId,
          username: clan.Player.username
        },
        memberCount: clan._count.ClanMember,
        pendingInvitations: clan._count.ClanInvitation,
        members: clan.ClanMember.map((m: any) => {
          const ratings = m.Player.PlayerRating;
          const avgRating = ratings.length > 0
            ? Math.round(ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / ratings.length)
            : 900;
          return {
            steamId: m.Player.steamId,
            username: m.Player.username,
            role: m.role,
            joinedAt: m.joinedAt,
            eloRating: avgRating
          };
        })
      }
    });

  } catch (error) {
    console.error('Error fetching clan details:', error);
    return NextResponse.json(
      { error: 'Error al obtener los detalles del clan' },
      { status: 500 }
    );
  }
}
