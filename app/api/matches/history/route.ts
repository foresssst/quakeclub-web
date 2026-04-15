import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildPlacementMap, getPlacementFromMap } from "@/lib/ranking-visibility"

// API para historial completo de partidas con paginación y filtros
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
        const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50)
        const gameType = searchParams.get("gameType")?.toLowerCase()
        const map = searchParams.get("map")
        const dateFrom = searchParams.get("dateFrom")
        const dateTo = searchParams.get("dateTo")
        const steamId = searchParams.get("steamId")

        // Construir filtros
        const where: Record<string, unknown> = {
            gameStatus: "SUCCESS",
            PlayerMatchStats: {
                some: steamId ? { steamId } : {}
            }
        }

        // Filtro por tipo de juego
        if (gameType && gameType !== "all") {
            where.gameType = {
                equals: gameType,
                mode: "insensitive"
            }
        }

        // Filtro por mapa
        if (map) {
            where.map = {
                contains: map,
                mode: "insensitive"
            }
        }

        // Filtro por rango de fechas
        if (dateFrom || dateTo) {
            where.timestamp = {}
            if (dateFrom) {
                (where.timestamp as Record<string, Date>).gte = new Date(dateFrom)
            }
            if (dateTo) {
                const endDate = new Date(dateTo)
                endDate.setHours(23, 59, 59, 999)
                    ; (where.timestamp as Record<string, Date>).lte = endDate
            }
        }

        // Contar total para paginación
        const totalMatches = await prisma.match.count({ where })
        const totalPages = Math.ceil(totalMatches / limit)

        // Obtener partidas con paginación
        const matches = await prisma.match.findMany({
            where,
            orderBy: {
                timestamp: "desc"
            },
            skip: (page - 1) * limit,
            take: limit,
            include: {
                PlayerMatchStats: {
                    orderBy: {
                        score: "desc"
                    },
                    take: 10,
                    select: {
                        playerName: true,
                        steamId: true,
                        score: true,
                        kills: true,
                        deaths: true,
                        team: true,
                        eloDelta: true
                    }
                }
            }
        })

        const placementPairs = matches.flatMap((match) =>
            match.PlayerMatchStats.map((player) => ({
                steamId: player.steamId,
                gameType: match.gameType.toLowerCase(),
            }))
        )
        const uniqueSteamIds = Array.from(new Set(placementPairs.map((pair) => pair.steamId)))
        const uniqueGameTypes = Array.from(new Set(placementPairs.map((pair) => pair.gameType)))
        const placementRows = uniqueSteamIds.length > 0
            ? await prisma.playerRating.findMany({
                where: {
                    steamId: { in: uniqueSteamIds },
                    ratingType: "public",
                    gameType: { in: uniqueGameTypes },
                },
                select: {
                    steamId: true,
                    gameType: true,
                    totalGames: true,
                }
            })
            : []
        const placementMap = buildPlacementMap(placementRows, "public")

        const getVisibleEloDelta = (matchGameType: string, playerSteamId: string, eloDelta: number | null) => {
            const placementInfo = getPlacementFromMap(placementMap, playerSteamId, matchGameType, "public")
            return placementInfo.isPlacement ? null : eloDelta
        }

        // Formatear los datos
        const formattedMatches = matches.map(match => {
            const players = match.PlayerMatchStats
            const matchGameType = match.gameType.toLowerCase()

            // Para DUEL
            if (match.gameType.toLowerCase() === "duel" && players.length >= 2) {
                const player1 = players[0]
                const player2 = players[1]
                return {
                    id: match.id,
                    matchId: match.matchId,
                    gameType: match.gameType.toUpperCase(),
                    map: match.map,
                    timestamp: match.timestamp,
                    player1: {
                        name: player1.playerName,
                        steamId: player1.steamId,
                        score: player1.score,
                        eloDelta: getVisibleEloDelta(matchGameType, player1.steamId, player1.eloDelta)
                    },
                    player2: {
                        name: player2.playerName,
                        steamId: player2.steamId,
                        score: player2.score,
                        eloDelta: getVisibleEloDelta(matchGameType, player2.steamId, player2.eloDelta)
                    },
                    score: `${player1.score}-${player2.score}`
                }
            }

            // Para modos de equipo
            const team1Score = match.team1Score ?? 0
            const team2Score = match.team2Score ?? 0
            const team1Players = players.filter(p => p.team === 1)
            const team2Players = players.filter(p => p.team === 2)

            return {
                id: match.id,
                matchId: match.matchId,
                gameType: match.gameType.toUpperCase(),
                map: match.map,
                timestamp: match.timestamp,
                team1: team1Players.map(p => ({
                    name: p.playerName,
                    steamId: p.steamId,
                    score: p.score,
                    eloDelta: getVisibleEloDelta(matchGameType, p.steamId, p.eloDelta)
                })),
                team2: team2Players.map(p => ({
                    name: p.playerName,
                    steamId: p.steamId,
                    score: p.score,
                    eloDelta: getVisibleEloDelta(matchGameType, p.steamId, p.eloDelta)
                })),
                score: `${team1Score}-${team2Score}`
            }
        })

        // Obtener lista de mapas únicos para el filtro
        const uniqueMaps = await prisma.match.findMany({
            where: { gameStatus: "SUCCESS" },
            select: { map: true },
            distinct: ["map"],
            orderBy: { map: "asc" }
        })

        return NextResponse.json({
            matches: formattedMatches,
            pagination: {
                page,
                limit,
                totalMatches,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            filters: {
                maps: uniqueMaps.map(m => m.map)
            }
        })
    } catch (error) {
        console.error("Error fetching match history:", error)
        return NextResponse.json({
            matches: [],
            pagination: { page: 1, limit: 20, totalMatches: 0, totalPages: 0, hasNext: false, hasPrev: false },
            filters: { maps: [] }
        }, { status: 500 })
    }
}
