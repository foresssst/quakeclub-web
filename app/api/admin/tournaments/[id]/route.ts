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

// GET /api/admin/tournaments/[id] - Obtener torneo
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Verificar permisos admin
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return error!

        const { id } = await params

        const tournament = await prisma.tournament.findUnique({
            where: { id },
            include: {
                registrations: {
                    include: {
                        clan: true
                    }
                },
                groups: {
                    include: {
                        registrations: {
                            include: {
                                clan: true
                            }
                        }
                    }
                },
                matches: true
            }
        })

        if (!tournament) {
            return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 })
        }

        return NextResponse.json({ tournament })

    } catch (error) {
        console.error("Error fetching tournament:", error)
        return NextResponse.json(
            { error: "Error al obtener torneo" },
            { status: 500 }
        )
    } finally {
        
    }
}

// PUT /api/admin/tournaments/[id] - Editar torneo
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

        // Build update object only with provided fields
        const updateData: Record<string, any> = {}

        if (body.name !== undefined) updateData.name = body.name
        if (body.description !== undefined) updateData.description = body.description
        if (body.gameType !== undefined) updateData.gameType = body.gameType
        if (body.maxParticipants !== undefined) updateData.maxParticipants = parseInt(body.maxParticipants)
        if (body.rules !== undefined) updateData.rules = body.rules
        if (body.tournamentRules !== undefined) updateData.tournamentRules = body.tournamentRules
        if (body.prizes !== undefined) updateData.prizes = body.prizes
        if (body.scheduleNotes !== undefined) updateData.scheduleNotes = body.scheduleNotes
        if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl
        if (body.registrationOpens !== undefined) {
            updateData.registrationOpens = body.registrationOpens ? new Date(body.registrationOpens) : null
        }
        if (body.registrationCloses !== undefined) {
            updateData.registrationCloses = body.registrationCloses ? new Date(body.registrationCloses) : null
        }
        if (body.startsAt !== undefined) {
            updateData.startsAt = body.startsAt ? new Date(body.startsAt) : null
        }

        // Validate status if provided
        if (body.status !== undefined) {
            const validStatuses = ['UPCOMING', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
            if (!validStatuses.includes(body.status)) {
                return NextResponse.json({ error: "Estado inválido" }, { status: 400 })
            }
            updateData.status = body.status
        }

        // Always update timestamp
        updateData.updatedAt = new Date()

        const tournament = await prisma.tournament.update({
            where: { id },
            data: updateData
        })

        return NextResponse.json({
            success: true,
            tournament
        })

    } catch (error) {
        console.error("Error updating tournament:", error)
        return NextResponse.json(
            { error: "Error al actualizar torneo" },
            { status: 500 }
        )
    } finally {
        
    }
}

// DELETE /api/admin/tournaments/[id] - Eliminar torneo
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Verificar permisos admin
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return error!

        const { id } = await params

        // Check if tournament exists
        const tournament = await prisma.tournament.findUnique({
            where: { id }
        })

        if (!tournament) {
            return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 })
        }

        // Delete in correct order respecting foreign keys
        // The schema has onDelete: Cascade on most relations, but we'll be explicit

        // 1. Delete match maps first (they reference matches)
        await prisma.tournamentMatchMap.deleteMany({
            where: {
                match: {
                    tournamentId: id
                }
            }
        })

        // 2. Delete matches
        await prisma.tournamentMatch.deleteMany({
            where: { tournamentId: id }
        })

        // 3. Delete clan rosters (they reference registrations)
        await prisma.tournamentClanRoster.deleteMany({
            where: {
                registration: {
                    tournamentId: id
                }
            }
        })

        // 4. Delete matchdays
        await prisma.tournamentMatchday.deleteMany({
            where: { tournamentId: id }
        })

        // 5. Delete registrations (after rosters and matches that reference them)
        await prisma.tournamentRegistration.deleteMany({
            where: { tournamentId: id }
        })

        // 6. Delete groups
        await prisma.tournamentGroup.deleteMany({
            where: { tournamentId: id }
        })

        // 7. Finally delete tournament
        await prisma.tournament.delete({
            where: { id }
        })

        return NextResponse.json({
            success: true,
            message: "Torneo eliminado correctamente"
        })

    } catch (error) {
        console.error("Error deleting tournament:", error)
        return NextResponse.json(
            { error: "Error al eliminar torneo: " + (error as Error).message },
            { status: 500 }
        )
    } finally {
        
    }
}
