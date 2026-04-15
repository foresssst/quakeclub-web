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

// GET /api/admin/tournaments/[id]/available-clans
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Verificar permisos admin
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return error!

        const { id: tournamentId } = await params

        // Get all clans
        const allClans = await prisma.clan.findMany({
            select: {
                id: true,
                name: true,
                tag: true,
                slug: true,
                avatarUrl: true,
                _count: {
                    select: { ClanMember: true }
                }
            },
            orderBy: {
                name: 'asc'
            }
        })

        // Get registered clan IDs
        const registrations = await prisma.tournamentRegistration.findMany({
            where: {
                tournamentId,
                status: {
                    not: 'REJECTED'
                }
            },
            select: {
                clanId: true
            }
        })

        const registeredClanIds = new Set(registrations.map(r => r.clanId))

        // Filter out registered clans
        const availableClans = allClans.filter(clan => !registeredClanIds.has(clan.id))

        return NextResponse.json({
            clans: availableClans
        })

    } catch (error) {
        console.error("Error fetching available clans:", error)
        return NextResponse.json(
            { error: "Error al obtener clanes disponibles" },
            { status: 500 }
        )
    } finally {
        
    }
}
