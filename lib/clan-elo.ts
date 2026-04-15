/**
 * Funciones centralizadas para calcular ELO de clanes
 * FUENTE ÚNICA DE VERDAD — todos los endpoints deben usar estas funciones
 */

import { prisma } from '@/lib/prisma';

const DEFAULT_ELO = 900;

export interface ClanEloResult {
  averageElo: number;
  totalGames: number;
  totalWins: number;
  memberCount: number;
}

/**
 * Calcula el ELO promedio desde un array de miembros ya cargados con PlayerRating.
 * Esta es LA función canónica — todos los endpoints deben usar esta lógica.
 *
 * Reglas:
 * - Cada miembro suma su rating del gameType seleccionado (o 900 si no tiene)
 * - Se divide por el total de miembros (incluyendo los sin rating)
 * - Para 'overall': promedio de todos los modos del jugador
 * - Resultado siempre redondeado a entero
 */
export function computeClanEloFromMembers(
  members: Array<{
    Player: {
      PlayerRating: Array<{ rating: number; wins: number; losses: number; gameType: string; totalGames: number }>
    }
  }>,
  gameType: string | null
): ClanEloResult {
  if (members.length === 0) {
    return { averageElo: DEFAULT_ELO, totalGames: 0, totalWins: 0, memberCount: 0 };
  }

  let totalElo = 0;
  let totalGames = 0;
  let totalWins = 0;

  for (const member of members) {
    const ratings = member.Player.PlayerRating;

    if (ratings.length === 0) {
      totalElo += DEFAULT_ELO;
    } else if (!gameType || gameType === 'overall') {
      // Overall: promedio de todos los modos del jugador
      const playerAvg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
      totalElo += playerAvg;
      totalGames += ratings.reduce((sum, r) => sum + r.wins + r.losses, 0);
      totalWins += ratings.reduce((sum, r) => sum + r.wins, 0);
    } else {
      // Modo específico: tomar el rating de ese modo (ya filtrado en la query)
      const rating = ratings[0];
      totalElo += rating?.rating || DEFAULT_ELO;
      if (rating) {
        totalGames += rating.wins + rating.losses;
        totalWins += rating.wins;
      }
    }
  }

  return {
    averageElo: Math.round(totalElo / members.length),
    totalGames,
    totalWins,
    memberCount: members.length,
  };
}

/**
 * Construye el filtro de PlayerRating para la query de Prisma
 */
export function buildRatingFilter(gameType: string | null) {
  if (!gameType || gameType === 'overall') {
    return { where: { ratingType: 'public' as const } };
  }
  return { where: { gameType: gameType.toLowerCase(), ratingType: 'public' as const } };
}

/**
 * Calcula el ELO promedio de un clan específico por ID
 */
export async function calculateClanAverageElo(
  clanId: string,
  gameType: string = 'overall'
): Promise<ClanEloResult> {
  const clan = await prisma.clan.findUnique({
    where: { id: clanId },
    include: {
      ClanMember: {
        include: {
          Player: {
            include: {
              PlayerRating: buildRatingFilter(gameType)
            }
          }
        }
      }
    }
  });

  if (!clan) {
    return { averageElo: DEFAULT_ELO, totalGames: 0, totalWins: 0, memberCount: 0 };
  }

  return computeClanEloFromMembers(clan.ClanMember, gameType);
}

/**
 * Calcula el ELO promedio de múltiples clanes y retorna un ranking ordenado
 */
export async function calculateClansAverageElo(
  gameType: string = 'overall',
  limit: number = 20
) {
  const clans = await prisma.clan.findMany({
    include: {
      ClanMember: {
        include: {
          Player: {
            include: {
              PlayerRating: buildRatingFilter(gameType === 'overall' ? null : gameType)
            }
          }
        }
      }
    }
  });

  const clansWithElo = clans.map(clan => {
    const eloResult = computeClanEloFromMembers(clan.ClanMember, gameType === 'overall' ? null : gameType);
    return {
      id: clan.id,
      name: clan.name,
      tag: clan.tag,
      slug: clan.slug,
      avatarUrl: clan.avatarUrl,
      ...eloResult,
      memberCount: clan.ClanMember.length,
    };
  });

  return clansWithElo
    .filter(c => c.memberCount >= 4)
    .sort((a, b) => b.averageElo - a.averageElo)
    .slice(0, limit);
}

/**
 * Obtiene el top N de clanes por ELO promedio
 */
export async function getTopClans(limit: number = 10, gameType: string = 'overall') {
  return calculateClansAverageElo(gameType, limit);
}
