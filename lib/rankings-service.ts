/**
 * Servicio de Rankings de QuakeClub
 *
 * Maneja la obtención y cálculo de rankings de jugadores y clanes.
 * Incluye integración con Steam API para datos de perfil.
 *
 * FUNCIONES PRINCIPALES:
 * - getRankings: Rankings globales por tipo de juego
 * - getClanRankings: Rankings de clanes por ELO promedio
 * - getSteamPlayersBatch: Obtención de datos de Steam en lotes
 *
 * CACHE:
 * - Rankings se cachean para mejorar rendimiento
 * - TTL configurable por tipo de ranking
 */

import { prisma } from "@/lib/prisma"
import { cache } from "@/lib/cache"
import { getDisplayCountry } from "@/lib/country-detection"
import { getUsersBySteamIds } from "@/lib/auth"
import { getSteamPlayersBatch } from "@/lib/steam"
import { computeClanEloFromMembers, buildRatingFilter } from "@/lib/clan-elo"

// --- Interfaces ---

export interface RankingPlayer {
    playerId: string
    steamId: string
    username: string
    avatar?: string | null
    rating: number
    deviation: number
    totalGames: number
    wins: number
    losses: number
    winRate: number
    rank: number
    countryCode?: string
    lastPlayed?: string
    totalKills?: number
    totalDeaths?: number
    avgKD?: number
    clanTag?: string
    clanSlug?: string | null
    clanAvatarUrl?: string | null
}

export interface ClanRanking {
    slug?: string | null
    tag: string
    inGameTag?: string | null
    name: string
    members: number
    avgElo: number
    rank: number
    avatarUrl?: string | null
    avgKd: number
}

// --- Main Functions ---

export async function getActivePlayerCount(): Promise<number> {
    const cacheKey = "active-player-count"
    const cached = cache.get<number>(cacheKey)
    if (cached !== null) return cached

    try {
        // Count unique steamIds with > 5 games
        // Using groupBy is more efficient than fetching all records
        const result = await prisma.playerRating.groupBy({
            by: ['steamId'],
            where: { totalGames: { gte: 5 } },
            _count: { steamId: true }
        })

        const count = result.length
        cache.set(cacheKey, count, 10 * 60 * 1000) // 10 mins
        return count
    } catch (error) {
        console.error("[RankingsService] Error counting active players:", error)
        return 80 // Fallback
    }
}

