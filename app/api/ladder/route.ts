import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getDisplayCountry } from "@/lib/country-detection"
import { getUsersBySteamIds } from "@/lib/auth"
import { cache } from "@/lib/cache"
import { getSteamPlayersBatch } from "@/lib/steam"

const DEFAULT_LADDER_ELO = 1500

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const gameType = searchParams.get('gameType') || 'ca'

        const cacheKey = `ladder:${gameType}:full`
        const cached = cache.get(cacheKey)
        if (cached) {
            return NextResponse.json(cached, {
                headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' }
            })
        }

        // Get ladder players (those who have played at least 1 ladder game)
        const ladderRatings = await prisma.playerRating.findMany({
            where: {
                gameType,
                ratingType: 'ladder',
                totalGames: { gte: 1 }
            },
            orderBy: { rating: 'desc' },
            take: 100
        })

        const playerSteamIds = ladderRatings.map(r => r.steamId)

        // Get clan memberships for players
        const clanMembers = await prisma.clanMember.findMany({
            where: { steamId: { in: playerSteamIds } },
            include: {
                Clan: {
                    select: { tag: true, slug: true, avatarUrl: true }
                }
            }
        })
        const clanMap = new Map(clanMembers.map(cm => [cm.steamId, {
            tag: cm.Clan.tag,
            slug: cm.Clan.slug,
            avatarUrl: cm.Clan.avatarUrl
        }]))

        // Filter: only show players registered in a clan
        const clanPlayerRatings = ladderRatings.filter(r => clanMap.has(r.steamId))
        const clanPlayerSteamIds = clanPlayerRatings.map(r => r.steamId)

        const [steamData, playerCountries] = await Promise.all([
            getSteamPlayersBatch(clanPlayerSteamIds),
            prisma.player.findMany({
                where: { steamId: { in: clanPlayerSteamIds } },
                select: { steamId: true, countryCode: true, realCountryCode: true }
            })
        ])
        const countryMap = new Map(playerCountries.map(p => [p.steamId, { countryCode: p.countryCode, realCountryCode: p.realCountryCode }]))

        // Get aggregated performance stats from competitive matches
        const competitiveMatchIds = await prisma.match.findMany({
            where: { serverType: 'competitive', gameType },
            select: { id: true }
        })
        const matchIdList = competitiveMatchIds.map(m => m.id)

        const playerMatchStats = matchIdList.length > 0 ? await prisma.playerMatchStats.findMany({
            where: {
                steamId: { in: clanPlayerSteamIds },
                matchId: { in: matchIdList },
                gameStatus: 'SUCCESS'
            },
            select: {
                steamId: true,
                kills: true,
                deaths: true,
                damageDealt: true,
                damageTaken: true,
                score: true,
                medalExcellent: true,
                medalImpressive: true,
                medalHumiliation: true,
                medalMidair: true,
                medalPerfect: true,
                performance: true,
            }
        }) : []

        // Aggregate per-player stats
        const playerStatsMap = new Map<string, {
            kills: number; deaths: number; damageDealt: number; damageTaken: number;
            totalScore: number; matchCount: number;
            excellents: number; impressives: number; humiliations: number; midairs: number; perfects: number;
            totalPerformance: number;
        }>()
        for (const pms of playerMatchStats) {
            const existing = playerStatsMap.get(pms.steamId)
            if (existing) {
                existing.kills += pms.kills
                existing.deaths += pms.deaths
                existing.damageDealt += pms.damageDealt
                existing.damageTaken += pms.damageTaken
                existing.totalScore += pms.score || 0
                existing.matchCount++
                existing.excellents += pms.medalExcellent
                existing.impressives += pms.medalImpressive
                existing.humiliations += pms.medalHumiliation
                existing.midairs += pms.medalMidair
                existing.perfects += pms.medalPerfect
                existing.totalPerformance += pms.performance
            } else {
                playerStatsMap.set(pms.steamId, {
                    kills: pms.kills,
                    deaths: pms.deaths,
                    damageDealt: pms.damageDealt,
                    damageTaken: pms.damageTaken,
                    totalScore: pms.score || 0,
                    matchCount: 1,
                    excellents: pms.medalExcellent,
                    impressives: pms.medalImpressive,
                    humiliations: pms.medalHumiliation,
                    midairs: pms.medalMidair,
                    perfects: pms.medalPerfect,
                    totalPerformance: pms.performance,
                })
            }
        }

        // Build player list with enriched data
        const usersMap = getUsersBySteamIds(clanPlayerRatings.map(r => r.steamId))
        const players = clanPlayerRatings.map((rating, index) => {
            const steam = steamData.get(rating.steamId)
            const user = usersMap.get(rating.steamId)
            const pc = countryMap.get(rating.steamId)
            const clan = clanMap.get(rating.steamId)
            const stats = playerStatsMap.get(rating.steamId)

            const winRate = rating.totalGames > 0
                ? Math.round(rating.wins / rating.totalGames * 100)
                : 0

            return {
                playerId: rating.playerId,
                steamId: rating.steamId,
                username: steam?.username || 'Unknown',
                avatar: user?.avatar || steam?.avatar || null,
                rating: rating.rating,
                wins: rating.wins,
                losses: rating.losses,
                totalGames: rating.totalGames,
                countryCode: getDisplayCountry(pc?.countryCode, pc?.realCountryCode),
                clanTag: clan?.tag,
                clanSlug: clan?.slug,
                clanAvatarUrl: clan?.avatarUrl,
                rank: index + 1,
                // Performance stats
                kills: stats?.kills || 0,
                deaths: stats?.deaths || 0,
                kdRatio: stats ? parseFloat((stats.kills / Math.max(stats.deaths, 1)).toFixed(2)) : 0,
                damageDealt: stats?.damageDealt || 0,
                damageTaken: stats?.damageTaken || 0,
                avgScore: stats ? Math.round(stats.totalScore / stats.matchCount) : 0,
                // New enriched stats
                winRate,
                matchCount: stats?.matchCount || 0,
                avgKills: stats ? parseFloat((stats.kills / stats.matchCount).toFixed(1)) : 0,
                avgDeaths: stats ? parseFloat((stats.deaths / stats.matchCount).toFixed(1)) : 0,
                avgDamageDealt: stats ? Math.round(stats.damageDealt / stats.matchCount) : 0,
                avgDamageTaken: stats ? Math.round(stats.damageTaken / stats.matchCount) : 0,
                avgPerformance: stats ? parseFloat((stats.totalPerformance / stats.matchCount).toFixed(1)) : 0,
                // Medals
                excellents: stats?.excellents || 0,
                impressives: stats?.impressives || 0,
                humiliations: stats?.humiliations || 0,
                midairs: stats?.midairs || 0,
                perfects: stats?.perfects || 0,
            }
        })

        // Get clans with members (flat queries instead of 3-level nested include)
        const [allClans, allClanMemberRows, ladderRatingsForClans] = await Promise.all([
            prisma.clan.findMany({
                select: { id: true, name: true, tag: true, slug: true, avatarUrl: true }
            }),
            prisma.clanMember.findMany({
                select: { clanId: true, steamId: true }
            }),
            prisma.playerRating.findMany({
                where: { ratingType: 'ladder', gameType },
                select: { steamId: true, rating: true, wins: true, losses: true }
            }),
        ])

        // Build lookup maps
        const clanMembersMap = new Map<string, string[]>()
        const allClanSteamIds: string[] = []
        for (const cm of allClanMemberRows) {
            if (!clanMembersMap.has(cm.clanId)) clanMembersMap.set(cm.clanId, [])
            clanMembersMap.get(cm.clanId)!.push(cm.steamId)
            allClanSteamIds.push(cm.steamId)
        }

        const ladderRatingMap = new Map<string, { rating: number; wins: number; losses: number }>()
        for (const r of ladderRatingsForClans) {
            ladderRatingMap.set(r.steamId, { rating: r.rating, wins: r.wins, losses: r.losses })
        }

        // Aggregate competitive match stats for all clan members
        const clanPlayerMatchStats = matchIdList.length > 0 && allClanSteamIds.length > 0
            ? await prisma.playerMatchStats.groupBy({
                by: ['steamId'],
                where: {
                    steamId: { in: allClanSteamIds },
                    matchId: { in: matchIdList },
                    gameStatus: 'SUCCESS'
                },
                _sum: { kills: true, deaths: true, damageDealt: true, damageTaken: true },
            })
            : []

        const clanStatsLookup = new Map(clanPlayerMatchStats.map(s => [s.steamId, {
            kills: s._sum.kills || 0,
            deaths: s._sum.deaths || 0,
            dmgDealt: s._sum.damageDealt || 0,
            dmgTaken: s._sum.damageTaken || 0,
        }]))

        // Calculate clan stats
        const clans = allClans
            .map(clan => {
                const memberSteamIds = clanMembersMap.get(clan.id) || []
                if (memberSteamIds.length === 0) return null

                // Get ladder ratings for this clan's members
                const memberLadderRatings = memberSteamIds
                    .map(sid => ladderRatingMap.get(sid))
                    .filter(Boolean) as { rating: number; wins: number; losses: number }[]

                let avgElo: number
                let totalWins = 0
                let totalLosses = 0

                if (memberLadderRatings.length === 0) {
                    avgElo = DEFAULT_LADDER_ELO
                } else {
                    avgElo = Math.round(memberLadderRatings.reduce((sum, r) => sum + r.rating, 0) / memberLadderRatings.length)
                    totalWins = memberLadderRatings.reduce((sum, r) => sum + r.wins, 0)
                    totalLosses = memberLadderRatings.reduce((sum, r) => sum + r.losses, 0)
                }

                let clanKills = 0, clanDeaths = 0, clanDmgDealt = 0, clanDmgTaken = 0
                for (const sid of memberSteamIds) {
                    const ms = clanStatsLookup.get(sid)
                    if (ms) {
                        clanKills += ms.kills
                        clanDeaths += ms.deaths
                        clanDmgDealt += ms.dmgDealt
                        clanDmgTaken += ms.dmgTaken
                    }
                }

                const totalGames = totalWins + totalLosses
                const winRate = totalGames > 0
                    ? Math.round(totalWins / totalGames * 100)
                    : 0

                return {
                    id: clan.id,
                    name: clan.name,
                    tag: clan.tag,
                    slug: clan.slug,
                    avatarUrl: clan.avatarUrl,
                    avgElo,
                    wins: totalWins,
                    losses: totalLosses,
                    totalGames,
                    winRate,
                    members: memberSteamIds.length,
                    activeLadderMembers: memberLadderRatings.length,
                    kills: clanKills,
                    deaths: clanDeaths,
                    kdRatio: parseFloat((clanKills / Math.max(clanDeaths, 1)).toFixed(2)),
                    damageDealt: clanDmgDealt,
                    damageTaken: clanDmgTaken,
                }
            })
            .filter(Boolean)
            .sort((a, b) => {
                const aGames = a!.wins + a!.losses
                const bGames = b!.wins + b!.losses
                if (aGames > 0 && bGames === 0) return -1
                if (bGames > 0 && aGames === 0) return 1
                return b!.avgElo - a!.avgElo
            })

        const responseData = { players, clans, gameType }
        cache.set(cacheKey, responseData, 2 * 60 * 1000)

        return NextResponse.json(responseData, {
            headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' }
        })
    } catch (error) {
        console.error('[Ladder API] Error:', error)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
