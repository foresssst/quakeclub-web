import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { calculateMatchRatings } from "@/lib/rating-calculator"

/**
 * POST /api/admin/recalculate-ratings
 * 
 * Recalcula ratings para matches que fallaron el procesamiento inicial.
 * Busca matches con ratingProcessed = false y los reprocesa.
 * 
 * Requiere autenticación de admin.
 */
export async function POST(request: NextRequest) {
    try {
        // Verificar API key de admin
        const apiKey = request.headers.get("x-api-key")
        const expectedApiKey = process.env.MINQLX_API_KEY

        if (!expectedApiKey || apiKey !== expectedApiKey) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Obtener parámetros
        const body = await request.json().catch(() => ({}))
        const limit = Math.min(body.limit || 50, 100) // Máximo 100 matches por llamada
        const dryRun = body.dryRun === true

        // Buscar matches que fallaron el procesamiento de ratings
        const failedMatches = await prisma.match.findMany({
            where: {
                ratingProcessed: false,
                gameStatus: { not: "ABORTED" }, // Excluir partidas abortadas
            },
            include: {
                PlayerMatchStats: true, // Incluir stats de jugadores
            },
            orderBy: { timestamp: "desc" },
            take: limit,
        })

        console.log(`[Recalculate] Encontrados ${failedMatches.length} matches sin procesar`)

        if (failedMatches.length === 0) {
            return NextResponse.json({
                success: true,
                message: "No hay matches pendientes de recalcular",
                processed: 0,
            })
        }

        if (dryRun) {
            return NextResponse.json({
                success: true,
                message: "Dry run - no se procesaron matches",
                matchesToProcess: failedMatches.map(m => ({
                    id: m.id,
                    matchId: m.matchId,
                    gameType: m.gameType,
                    map: m.map,
                    timestamp: m.timestamp,
                    playerCount: m.PlayerMatchStats.length,
                })),
            })
        }

        const results = {
            processed: 0,
            errors: 0,
            details: [] as any[],
        }

        for (const match of failedMatches) {
            try {
                console.log(`[Recalculate] Procesando match ${match.matchId} (${match.gameType})...`)

                // Preparar datos de jugadores
                const matchPlayers = match.PlayerMatchStats.map((p: any) => ({
                    steamId: p.steamId,
                    kills: p.kills,
                    deaths: p.deaths,
                    score: p.score,
                    team: p.team || undefined,
                    aliveTime: p.aliveTime || 0,
                    damageDealt: p.damageDealt || 0,
                    damageTaken: p.damageTaken || 0,
                    matchId: p.id, // Para actualizar PlayerMatchStats
                }))

                // Preparar contexto del match
                const matchContext = {
                    matchId: match.id,
                    gameType: match.gameType,
                    matchDuration: match.duration || undefined,
                    mapName: match.map || undefined,
                }

                // Preparar stats del match para validación
                const matchStats = {
                    GAME_LENGTH: match.duration || 0,
                    TSCORE0: match.team1Score || 0,
                    TSCORE1: match.team2Score || 0,
                    FRAG_LIMIT: match.fragLimit || 0,
                    SCORE_LIMIT: match.scoreLimit || 0,
                    ROUND_LIMIT: match.roundLimit || 0,
                    EXIT_MSG: match.exitMessage || "",
                    ABORTED: match.aborted || false,
                    INFECTED: match.infected || false,
                    QUADHOG: match.quadhog || false,
                    TRAINING: match.training || false,
                    INSTAGIB: match.instagib || false,
                    FACTORY: match.factory || "",
                    FACTORY_TITLE: match.factoryTitle || "",
                }

                // Contexto de liga
                const ladderContext = {
                    serverType: match.serverType || "public",
                    seasonId: match.seasonId,
                    isOfficial: match.isOfficial || false,
                }

                // Recalcular ratings
                await calculateMatchRatings(matchContext, matchPlayers, matchStats, ladderContext)

                // Marcar como procesado
                await prisma.match.update({
                    where: { id: match.id },
                    data: {
                        ratingProcessed: true,
                        gameStatus: "SUCCESS",
                    },
                })

                results.processed++
                results.details.push({
                    matchId: match.matchId,
                    status: "success",
                    players: matchPlayers.length,
                })

                console.log(`[Recalculate] ✅ Match ${match.matchId} recalculado`)
            } catch (error: any) {
                console.error(`[Recalculate] ❌ Error en match ${match.matchId}:`, error.message)
                results.errors++
                results.details.push({
                    matchId: match.matchId,
                    status: "error",
                    error: error.message,
                })
            }
        }

        return NextResponse.json({
            success: true,
            message: `Recálculo completado`,
            ...results,
        })
    } catch (error: any) {
        console.error("[Recalculate] Error general:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}

export async function GET(request: NextRequest) {
    try {
        // Verificar API key de admin
        const apiKey = request.headers.get("x-api-key")
        const expectedApiKey = process.env.MINQLX_API_KEY

        if (!expectedApiKey || apiKey !== expectedApiKey) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Contar matches pendientes
        const pendingCount = await prisma.match.count({
            where: {
                ratingProcessed: false,
                gameStatus: { not: "ABORTED" },
            },
        })

        // Obtener algunos ejemplos
        const examples = await prisma.match.findMany({
            where: {
                ratingProcessed: false,
                gameStatus: { not: "ABORTED" },
            },
            select: {
                id: true,
                matchId: true,
                gameType: true,
                map: true,
                timestamp: true,
                _count: { select: { PlayerMatchStats: true } },
            },
            orderBy: { timestamp: "desc" },
            take: 10,
        })

        return NextResponse.json({
            pendingMatches: pendingCount,
            examples: examples.map(e => ({
                id: e.id,
                matchId: e.matchId,
                gameType: e.gameType,
                map: e.map,
                timestamp: e.timestamp,
                playerCount: e._count.PlayerMatchStats,
            })),
        })
    } catch (error: any) {
        console.error("[Recalculate] Error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
