import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { normalizeApprovedSeeds } from "@/lib/tournament-seeding"

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

// PUT /api/admin/tournaments/[id]/registrations/[regId]/approve - Aprobar inscripción
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string; regId: string }> }
) {
    try {
        // Verificar permisos admin
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return error!

        const { id, regId } = await params

        const registration = await prisma.tournamentRegistration.update({
            where: { id: regId },
            data: { status: 'APPROVED' },
            include: {
                clan: true
            }
        })

        await normalizeApprovedSeeds(id)

        return NextResponse.json({
            success: true,
            registration
        })

    } catch (error) {
        console.error("Error approving registration:", error)
        return NextResponse.json(
            { error: "Error al aprobar inscripción" },
            { status: 500 }
        )
    } finally {
        
    }
}