export async function getTopRankings(limit: number = 10, gameType: string = "all"): Promise<RankingPlayer[]> {
    const cacheKey = `rankings:quakeclub:${gameType}:${limit}:v4`
    const cached = cache.get<RankingPlayer[]>(cacheKey)
    if (cached) return cached

    try {
        let overallRankings: RankingPlayer[] = []

        // Base where clause
        const baseWhere = {
            totalGames: { gte: gameType === 'all' ? 5 : getMinGamesForRanking(gameType) },
        }

        if (gameType === "all") {
            // Fetch all ratings to calculate overall average
            const allRatings = await prisma.playerRating.findMany({
                where: { ...baseWhere, ratingType: 'public' },
                select: {
                    playerId: true,
                    steamId: true,
                    rating: true,
                    deviation: true,
                    totalGames: true,
                    wins: true,
                    losses: true,
                    draws: true,
                    lastPlayed: true,
                },
            })

            const playerMap = new Map<string, any[]>()
            allRatings.forEach((r) => {
                if (!playerMap.has(r.steamId)) {
                    playerMap.set(r.steamId, [])
                }
                playerMap.get(r.steamId)!.push(r)
            })

            for (const [steamId, ratings] of playerMap.entries()) {
                const avgRating = Math.round(ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length)
                const avgDeviation = Math.round(ratings.reduce((sum, r) => sum + r.deviation, 0) / ratings.length)
                const totalGames = ratings.reduce((sum, r) => sum + r.totalGames, 0)
                const totalWins = ratings.reduce((sum, r) => sum + r.wins, 0)
                const totalLosses = ratings.reduce((sum, r) => sum + r.losses, 0)
                const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0

                const mostRecentDate = ratings.reduce((latest, r) => {
                    return !latest || new Date(r.lastPlayed) > new Date(latest) ? r.lastPlayed : latest
                }, null as Date | null)

                overallRankings.push({
                    playerId: ratings[0].playerId,
                    steamId,
                    username: "", // Will be filled later
                    rating: avgRating,
                    deviation: avgDeviation,
                    totalGames,
                    wins: totalWins,
                    losses: totalLosses,
                    winRate,
                    rank: 0,
                    lastPlayed: mostRecentDate?.toISOString(),
                })
            }

            overallRankings.sort((a, b) => b.rating - a.rating)
            overallRankings = overallRankings.slice(0, limit)
        } else {
            // Specific game type
            const ratings = await prisma.playerRating.findMany({
                where: {
                    ...baseWhere,
                    gameType: gameType,
                    ratingType: 'public',
                },
                orderBy: {
                    rating: 'desc',
                },
                take: limit,
            })

            overallRankings = ratings.map(r => ({
                playerId: r.playerId,
                steamId: r.steamId,
                username: "",
                rating: r.rating,
                deviation: r.deviation,
                totalGames: r.totalGames,
                wins: r.wins,
                losses: r.losses,
                winRate: r.totalGames > 0 ? Math.round((r.wins / r.totalGames) * 100) : 0,
                rank: 0,
                lastPlayed: r.lastPlayed.toISOString(),
            }))
        }

        // Common logic for K/D, Steam data, and Clans
        const steamIds = overallRankings.map(p => p.steamId)

        // Fetch K/D stats
        const kdStats = await prisma.playerMatchStats.groupBy({
            by: ["steamId"],
            where: {
                steamId: { in: steamIds },
            },
            _sum: {
                kills: true,
                deaths: true,
            },
        })

        const kdMap = new Map(
            kdStats.map((s) => {
                const kills = s._sum.kills || 0
                const deaths = s._sum.deaths || 0
                const kd = kills / Math.max(deaths, 1)
                return [s.steamId, { kills, deaths, kd }]
            }),
        )

        // Fill K/D data
        overallRankings.forEach((player, index) => {
            player.rank = index + 1
            const kdData = kdMap.get(player.steamId)
            player.totalKills = kdData?.kills
            player.totalDeaths = kdData?.deaths
            player.avgKD = kdData ? Math.round(kdData.kd * 100) / 100 : undefined
        })

        const steamData = await getSteamPlayersBatch(steamIds)

        const [clanMembers, playerCountries] = await Promise.all([
            prisma.clanMember.findMany({
                where: { steamId: { in: steamIds } },
                include: {
                    Clan: {
                        select: {
                            tag: true,
                            avatarUrl: true
                        }
                    }
                }
            }),
            prisma.player.findMany({
                where: { steamId: { in: steamIds } },
                select: { steamId: true, countryCode: true, realCountryCode: true }
            })
        ])
        const clanMap = new Map(clanMembers.map(cm => [cm.steamId, { tag: cm.Clan.tag, avatarUrl: cm.Clan.avatarUrl }]))
        const countryMap = new Map(playerCountries.map(p => [p.steamId, { countryCode: p.countryCode, realCountryCode: p.realCountryCode }]))

        const usersMap = getUsersBySteamIds(overallRankings.map(p => p.steamId))
        const finalRankings = overallRankings.map((player) => {
            const steam = steamData.get(player.steamId)
            const user = usersMap.get(player.steamId)
            const pc = countryMap.get(player.steamId)
            const clan = clanMap.get(player.steamId)

            return {
                ...player,
                username: steam?.username || player.username || "Unknown",
                avatar: user?.avatar || steam?.avatar || null,
                countryCode: getDisplayCountry(pc?.countryCode, pc?.realCountryCode),
                clanTag: clan?.tag,
                clanAvatarUrl: clan?.avatarUrl
            }
        })

        cache.set(cacheKey, finalRankings, 5 * 60 * 1000)
        return finalRankings
    } catch (error) {
        console.error("[RankingsService] Error fetching top rankings:", error)
        return []
    }
}

