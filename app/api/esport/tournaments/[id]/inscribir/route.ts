import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { normalizeApprovedSeeds } from "@/lib/tournament-seeding"


// POST /api/esport/tournaments/[id]/inscribir - Inscribir clan o equipo al torneo
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: idOrSlug } = await params
        const body = await request.json()
        const { clanId, tournamentTeamId, adminApproved } = body

        // Validaciones
        if (!clanId && !tournamentTeamId) {
            return NextResponse.json(
                { error: "Debes especificar un clan o un equipo de torneo" },
                { status: 400 }
            )
        }

        // Verificar que el torneo existe (buscar por ID o slug)
        const tournament = await prisma.tournament.findFirst({
            where: {
                OR: [
                    { id: idOrSlug },
                    { slug: idOrSlug }
                ]
            },
            include: {
                _count: {
                    select: { registrations: true }
                }
            }
        })

        if (!tournament) {
            return NextResponse.json(
                { error: "Torneo no encontrado" },
                { status: 404 }
            )
        }

        const tournamentId = tournament.id

        // Solo verificar estado si no es admin
        if (!adminApproved && tournament.status !== 'REGISTRATION_OPEN') {
            return NextResponse.json(
                { error: "Las inscripciones no están abiertas" },
                { status: 400 }
            )
        }

        // Verificar límite de participantes
        if (tournament.maxParticipants && tournament._count.registrations >= tournament.maxParticipants) {
            return NextResponse.json(
                { error: "El torneo ha alcanzado el máximo de participantes" },
                { status: 400 }
            )
        }

        // ===== INSCRIPCIÓN POR EQUIPO DE TORNEO =====
        if (tournamentTeamId) {
            const team = await prisma.tournamentTeam.findUnique({
                where: { id: tournamentTeamId },
                include: {
                    members: { where: { status: "ACCEPTED" } },
                    registration: true
                }
            })

            if (!team) {
                return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 })
            }

            if (team.tournamentId !== tournamentId) {
                return NextResponse.json({ error: "El equipo no pertenece a este torneo" }, { status: 400 })
            }

            if (team.registration) {
                return NextResponse.json({ error: "Este equipo ya está inscrito en el torneo" }, { status: 400 })
            }

            // Validar roster mínimo
            const acceptedCount = team.members.length
            if (tournament.minRosterSize && acceptedCount < tournament.minRosterSize) {
                return NextResponse.json(
                    { error: `El equipo necesita al menos ${tournament.minRosterSize} jugadores confirmados. Actualmente tiene ${acceptedCount}.` },
                    { status: 400 }
                )
            }

            // Crear registro + copiar miembros al roster de torneo
            const registration = await prisma.tournamentRegistration.create({
                data: {
                    tournamentId,
                    tournamentTeamId: team.id,
                    participantType: 'TEAM',
                    status: adminApproved ? 'APPROVED' : 'PENDING',
                    roster: {
                        create: team.members.map((member: (typeof team.members)[number]) => ({
                            playerId: member.playerId,
                            role: member.role || "titular"
                        }))
                    }
                },
                include: {
                    tournamentTeam: {
                        select: { id: true, name: true, tag: true, avatarUrl: true }
                    },
                    roster: {
                        include: {
                            player: { select: { id: true, username: true, steamId: true } }
                        }
                    }
                }
            })

            if (adminApproved) {
                await normalizeApprovedSeeds(tournamentId)
            }

            return NextResponse.json({
                success: true,
                message: "Equipo inscrito exitosamente. La inscripción será revisada por los organizadores.",
                registration
            }, { status: 201 })
        }

        // ===== INSCRIPCIÓN POR CLAN (flujo original) =====
        const clan = await prisma.clan.findUnique({
            where: { id: clanId }
        })

        if (!clan) {
            return NextResponse.json(
                { error: "Clan no encontrado" },
                { status: 404 }
            )
        }

        // Verificar que el clan no esté ya inscrito
        const existingReg = await prisma.tournamentRegistration.findFirst({
            where: {
                tournamentId,
                clanId,
                status: {
                    not: 'REJECTED'
                }
            }
        })

        if (existingReg) {
            return NextResponse.json(
                { error: "Este clan ya está inscrito en el torneo" },
                { status: 400 }
            )
        }

        // Crear inscripción
        const registration = await prisma.tournamentRegistration.create({
            data: {
                tournamentId,
                clanId,
                participantType: 'CLAN',
                status: adminApproved ? 'APPROVED' : 'PENDING'
            },
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
        })

        if (adminApproved) {
            await normalizeApprovedSeeds(tournamentId)
        }

        return NextResponse.json({
            success: true,
            message: "Clan inscrito exitosamente. La inscripción será revisada por los organizadores.",
            registration
        }, { status: 201 })

    } catch (error) {
        console.error("Error creating registration:", error)
        return NextResponse.json(
            { error: "Error al inscribir" },
            { status: 500 }
        )
    }
}
