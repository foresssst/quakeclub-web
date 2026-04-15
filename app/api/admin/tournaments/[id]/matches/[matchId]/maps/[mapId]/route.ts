/**
 * API de Mapa Individual de Torneo - QuakeClub
 * 
 * Gestión de un mapa específico de un partido de torneo.
 * PUT: Actualizar resultado de mapa
 * DELETE: Eliminar mapa
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * PUT /api/admin/tournaments/[id]/matches/[matchId]/maps/[mapId]
 * Actualizar resultado de mapa
 */
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; matchId: string; mapId: string }> }
) {
    try {
        const session = await getSession()
        if (!session?.user?.isAdmin) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { mapId } = await params
        const body = await req.json()
        const { mapName, winnerId, score1, score2, screenshotUrl, notes, status } = body

        const map = await prisma.tournamentMatchMap.update({
            where: { id: mapId },
            data: {
                ...(mapName !== undefined && { mapName }),
                ...(winnerId !== undefined && { winnerId }),
                ...(score1 !== undefined && { score1 }),
                ...(score2 !== undefined && { score2 }),
                ...(screenshotUrl !== undefined && { screenshotUrl }),
                ...(notes !== undefined && { notes }),
                ...(status !== undefined && { status })
            }
        })

        return NextResponse.json({ success: true, map })
    } catch (error) {
        console.error('Error updating map:', error)
        return NextResponse.json({ error: 'Error al actualizar mapa' }, { status: 500 })
    }
}

/**
 * DELETE /api/admin/tournaments/[id]/matches/[matchId]/maps/[mapId]
 * Eliminar mapa
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; matchId: string; mapId: string }> }
) {
    try {
        const session = await getSession()
        if (!session?.user?.isAdmin) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { mapId } = await params

        await prisma.tournamentMatchMap.delete({
            where: { id: mapId }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting map:', error)
        return NextResponse.json({ error: 'Error al eliminar mapa' }, { status: 500 })
    }
}