/**
 * Obtiene los rankings de liga (off-season)
 * Usa PlayerRating con ratingType="ladder"
 */
export async function getLadderRankings(limit: number = 10, gameType: string = "ca"): Promise<RankingPlayer[]> {
    const cacheKey = `rankings:ladder:${gameType}:${limit}:v1`
    const cached = cache.get<RankingPlayer[]>(cacheKey)
    if (cached) return cached

    try {
        const MIN_GAMES_FOR_RANKING = 3 // Menos partidas requeridas para liga

        const ratings = await prisma.playerRating.findMany({
            where: {
                gameType: gameType,
                ratingType: "ladder",
                totalGames: { gte: MIN_GAMES_FOR_RANKING },
            },
            orderBy: {
                rating: 'desc',
            },
            take: limit,
        })

        let ladderRankings: RankingPlayer[] = ratings.map(r => ({
            playerId: r.playerId,
            steamId: r.steamId,
            username: "",
            rating: r.rating,
            deviation: r.deviation,
            totalGames: r.totalGames,
            wins: r.wins,
            losses: r.losses,
            winRate: r.totalGames > 0 ? Math.round((r.wins / r.totalGames) * 100) : 0,
            rank: 0,
            lastPlayed: r.lastPlayed.toISOString(),
        }))

        const steamIds = ladderRankings.map(p => p.steamId)

        // Fetch K/D stats
        const kdStats = await prisma.playerMatchStats.groupBy({
            by: ["steamId"],
            where: {
                steamId: { in: steamIds },
            },
            _sum: {
                kills: true,
                deaths: true,
            },
        })

        const kdMap = new Map(
            kdStats.map((s) => {
                const kills = s._sum.kills || 0
                const deaths = s._sum.deaths || 0
                const kd = kills / Math.max(deaths, 1)
                return [s.steamId, { kills, deaths, kd }]
            }),
        )

        ladderRankings.forEach((player, index) => {
            player.rank = index + 1
            const kdData = kdMap.get(player.steamId)
            player.totalKills = kdData?.kills
            player.totalDeaths = kdData?.deaths
            player.avgKD = kdData ? Math.round(kdData.kd * 100) / 100 : undefined
        })

        const steamData = await getSteamPlayersBatch(steamIds)

        const [clanMembers, playerCountries] = await Promise.all([
            prisma.clanMember.findMany({
                where: { steamId: { in: steamIds } },
                include: {
                    Clan: {
                        select: {
                            tag: true,
                            slug: true,
                            avatarUrl: true
                        }
                    }
                }
            }),
            prisma.player.findMany({
                where: { steamId: { in: steamIds } },
                select: { steamId: true, countryCode: true, realCountryCode: true }
            })
        ])
        const clanMap = new Map(clanMembers.map(cm => [cm.steamId, { tag: cm.Clan.tag, slug: cm.Clan.slug, avatarUrl: cm.Clan.avatarUrl }]))
        const countryMap = new Map(playerCountries.map(p => [p.steamId, { countryCode: p.countryCode, realCountryCode: p.realCountryCode }]))

        const usersMap = getUsersBySteamIds(ladderRankings.map(p => p.steamId))
        const finalRankings = ladderRankings.map((player) => {
            const steam = steamData.get(player.steamId)
            const user = usersMap.get(player.steamId)
            const pc = countryMap.get(player.steamId)
            const clan = clanMap.get(player.steamId)

            return {
                ...player,
                username: steam?.username || player.username || "Unknown",
                avatar: user?.avatar || steam?.avatar || null,
                countryCode: getDisplayCountry(pc?.countryCode, pc?.realCountryCode),
                clanTag: clan?.tag,
                clanSlug: clan?.slug,
                clanAvatarUrl: clan?.avatarUrl
            }
        })

        cache.set(cacheKey, finalRankings, 5 * 60 * 1000)
        return finalRankings
    } catch (error) {
        console.error("[RankingsService] Error fetching ladder rankings:", error)
        return []
    }
}

