import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { moveApprovedRegistrationToSeed, normalizeApprovedSeeds } from "@/lib/tournament-seeding"

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

// PUT /api/admin/tournaments/[id]/registrations/[regId] - Aprobar/Rechazar inscripción
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string; regId: string }> }
) {
    try {
        // Verificar permisos admin
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return error!

        const { id, regId } = await params
        const body = await request.json()
        const { status, seed } = body

        if (seed !== undefined) {
            const parsedSeed = Number(seed)

            if (!Number.isInteger(parsedSeed) || parsedSeed < 1) {
                return NextResponse.json(
                    { error: "Seed inválido" },
                    { status: 400 }
                )
            }

            const orderedRegistrations = await moveApprovedRegistrationToSeed(id, regId, parsedSeed)

            return NextResponse.json({
                success: true,
                orderedRegistrations
            })
        }

        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return NextResponse.json(
                { error: "Estado inválido" },
                { status: 400 }
            )
        }

        const registration = await prisma.tournamentRegistration.update({
            where: { id: regId },
            data: { status }
        })

        if (status === 'APPROVED') {
            await normalizeApprovedSeeds(id)
        }

        return NextResponse.json({
            success: true,
            registration
        })

    } catch (error) {
        console.error("Error updating registration:", error)
        return NextResponse.json(
            { error: "Error al actualizar inscripción" },
            { status: 500 }
        )
    } finally {
        
    }
}

// DELETE /api/admin/tournaments/[id]/registrations/[regId] - Eliminar inscripción
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; regId: string }> }
) {
    try {
        // Verificar permisos admin
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return error!

        const { id, regId } = await params

        await prisma.tournamentRegistration.delete({
            where: { id: regId }
        })

        await normalizeApprovedSeeds(id)

        return NextResponse.json({
            success: true
        })

    } catch (error) {
        console.error("Error deleting registration:", error)
        return NextResponse.json(
            { error: "Error al eliminar inscripción" },
            { status: 500 }
        )
    } finally {
        
    }
}
