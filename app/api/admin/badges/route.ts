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

// GET /api/admin/badges - Listar todas las medallas otorgadas
export async function GET() {
    try {
        // Verificar permisos admin
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return error!

        const playerBadges = await prisma.playerBadge.findMany({
            include: {
                player: {
                    select: {
                        id: true,
                        username: true,
                        steamId: true,
                    },
                },
                badge: true, // Incluir información del badge global
            },
            orderBy: [
                { awardedAt: 'desc' },
            ],
        })

        return NextResponse.json({ badges: playerBadges })
    } catch (error) {
        console.error("Error fetching player badges:", error)
        return NextResponse.json({ error: "Error al obtener medallas" }, { status: 500 })
    }
}

// POST /api/admin/badges - Otorgar badge a jugador
export async function POST(request: Request) {
    try {
        // Verificar permisos admin
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return error!

        const body = await request.json()
        const { playerId, badgeId } = body

        if (!playerId || !badgeId) {
            return NextResponse.json(
                { error: "playerId y badgeId son requeridos" },
                { status: 400 }
            )
        }

        // Verificar que el badge existe
        const badge = await prisma.badge.findUnique({
            where: { id: badgeId },
        })

        if (!badge) {
            return NextResponse.json(
                { error: "El badge no existe" },
                { status: 404 }
            )
        }

        const newPlayerBadge = await prisma.playerBadge.create({
            data: {
                playerId,
                badgeId,
            },
            include: {
                player: {
                    select: {
                        id: true,
                        username: true,
                        steamId: true,
                    },
                },
                badge: true,
            },
        })

        return NextResponse.json({ playerBadge: newPlayerBadge }, { status: 201 })
    } catch (error: any) {
        console.error("Error awarding badge:", error)

        if (error.code === 'P2002') {
            return NextResponse.json({ error: "El jugador ya tiene este badge" }, { status: 400 })
        }

        return NextResponse.json({ error: "Error al otorgar badge" }, { status: 500 })
    }
}
