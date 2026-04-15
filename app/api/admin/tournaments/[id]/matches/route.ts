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

// GET /api/admin/tournaments/[id]/matches - Listar partidos del torneo
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Verificar permisos admin
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return error!

        const { id } = await params

        const matches = await prisma.tournamentMatch.findMany({
            where: { tournamentId: id },
            include: {
                participant1Reg: {
                    include: {
                        clan: {
                            select: {
                                id: true,
                                name: true,
                                tag: true,
                                slug: true,
                                avatarUrl: true
                            }
                        }
                    }
                },
                participant2Reg: {
                    include: {
                        clan: {
                            select: {
                                id: true,
                                name: true,
                                tag: true,
                                slug: true,
                                avatarUrl: true
                            }
                        }
                    }
                },
                winner: {
                    include: {
                        clan: true
                    }
                }
            },
            orderBy: [
                { round: 'asc' },
                { matchNumber: 'asc' }
            ]
        })

        return NextResponse.json({ matches })
    } catch (error) {
        console.error("Error fetching matches:", error)
        return NextResponse.json(
            { error: "Error al cargar partidos" },
            { status: 500 }
        )
    } finally {
        
    }
}

// POST /api/admin/tournaments/[id]/matches - Crear partido
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Verificar permisos admin
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return error!

        const { id: tournamentId } = await params
        const body = await request.json()

        const {
            participant1Id,
            participant2Id,
            scheduledFor,
            round,
            matchNumber,
            bracket
        } = body

        // Validar que los equipos estén registrados en el torneo
        if (participant1Id) {
            const team1 = await prisma.tournamentRegistration.findFirst({
                where: {
                    id: participant1Id,
                    tournamentId,
                    status: 'APPROVED'
                }
            })
            if (!team1) {
                return NextResponse.json(
                    { error: "Equipo 1 no está aprobado en este torneo" },
                    { status: 400 }
                )
            }
        }

        if (participant2Id) {
            const team2 = await prisma.tournamentRegistration.findFirst({
                where: {
                    id: participant2Id,
                    tournamentId,
                    status: 'APPROVED'
                }
            })
            if (!team2) {
                return NextResponse.json(
                    { error: "Equipo 2 no está aprobado en este torneo" },
                    { status: 400 }
                )
            }
        }

        const match = await prisma.tournamentMatch.create({
            data: {
                tournamentId,
                participant1Id: participant1Id || null,
                participant2Id: participant2Id || null,
                scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
                round: round || 1,
                matchNumber: matchNumber || 1,
                bracket: bracket || 'UPPER',
                status: 'PENDING'
            },
            include: {
                participant1Reg: {
                    include: { clan: true }
                },
                participant2Reg: {
                    include: { clan: true }
                }
            }
        })

        return NextResponse.json({
            success: true,
            match
        }, { status: 201 })

    } catch (error) {
        console.error("Error creating match:", error)
        return NextResponse.json(
            { error: "Error al crear partido" },
            { status: 500 }
        )
    } finally {
        
    }
}
