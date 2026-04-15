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

// PUT /api/admin/titles/library/[id] - Actualizar título global
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
        const { name, titleUrl, titleColor } = body

        if (!name) {
            return NextResponse.json(
                { error: "El nombre del título es requerido" },
                { status: 400 }
            )
        }

        const updatedTitle = await prisma.title.update({
            where: { id },
            data: {
                name,
                titleUrl: titleUrl || null,
                titleColor: titleColor || null,
            },
        })

        return NextResponse.json({ title: updatedTitle })
    } catch (error: any) {
        console.error("Error updating title:", error)

        if (error.code === 'P2002') {
            return NextResponse.json({ error: "Ya existe un título con ese nombre" }, { status: 400 })
        }

        if (error.code === 'P2025') {
            return NextResponse.json({ error: "Título no encontrado" }, { status: 404 })
        }

        return NextResponse.json({ error: "Error al actualizar título" }, { status: 500 })
    }
}

// DELETE /api/admin/titles/library/[id] - Eliminar título global
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
        await prisma.playerTitle.deleteMany({
            where: { titleId: id },
        })

        // Luego eliminar el título global
        await prisma.title.delete({
            where: { id },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error deleting title:", error)
        return NextResponse.json({ error: "Error al eliminar título" }, { status: 500 })
    }
}