function getMinGamesForRanking(gt: string): number { return gt === 'ca' ? 35 : 5 }

/**
 * Paginated rankings for a specific game type.
 * Uses DB-level skip/take instead of fetching all records.
 * Only enriches the page's players with Steam/K/D/clan data.
 */
export async function getTopRankingsPaginated(
    gameType: string,
    offset: number,
    limit: number,
    ratingType: string = "public"
): Promise<{ rankings: RankingPlayer[]; totalCount: number }> {
    // Get cached total count (refreshed every 5 min)
    const countCacheKey = `rankings:count:${ratingType}:${gameType}:v1`
    const totalCount = await cache.getOrSet(countCacheKey, async () => {
        return prisma.playerRating.count({
            where: {
                gameType,
                ratingType,
                totalGames: { gte: ratingType === "ladder" ? 3 : getMinGamesForRanking(gameType) },
            },
        })
    }, 5 * 60 * 1000)

    // Get just the page from DB
    const pageCacheKey = `rankings:page:${ratingType}:${gameType}:${offset}:${limit}:v1`
    const rankings = await cache.getOrSet(pageCacheKey, async () => {
        const ratings = await prisma.playerRating.findMany({
            where: {
                gameType,
                ratingType,
                totalGames: { gte: ratingType === "ladder" ? 3 : getMinGamesForRanking(gameType) },
            },
            include: {
                Player: { select: { username: true } },
            },
            orderBy: { rating: 'desc' },
            skip: offset,
            take: limit,
        })

        if (ratings.length === 0) return []

        const steamIds = ratings.map(r => r.steamId)

        // Parallel: K/D stats, Steam data, clan data, user avatars
        const [kdStats, steamData, clanMembers, playerCountries] = await Promise.all([
            prisma.playerMatchStats.groupBy({
                by: ["steamId"],
                where: { steamId: { in: steamIds } },
                _sum: { kills: true, deaths: true },
            }),
            getSteamPlayersBatch(steamIds),
            prisma.clanMember.findMany({
                where: { steamId: { in: steamIds } },
                include: { Clan: { select: { tag: true, slug: true, avatarUrl: true } } },
            }),
            prisma.player.findMany({
                where: { steamId: { in: steamIds } },
                select: { steamId: true, countryCode: true, realCountryCode: true }
            }),
        ])

        const kdMap = new Map(
            kdStats.map(s => {
                const kills = s._sum.kills || 0
                const deaths = s._sum.deaths || 0
                return [s.steamId, { kills, deaths, kd: kills / Math.max(deaths, 1) }]
            })
        )
        const clanMap = new Map(clanMembers.map(cm => [cm.steamId, { tag: cm.Clan.tag, slug: cm.Clan.slug, avatarUrl: cm.Clan.avatarUrl }]))
        const countryMap = new Map(playerCountries.map(p => [p.steamId, { countryCode: p.countryCode, realCountryCode: p.realCountryCode }]))
        const usersMap = getUsersBySteamIds(steamIds)

        return ratings.map((r, index) => {
            const steam = steamData.get(r.steamId)
            const user = usersMap.get(r.steamId)
            const kdData = kdMap.get(r.steamId)
            const clan = clanMap.get(r.steamId)
            const pc = countryMap.get(r.steamId)

            return {
                playerId: r.playerId,
                steamId: r.steamId,
                username: steam?.username || r.Player.username || "Unknown",
                avatar: user?.avatar || steam?.avatar || null,
                rating: r.rating,
                deviation: r.deviation,
                totalGames: r.totalGames,
                wins: r.wins,
                losses: r.losses,
                winRate: r.totalGames > 0 ? Math.round((r.wins / r.totalGames) * 100) : 0,
                rank: offset + index + 1,
                lastPlayed: r.lastPlayed?.toISOString(),
                totalKills: kdData?.kills,
                totalDeaths: kdData?.deaths,
                avgKD: kdData ? Math.round(kdData.kd * 100) / 100 : undefined,
                countryCode: getDisplayCountry(pc?.countryCode, pc?.realCountryCode),
                clanTag: clan?.tag,
                clanSlug: clan?.slug,
                clanAvatarUrl: clan?.avatarUrl,
            }
        })
    }, 60 * 1000) // 1 minute cache per page

    return { rankings: rankings || [], totalCount }
}

