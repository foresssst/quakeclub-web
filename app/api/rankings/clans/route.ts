/**
 * API de Ranking de Clanes
 *
 * Endpoint que retorna el ranking de clanes ordenado por ELO promedio.
 * El ELO se calcula en tiempo real basado en los ratings actuales de los miembros.
 * Usa computeClanEloFromMembers() como fuente única de verdad.
 *
 * Query params:
 * - limit: numero maximo de clanes a retornar (default: 10)
 * - gameType: tipo de juego para filtrar (ca, duel, tdm, ctf, ffa)
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { cache } from "@/lib/cache"
import { computeClanEloFromMembers, buildRatingFilter } from "@/lib/clan-elo"

const CLANS_RANKING_CACHE_TTL = 10 * 60 * 1000

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestedLimit = parseInt(searchParams.get("limit") || "10")
    const limit = Math.min(Math.max(1, requestedLimit), 100)
    const gameType = searchParams.get("gameType")?.toLowerCase() || null

    const cacheKey = `clans-ranking:${gameType || 'all'}:${limit}`
    const cached = cache.get<{ clans: any[]; total: number; gameType: string }>(cacheKey)
    if (cached) {
      return NextResponse.json({
        success: true,
        ...cached,
        cached: true,
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' }
      })
    }

    const clans = await prisma.clan.findMany({
      include: {
        ClanMember: {
          include: {
            Player: {
              include: {
                PlayerRating: buildRatingFilter(gameType)
              }
            }
          }
        },
      },
    })

    // Calcular ELO usando la función centralizada
    const clansWithElo = clans.map(clan => {
      const eloResult = computeClanEloFromMembers(clan.ClanMember, gameType)
      return { ...clan, ...eloResult }
    })

    // Filtrar clanes con mínimo 4 miembros, ordenar por ELO
    const eligibleClans = clansWithElo
      .filter(c => c.ClanMember.length >= 4)
      .sort((a, b) => b.averageElo - a.averageElo)
      .slice(0, limit)

    // K/D de todos los miembros
    const allMemberIds = eligibleClans.flatMap(clan => clan.ClanMember.map(m => m.playerId))
    let memberStats: Map<string, { kills: number; deaths: number }> = new Map()
    if (allMemberIds.length > 0) {
      const whereClause: any = { playerId: { in: allMemberIds } }
      if (gameType) {
        whereClause.Match = { gameType }
      }
      const stats = await prisma.playerMatchStats.groupBy({
        by: ['playerId'],
        where: whereClause,
        _sum: { kills: true, deaths: true },
      })
      stats.forEach(s => {
        memberStats.set(s.playerId, {
          kills: s._sum.kills || 0,
          deaths: s._sum.deaths || 0,
        })
      })
    }

    const formattedClans = eligibleClans.map((clan, index) => {
      let totalKills = 0
      let totalDeaths = 0
      clan.ClanMember.forEach(member => {
        const stats = memberStats.get(member.playerId)
        if (stats) {
          totalKills += stats.kills
          totalDeaths += stats.deaths
        }
      })
      return {
        slug: clan.slug,
        tag: clan.tag,
        inGameTag: clan.inGameTag,
        name: clan.name,
        members: clan.ClanMember.length,
        avgElo: clan.averageElo,
        rank: index + 1,
        avatarUrl: clan.avatarUrl,
        avgKd: totalKills / Math.max(totalDeaths, 1),
      }
    })

    const result = {
      clans: formattedClans,
      total: formattedClans.length,
      gameType: gameType || "all",
    }
    cache.set(cacheKey, result, CLANS_RANKING_CACHE_TTL)

    return NextResponse.json({
      success: true,
      ...result,
      cached: false,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' }
    })
  } catch (error) {
    console.error("Error al obtener ranking de clanes:", error)
    return NextResponse.json(
      { success: false, error: "Error al obtener ranking de clanes" },
      { status: 500 }
    )
  }
}
