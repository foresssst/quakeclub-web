import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/admin/tournaments/[id]/matches/[matchId]/maps/[mapId]/validate
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; matchId: string; mapId: string }> }
) {
    try {
        const session = await getSession()
        if (!session?.user?.isAdmin) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { mapId } = await params

        const map = await prisma.tournamentMatchMap.update({
            where: { id: mapId },
            data: {
                status: 'VALIDATED',
                validatedAt: new Date(),
                validatedBy: session.user.id
            }
        })

        return NextResponse.json({
            success: true,
            map
        })
    } catch (error: any) {
        console.error('Error validating map:', error)
        return NextResponse.json(
            { error: error.message || 'Error al validar mapa' },
            { status: 500 }
        )
    }
}
