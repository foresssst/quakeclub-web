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

// GET /api/admin/titles/library - Listar todos los títulos globales
export async function GET() {
    try {
        // Verificar permisos admin
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return error!

        const titles = await prisma.title.findMany({
            include: {
                _count: {
                    select: { playerTitles: true }
                }
            },
            orderBy: {
                createdAt: 'desc',
            },
        })

        return NextResponse.json({ titles })
    } catch (error) {
        console.error("Error fetching titles:", error)
        return NextResponse.json({ error: "Error al obtener títulos" }, { status: 500 })
    }
}

// POST /api/admin/titles/library - Crear nuevo título global
export async function POST(request: Request) {
    try {
        // Verificar permisos admin
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return error!

        const body = await request.json()
        const { name, titleUrl, titleColor } = body

        if (!name) {
            return NextResponse.json(
                { error: "El nombre del título es requerido" },
                { status: 400 }
            )
        }

        const newTitle = await prisma.title.create({
            data: {
                name,
                titleUrl: titleUrl || null,
                titleColor: titleColor || null,
            },
        })

        return NextResponse.json({ title: newTitle }, { status: 201 })
    } catch (error: any) {
        console.error("Error creating title:", error)

        if (error.code === 'P2002') {
            return NextResponse.json({ error: "Ya existe un título con ese nombre" }, { status: 400 })
        }

        return NextResponse.json({ error: "Error al crear título" }, { status: 500 })
    }
}
