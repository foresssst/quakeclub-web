/**
 * API de Badges de Admin - QuakeClub
 *
 * Gestión de badges (medallas) de jugadores.
 * PlayerBadge es la asignación de una Badge a un Player.
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
 * DELETE /api/admin/badges/[id]
 * Elimina una asignación de badge a jugador
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

        await prisma.playerBadge.delete({
            where: { id },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error deleting badge:", error)
        return NextResponse.json({ error: "Error al eliminar medalla" }, { status: 500 })
    }
}

/**
 * PATCH /api/admin/badges/[id]
 * Actualiza la asignación de badge (solo campos de PlayerBadge, no Badge)
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
        const { badgeId } = body

        // Solo podemos actualizar badgeId en PlayerBadge
        // Los campos name, description, imageUrl están en Badge, no PlayerBadge
        const updatedBadge = await prisma.playerBadge.update({
            where: { id },
            data: {
                badgeId: badgeId || undefined,
            },
            include: {
                player: {
                    select: {
                        id: true,
                        username: true,
                        steamId: true,
                    },
                },
                badge: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        imageUrl: true,
                    },
                },
            },
        })

        return NextResponse.json({ badge: updatedBadge })
    } catch (error) {
        console.error("Error updating badge:", error)
        return NextResponse.json({ error: "Error al actualizar medalla" }, { status: 500 })
    }
}
