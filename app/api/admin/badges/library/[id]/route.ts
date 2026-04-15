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

// PUT /api/admin/badges/library/[id] - Actualizar badge global
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Verificar permisos admin
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return error!

        const { id } = await params
        const body = await request.json()
        const { name, description, imageUrl, badgeUrl, category } = body

        if (!name || !imageUrl) {
            return NextResponse.json(
                { error: "El nombre y la imagen son requeridos" },
                { status: 400 }
            )
        }

        const updatedBadge = await prisma.badge.update({
            where: { id },
            data: {
                name,
                description: description || null,
                imageUrl,
                badgeUrl: badgeUrl || null,
                category: category || null,
            },
        })

        return NextResponse.json({ badge: updatedBadge })
    } catch (error: any) {
        console.error("Error updating badge:", error)

        if (error.code === 'P2002') {
            return NextResponse.json({ error: "Ya existe un badge con ese nombre" }, { status: 400 })
        }

        if (error.code === 'P2025') {
            return NextResponse.json({ error: "Badge no encontrado" }, { status: 404 })
        }

        return NextResponse.json({ error: "Error al actualizar badge" }, { status: 500 })
    }
}

// DELETE /api/admin/badges/library/[id] - Eliminar badge global
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Verificar permisos admin
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return error!

        const { id } = await params

        // Primero eliminar todas las asignaciones a jugadores
        await prisma.playerBadge.deleteMany({
            where: { badgeId: id },
        })

        // Luego eliminar el badge global
        await prisma.badge.delete({
            where: { id },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error deleting badge:", error)
        return NextResponse.json({ error: "Error al eliminar badge" }, { status: 500 })
    }
}
