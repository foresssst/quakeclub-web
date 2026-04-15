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

// GET /api/admin/badges/library - Listar todos los badges globales
export async function GET() {
    try {
        // Verificar permisos admin
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return error!

        const badges = await prisma.badge.findMany({
            include: {
                _count: {
                    select: { playerBadges: true }
                }
            },
            orderBy: {
                createdAt: 'desc',
            },
        })

        return NextResponse.json({ badges })
    } catch (error) {
        console.error("Error fetching badges:", error)
        return NextResponse.json({ error: "Error al obtener badges" }, { status: 500 })
    }
}

// POST /api/admin/badges/library - Crear nuevo badge global
export async function POST(request: Request) {
    try {
        // Verificar permisos admin
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return error!

        const body = await request.json()
        const { name, description, imageUrl, badgeUrl, category } = body

        if (!name || !imageUrl) {
            return NextResponse.json(
                { error: "El nombre y la imagen son requeridos" },
                { status: 400 }
            )
        }

        const newBadge = await prisma.badge.create({
            data: {
                name,
                description: description || null,
                imageUrl,
                badgeUrl: badgeUrl || null,
                category: category || null,
            },
        })

        return NextResponse.json({ badge: newBadge }, { status: 201 })
    } catch (error: any) {
        console.error("Error creating badge:", error)

        if (error.code === 'P2002') {
            return NextResponse.json({ error: "Ya existe un badge con ese nombre" }, { status: 400 })
        }

        return NextResponse.json({ error: "Error al crear badge" }, { status: 500 })
    }
}
