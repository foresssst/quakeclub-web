import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateStandings } from '@/lib/tournament-groups'

// GET /api/admin/tournaments/[id]/standings
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession()
        if (!session?.user?.isAdmin) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id } = await params
        const { searchParams } = new URL(req.url)
        const groupId = searchParams.get('groupId')

        // Calculate standings
        const standings = await calculateStandings(id, groupId || undefined)

        return NextResponse.json({
            standings
        })
    } catch (error: any) {
        console.error('Error calculating standings:', error)
        return NextResponse.json(
            { error: error.message || 'Error al calcular tabla' },
            { status: 500 }
        )
    }
}
