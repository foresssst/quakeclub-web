import { NextRequest, NextResponse } from "next/server"
import { PrismaClient, Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { buildPlacementMap, getPlacementFromMap } from "@/lib/ranking-visibility"
interface RouteParams {
  params: Promise<{
    matchId: string
  }>
}
const matchInclude = {
  PlayerMatchStats: {
    include: {
      WeaponStats: true,
      EloHistory: true,
      Player: {
        select: {
          countryCode: true,
          ClanMember: {
            include: {
              Clan: {
                select: { id: true, tag: true, slug: true, name: true, avatarUrl: true }
              }
            },
            take: 1
          }
        }
      }
    },
  },
} satisfies Prisma.MatchInclude
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { matchId } = await params
    // NUEVA ARQUITECTURA: Buscar por Match.matchId (MATCH_GUID) o Match.id
    let match = await prisma.match.findFirst({
      where: {
        OR: [
          { matchId: matchId }, // MATCH_GUID del servidor
          { id: matchId }, // UUID interno
        ],
      },
      include: matchInclude,
    })
    // Si no se encontró por Match, buscar por PlayerMatchStats.id
    if (!match) {
      const playerMatchStats = await prisma.playerMatchStats.findUnique({
        where: { id: matchId },
        include: {
          Match: {
            include: matchInclude,
          },
        },
      })
      if (playerMatchStats?.Match) {
        match = playerMatchStats.Match
      }
    }
    if (!match) {
      return NextResponse.json({ success: false, error: "Match not found" }, { status: 404 })
    }
    const placementRows = await prisma.playerRating.findMany({
      where: {
        steamId: { in: match.PlayerMatchStats.map((player) => player.steamId) },
        gameType: match.gameType.toLowerCase(),
        ratingType: "public",
      },
      select: {
        steamId: true,
        gameType: true,
        totalGames: true,
      },
    })
    const placementMap = buildPlacementMap(placementRows, "public")
    // Formatear los datos
    const formattedPlayers = match.PlayerMatchStats.map((player) => {
      const eloRecord = player.EloHistory[0]
      const placementInfo = getPlacementFromMap(placementMap, player.steamId, match.gameType, "public")
      const clanMember = player.Player?.ClanMember?.[0]
      const clan = clanMember?.Clan
      return {
        id: player.id,
        steamId: player.steamId,
        playerName: player.playerName,
        kills: player.kills,
        deaths: player.deaths,
        score: player.score,
        team: player.team,
        damageDealt: player.damageDealt,
        damageTaken: player.damageTaken,
        aliveTime: player.aliveTime,
        rounds: player.rounds,
        roundsWon: player.roundsWon,
        flagsCaptured: player.flagsCaptured,
        flagsReturned: player.flagsReturned,
        flagPicks: player.flagPicks,
        flagDrops: player.flagDrops,
        carrierTakedowns: player.carrierTakedowns,
        performance: player.performance,
        kdRatio: (player.kills / Math.max(player.deaths, 1)).toFixed(2),
        // Usar PlayerMatchStats.eloDelta como fuente primaria (incluye quit penalties)
        // Fallback a EloHistory.change para partidas antiguas
        eloChange: placementInfo.isPlacement ? null : (player.eloDelta ?? eloRecord?.change ?? 0),
        eloBefore: placementInfo.isPlacement ? null : (player.eloBefore ?? eloRecord?.eloBefore ?? null),
        eloAfter: placementInfo.isPlacement ? null : (player.eloAfter ?? eloRecord?.eloAfter ?? null),
        countryCode: player.Player?.countryCode || null,
        clan: clan ? { id: clan.id, tag: clan.tag, slug: clan.slug, name: clan.name, avatarUrl: clan.avatarUrl } : null,
        weapons: player.WeaponStats.map((w) => ({
          weapon: w.weapon,
          kills: w.kills,
          hits: w.hits,
          shots: w.shots,
          damage: w.damage,
          accuracy: w.accuracy,
        })),
        medals: {
          accuracy: player.medalAccuracy,
          assists: player.medalAssists,
          captures: player.medalCaptures,
          combokill: player.medalCombokill,
          defends: player.medalDefends,
          excellent: player.medalExcellent,
          firstfrag: player.medalFirstfrag,
          headshot: player.medalHeadshot,
          humiliation: player.medalHumiliation,
          impressive: player.medalImpressive,
          midair: player.medalMidair,
          perfect: player.medalPerfect,
          perforated: player.medalPerforated,
          quadgod: player.medalQuadgod,
          rampage: player.medalRampage,
          revenge: player.medalRevenge,
        },
        statusMessage: player.statusMessage, // Incluir statusMessage (usado para switches)
      }
    })
    // Separar por teams si aplica y ordenar por score descendente
    const team1 = formattedPlayers.filter((p) => p.team === 1).sort((a, b) => b.score - a.score)
    const team2 = formattedPlayers.filter((p) => p.team === 2).sort((a, b) => b.score - a.score)
    const noTeam = formattedPlayers.filter((p) => !p.team || p.team === 0).sort((a, b) => b.score - a.score)
    // Determinar si el match es válido/completo
    const isRated = match.ratingProcessed === true
    const isAborted = match.aborted === true
    const gameStatus = match.gameStatus
    return NextResponse.json({
      success: true,
      match: {
        id: match.id,
        matchId: match.matchId,
        map: match.map,
        gameType: match.gameType,
        playedAt: match.timestamp.toISOString(),
        duration: match.duration,
        serverName: match.serverName,
        team1Score: match.team1Score,
        team2Score: match.team2Score,
        winner: match.winner, // 0=empate, 1=team1 (rojo), 2=team2 (azul), null=FFA/Duel
        // Estado del match
        gameStatus,
        isRated,
        isAborted,
      },
      players: {
        all: formattedPlayers.sort((a, b) => b.score - a.score),
        team1: team1.length > 0 ? team1 : undefined,
        team2: team2.length > 0 ? team2 : undefined,
        ffa: noTeam.length > 0 ? noTeam : undefined,
      },
      totalPlayers: formattedPlayers.length,
    })
  } catch (error) {
    console.error("Error fetching match details:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch match details",
      },
      { status: 500 },
    )
  }
}