export async function getTopClans(limit: number = 10, gameType?: string): Promise<ClanRanking[]> {
    const normalizedGameType = gameType?.toLowerCase() || null
    const cacheKey = `rankings:clans:${limit}:${normalizedGameType || 'all'}:v5`
    const cached = cache.get<ClanRanking[]>(cacheKey)
    if (cached) return cached

    const MIN_MEMBERS_FOR_RANKING = 4 // Mínimo de miembros para aparecer en rankings

    try {
        // Obtener todos los clanes con sus miembros y ratings de los jugadores
        // para calcular el ELO promedio en tiempo real
        const clans = await prisma.clan.findMany({
            include: {
                ClanMember: {
                    include: {
                        Player: {
                            include: {
                                PlayerRating: buildRatingFilter(normalizedGameType)
                            }
                        }
                    }
                },
            },
        })

        // Calcular ELO usando la función centralizada
        const clansWithCalculatedElo = clans.map(clan => {
            const eloResult = computeClanEloFromMembers(clan.ClanMember, normalizedGameType)
            return {
                ...clan,
                calculatedAvgElo: eloResult.averageElo
            }
        })

        // Filtrar clanes con mínimo de miembros, ordenar por ELO y tomar el límite
        const eligibleClans = clansWithCalculatedElo.filter(clan => clan.ClanMember.length >= MIN_MEMBERS_FOR_RANKING)
        eligibleClans.sort((a, b) => b.calculatedAvgElo - a.calculatedAvgElo)
        const topClans = eligibleClans.slice(0, limit)

        // Si hay gameType, obtener los matchIds de ese tipo una sola vez
        let matchIds: string[] | undefined
        if (normalizedGameType) {
            const matches = await prisma.match.findMany({
                where: { gameType: normalizedGameType },
                select: { id: true }
            })
            matchIds = matches.map(m => m.id)
        }

        // Calcular K/D para cada clan (filtrado por gameType si se especifica)
        const formattedClans = await Promise.all(
            topClans.map(async (clan, index) => {
                let avgKd = 0

                if (clan.ClanMember.length > 0) {
                    const memberIds = clan.ClanMember.map(m => m.playerId)

                    const stats = await prisma.playerMatchStats.groupBy({
                        by: ['playerId'],
                        where: {
                            playerId: { in: memberIds },
                            ...(matchIds && { matchId: { in: matchIds } })
                        },
                        _sum: {
                            kills: true,
                            deaths: true,
                        },
                    })

                    const totalKills = stats.reduce((sum, s) => sum + (s._sum.kills || 0), 0)
                    const totalDeaths = stats.reduce((sum, s) => sum + (s._sum.deaths || 0), 0)
                    avgKd = totalKills / Math.max(totalDeaths, 1)
                }

                return {
                    slug: clan.slug,
                    tag: clan.tag,
                    inGameTag: clan.inGameTag,
                    name: clan.name,
                    members: clan.ClanMember.length,
                    avgElo: clan.calculatedAvgElo,
                    rank: index + 1,
                    avatarUrl: clan.avatarUrl,
                    avgKd: avgKd,
                }
            })
        )

        cache.set(cacheKey, formattedClans, 5 * 60 * 1000) // Cache por 5 minutos
        return formattedClans
    } catch (error) {
        console.error("[RankingsService] Error al obtener ranking de clanes:", error)
        return []
    }
}
