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

// GET /api/admin/titles - Listar todos los títulos otorgados
export async function GET() {
    try {
        // Verificar permisos admin
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return error!

        const playerTitles = await prisma.playerTitle.findMany({
            include: {
                player: {
                    select: {
                        id: true,
                        username: true,
                        steamId: true,
                    },
                },
                title: true, // Incluir información del título global
            },
            orderBy: [
                { isActive: 'desc' },
                { priority: 'asc' },
                { awardedAt: 'desc' },
            ],
        })

        return NextResponse.json({ titles: playerTitles })
    } catch (error) {
        console.error("Error fetching player titles:", error)
        return NextResponse.json({ error: "Error al obtener títulos" }, { status: 500 })
    }
}

// POST /api/admin/titles - Otorgar título a jugador
export async function POST(request: Request) {
    try {
        // Verificar permisos admin
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return error!

        const body = await request.json()
        const { playerId, titleId, priority, isActive } = body

        if (!playerId || !titleId) {
            return NextResponse.json(
                { error: "playerId y titleId son requeridos" },
                { status: 400 }
            )
        }

        // Verificar que el título existe
        const title = await prisma.title.findUnique({
            where: { id: titleId },
        })

        if (!title) {
            return NextResponse.json(
                { error: "El título no existe" },
                { status: 404 }
            )
        }

        // Si es activo, desactivar otros títulos del jugador
        if (isActive) {
            await prisma.playerTitle.updateMany({
                where: { playerId, isActive: true },
                data: { isActive: false },
            })
        }

        const newPlayerTitle = await prisma.playerTitle.create({
            data: {
                playerId,
                titleId,
                priority: priority || 0,
                isActive: isActive !== undefined ? isActive : true,
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

        return NextResponse.json({ playerTitle: newPlayerTitle }, { status: 201 })
    } catch (error: any) {
        console.error("Error awarding title:", error)

        if (error.code === 'P2002') {
            return NextResponse.json({ error: "El jugador ya tiene este título" }, { status: 400 })
        }

        return NextResponse.json({ error: "Error al otorgar título" }, { status: 500 })
    }
}
