import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { BracketsManager } from "@/lib/brackets-manager"

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

// PUT /api/admin/tournaments/[id]/matches/[matchId]/result - Establecer resultado del partido
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string; matchId: string }> }
) {
    try {
        // Verificar permisos admin
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return error!

        const { id: tournamentId, matchId } = await params
        const body = await request.json()
        const { score1, score2 } = body

        if (score1 === undefined || score2 === undefined) {
            return NextResponse.json(
                { error: "Scores requeridos" },
                { status: 400 }
            )
        }

        // Get the match
        const match = await prisma.tournamentMatch.findUnique({
            where: { id: matchId },
            include: {
                participant1Reg: true,
                participant2Reg: true,
                tournament: true
            }
        })

        if (!match) {
            return NextResponse.json(
                { error: "Partido no encontrado" },
                { status: 404 }
            )
        }

        if (match.tournamentId !== tournamentId) {
            return NextResponse.json(
                { error: "El partido no pertenece al torneo indicado" },
                { status: 400 }
            )
        }

        if (!match.participant1Id || !match.participant2Id) {
            return NextResponse.json(
                { error: "El partido no tiene ambos participantes asignados" },
                { status: 400 }
            )
        }

        // Determine winner
        let winnerId: string | null = null
        if (score1 > score2) {
            winnerId = match.participant1Id
        } else if (score2 > score1) {
            winnerId = match.participant2Id
        }

        if (!winnerId) {
            return NextResponse.json(
                { error: "No se permiten empates en este formato de bracket" },
                { status: 400 }
            )
        }

        await BracketsManager.update.matchResult(matchId, {
            winnerId,
            score1,
            score2,
        })

        const updatedMatch = await prisma.tournamentMatch.findUnique({
            where: { id: matchId },
        })

        return NextResponse.json({
            success: true,
            match: updatedMatch
        })

    } catch (error) {
        console.error("Error setting match result:", error)
        return NextResponse.json(
            { error: "Error al establecer resultado" },
            { status: 500 }
        )
    } finally {
        
    }
}
