import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUsersBySteamIds } from '@/lib/auth';
import { getSteamPlayersBatch } from '@/lib/steam';
import { computeClanEloFromMembers, buildRatingFilter } from '@/lib/clan-elo';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tag: string }> }
) {
  try {
    const { tag } = await params;
    const { searchParams } = new URL(request.url);
    const gameType = searchParams.get('gameType') || 'overall';

    // Buscar el clan por tag (case-insensitive)
    const clan = await prisma.clan.findUnique({
      where: { tag: tag.toUpperCase() },
      include: {
        Player: {
          select: {
            username: true,
            steamId: true,
          },
        },
        ClanMember: {
          orderBy: [
            { role: 'asc' }, // FOUNDER primero
            { joinedAt: 'asc' },
          ],
          include: {
            Player: {
              include: {
                PlayerRating: buildRatingFilter(gameType)
              },
            },
          },
        },
        _count: {
          select: {
            ClanMember: true,
          },
        },
      },
    });

    if (!clan) {
      return NextResponse.json(
        { error: 'Clan no encontrado' },
        { status: 404 }
      );
    }

    // Calcular ELO usando la función centralizada
    const eloResult = computeClanEloFromMembers(clan.ClanMember, gameType);

    // Obtener datos de Steam para los miembros (solo para nicknames)
    const memberSteamIds = clan.ClanMember.map((m: any) => m.Player.steamId);
    const steamData = await getSteamPlayersBatch(memberSteamIds);

    // También obtener datos del fundador
    const founderSteamData = await getSteamPlayersBatch([clan.Player.steamId]);
    const founderData = founderSteamData.get(clan.Player.steamId);

    // Combinar datos: usar Steam nickname pero mantener avatar custom de la BD
    const usersMap = getUsersBySteamIds(clan.ClanMember.map((m: any) => m.Player.steamId))
    const membersWithSteamData = clan.ClanMember.map((m: any) => {
      const steamInfo = steamData.get(m.Player.steamId);
      const user = usersMap.get(m.Player.steamId);

      return {
        ...m,
        player: {
          ...m.Player,
          username: steamInfo?.username || m.Player.username,
          avatar: user?.avatar || steamInfo?.avatar || null,
          PlayerRating: m.Player.PlayerRating
        }
      };
    });

    return NextResponse.json({
      success: true,
      gameType: gameType,
      clan: {
        id: clan.id,
        name: clan.name,
        tag: clan.tag,
        slug: clan.slug,
        inGameTag: clan.inGameTag,
        description: clan.description,
        avatarUrl: clan.avatarUrl,
        averageElo: eloResult.averageElo,
        totalGames: eloResult.totalGames,
        totalWins: eloResult.totalWins,
        createdAt: clan.createdAt.toISOString(),
        founder: {
          ...clan.Player,
          username: founderData?.username || clan.Player.username
        },
        memberCount: clan._count.ClanMember,
        members: membersWithSteamData,
      },
    });
  } catch (error) {
    console.error('Error fetching clan by tag:', error);
    return NextResponse.json(
      { error: 'Error al cargar el clan' },
      { status: 500 }
    );
  }
}
