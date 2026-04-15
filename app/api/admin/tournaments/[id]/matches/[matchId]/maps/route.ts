/**
 * API de Mapas de Partidos de Torneo - QuakeClub
 * 
 * Gestión de resultados de mapas individuales en partidos de torneo.
 * POST: Registrar nuevo resultado de mapa
 * GET: Listar mapas del partido
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/tournaments/[id]/matches/[matchId]/maps
 * Obtener todos los mapas de un partido
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; matchId: string }> }
) {
    try {
        const { matchId } = await params

        const maps = await prisma.tournamentMatchMap.findMany({
            where: { matchId },
            orderBy: { mapNumber: 'asc' }
        })

        return NextResponse.json({ maps })
    } catch (error) {
        console.error('Error fetching maps:', error)
        return NextResponse.json({ error: 'Error al obtener mapas' }, { status: 500 })
    }
}

/**
 * POST /api/admin/tournaments/[id]/matches/[matchId]/maps
 * Registrar resultado de mapa
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; matchId: string }> }
) {
    try {
        const session = await getSession()
        if (!session?.user?.isAdmin) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { matchId } = await params
        const body = await req.json()
        const { mapNumber, mapName, winnerId, score1, score2, screenshotUrl, notes } = body

        // Verificar que el partido existe
        const match = await prisma.tournamentMatch.findUnique({
            where: { id: matchId }
        })

        if (!match) {
            return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 })
        }

        // Crear resultado de mapa
        const map = await prisma.tournamentMatchMap.create({
            data: {
                matchId,
                mapNumber,
                mapName,
                winnerId: winnerId || null,
                score1: score1 || null,
                score2: score2 || null,
                screenshotUrl: screenshotUrl || null,
                notes: notes || null,
                status: 'COMPLETED',
                playedAt: new Date(),
                validatedBy: session.user.id
            }
        })

        // Verificar si todos los mapas del partido están completos
        const allMaps = await prisma.tournamentMatchMap.findMany({
            where: { matchId }
        })

        const bestOf = match.bestOf || 3
        if (allMaps.length >= bestOf) {
            // Contar mapas ganados por cada equipo
            const team1MapsWon = allMaps.filter(m => m.winnerId === match.participant1Id).length
            const team2MapsWon = allMaps.filter(m => m.winnerId === match.participant2Id).length

            // Determinar ganador del partido
            let matchWinnerId = null
            if (team1MapsWon > team2MapsWon) {
                matchWinnerId = match.participant1Id
            } else if (team2MapsWon > team1MapsWon) {
                matchWinnerId = match.participant2Id
            }

            // Actualizar partido
            await prisma.tournamentMatch.update({
                where: { id: matchId },
                data: {
                    score1: team1MapsWon,
                    score2: team2MapsWon,
                    winnerId: matchWinnerId,
                    status: matchWinnerId ? 'COMPLETED' : 'IN_PROGRESS',
                    completedAt: matchWinnerId ? new Date() : null
                }
            })
        }

        return NextResponse.json({ success: true, map })
    } catch (error) {
        console.error('Error registering map result:', error)
        return NextResponse.json({ error: 'Error al registrar resultado del mapa' }, { status: 500 })
    }
}
