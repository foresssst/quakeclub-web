import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

// Verificar si es admin
async function verifyAdmin(): Promise<{ isAdmin: boolean; error?: NextResponse }> {
    const session = await getSession()
    if (!session?.user) {
        return { isAdmin: false, error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) }
    }
    const isAdmin = session.user.isAdmin || session.user.username === "operador"
    if (!isAdmin) {
        return { isAdmin: false, error: NextResponse.json({ error: "No autorizado" }, { status: 403 }) }
    }
    return { isAdmin: true }
}

// PUT /api/admin/tournaments/[id]/matches/[matchId] - Editar partido
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string; matchId: string }> }
) {
    try {
        // Verificar permisos admin
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return error!

        const { matchId } = await params
        const body = await request.json()

        const match = await prisma.tournamentMatch.update({
            where: { id: matchId },
            data: {
                ...body,
                scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
                startedAt: body.startedAt ? new Date(body.startedAt) : undefined,
                completedAt: body.completedAt ? new Date(body.completedAt) : undefined,
                status: body.score1 !== undefined && body.score2 !== undefined ? 'COMPLETED' : body.status,
                winnerId: body.score1 !== undefined && body.score2 !== undefined
                    ? body.score1 > body.score2 ? body.participant1Id : body.participant2Id
                    : undefined
            }
        })

        return NextResponse.json({
            success: true,
            match
        })

    } catch (error) {
        console.error("Error updating match:", error)
        return NextResponse.json(
            { error: "Error al actualizar partido" },
            { status: 500 }
        )
    } finally {
        
    }
}
