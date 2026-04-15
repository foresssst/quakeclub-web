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

// POST /api/admin/tournaments/[id]/registrations/create-by-tag
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Verificar permisos admin
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return error!

        const { id: tournamentId } = await params
        const { tag } = await request.json()

        if (!tag) {
            return NextResponse.json(
                { error: "Tag es requerido" },
                { status: 400 }
            )
        }

        // Find clan by tag
        const clan = await prisma.clan.findUnique({
            where: { tag },
            include: {
                ClanMember: {
                    take: 6,
                    include: {
                        Player: true
                    }
                }
            }
        }) as any // Cast to any to avoid TS issues with includes for now

        if (!clan) {
            return NextResponse.json(
                { error: "Clan no encontrado" },
                { status: 404 }
            )
        }

        // Check if already registered
        const existing = await prisma.tournamentRegistration.findFirst({
            where: {
                tournamentId,
                clanId: clan.id
            }
        })

        if (existing) {
            return NextResponse.json(
                { error: "El clan ya está inscrito" },
                { status: 400 }
            )
        }

        // Create registration with auto-roster
        // We'll assign first 4 as 'titular' and rest as 'suplente'
        const rosterData = clan.ClanMember.map((member: any, index: number) => ({
            playerId: member.playerId,
            role: index < 4 ? 'titular' : 'suplente'
        }))

        const registration = await prisma.tournamentRegistration.create({
            data: {
                tournamentId,
                clanId: clan.id,
                participantType: 'CLAN',
                status: 'APPROVED', // Auto approve since admin added it
                roster: {
                    create: rosterData
                }
            },
            include: {
                clan: true,
                roster: {
                    include: {
                        player: true
                    }
                }
            }
        })

        return NextResponse.json({
            success: true,
            registration
        })

    } catch (error) {
        console.error("Error creating registration:", error)
        return NextResponse.json(
            { error: "Error al inscribir clan" },
            { status: 500 }
        )
    } finally {
        
    }
}
