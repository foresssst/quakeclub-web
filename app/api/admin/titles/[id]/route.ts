/**
 * API de Títulos de Admin - QuakeClub
 *
 * Gestión de títulos de jugadores (DELETE/PATCH).
 * PlayerTitle es la asignación de un Title a un Player.
 */
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

/**
 * DELETE /api/admin/titles/[id]
 * Elimina una asignación de título a jugador
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Verificar permisos admin
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return error!

        const { id } = await params

        await prisma.playerTitle.delete({
            where: { id },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error deleting title:", error)
        return NextResponse.json({ error: "Error al eliminar título" }, { status: 500 })
    }
}

/**
 * PATCH /api/admin/titles/[id]
 * Actualiza la asignación de título (prioridad, estado activo)
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Verificar permisos admin
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return error!

        const { id } = await params
        const body = await request.json()
        const { titleId, priority, isActive } = body

        // Si se activa este título, desactivar otros del mismo jugador
        if (isActive) {
            const currentTitle = await prisma.playerTitle.findUnique({
                where: { id },
                select: { playerId: true },
            })

            if (currentTitle) {
                await prisma.playerTitle.updateMany({
                    where: {
                        playerId: currentTitle.playerId,
                        isActive: true,
                        id: { not: id }
                    },
                    data: { isActive: false },
                })
            }
        }

        const updatedTitle = await prisma.playerTitle.update({
            where: { id },
            data: {
                titleId: titleId || undefined,
                priority: priority ?? undefined,
                isActive: isActive ?? undefined,
            },
            include: {
                player: {
                    select: {
                        id: true,
                        username: true,
                        steamId: true,
                    },
                },
                title: true,
            },
        })

        return NextResponse.json({ title: updatedTitle })
    } catch (error) {
        console.error("Error updating title:", error)
        return NextResponse.json({ error: "Error al actualizar título" }, { status: 500 })
    }
}
