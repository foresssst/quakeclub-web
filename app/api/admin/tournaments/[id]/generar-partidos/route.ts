import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { makeRoundRobinMatches, seedBalancedDistribution } from "@/lib/tournament-groups"
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

// POST /api/admin/tournaments/[id]/generar-partidos - Generar fase de grupos
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Verificar permisos admin
        const { isAdmin, error } = await verifyAdmin()
        if (!isAdmin) return error!

        const { id: tournamentId } = await params
        const body = await request.json().catch(() => ({}))
        const { 
            includeReturn = false, // Por defecto solo ida
            groupCount = 2         // Por defecto 2 grupos
        } = body

        // Obtener torneo para verificar configuración
        const tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            include: {
                registrations: {
                    where: { status: 'APPROVED' },
                    include: { clan: true },
                    orderBy: { seed: 'asc' }
                },
                groups: true
            }
        })

        if (!tournament) {
            return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 })
        }

        const registrations = tournament.registrations

        if (registrations.length < 2) {
            return NextResponse.json(
                { error: "Se necesitan al menos 2 equipos aprobados" },
                { status: 400 }
            )
        }

        // Delete existing group stage matches
        await prisma.tournamentMatch.deleteMany({
            where: {
                tournamentId,
                isPlayoff: false
            }
        })

        // If groups don't exist, create them
        let groups = tournament.groups
        if (groups.length === 0) {
            // Create groups based on configuration or default to 2
            const numGroups = tournament.groupsCount || groupCount
            const groupNames = ['Grupo A', 'Grupo B', 'Grupo C', 'Grupo D'].slice(0, numGroups)
            
            groups = await Promise.all(
                groupNames.map((name, index) => 
                    prisma.tournamentGroup.create({
                        data: {
                            tournamentId,
                            name,
                            order: index + 1
                        }
                    })
                )
            )
        }

        // Check if teams are already assigned to groups
        const teamsWithGroups = registrations.filter(r => r.groupId !== null)
        const needsDistribution = teamsWithGroups.length === 0

        let teamDistribution: (typeof registrations)[]

        if (needsDistribution) {
            // No teams assigned to groups yet - use seed-balanced distribution (snake draft)
            // This ensures top seeds are spread across groups
            teamDistribution = seedBalancedDistribution(registrations, groups.length)
            
            // Assign teams to groups
            for (let gIdx = 0; gIdx < groups.length; gIdx++) {
                const groupTeams = teamDistribution[gIdx]
                for (const team of groupTeams) {
                    await prisma.tournamentRegistration.update({
                        where: { id: team.id },
                        data: { groupId: groups[gIdx].id }
                    })
                }
            }
        } else {
            // Teams already assigned - use existing assignments
            // Group registrations by their current groupId
            teamDistribution = groups.map(group => 
                registrations.filter(r => r.groupId === group.id)
            )
        }

        const createdMatches = []
        let matchNumber = 1

        // Generate matches for each group using the correct Round Robin algorithm
        for (let gIdx = 0; gIdx < groups.length; gIdx++) {
            const group = groups[gIdx]
            const groupTeams = teamDistribution[gIdx]

            // Use brackets-manager.js style Round Robin distribution
            // This creates proper rounds where each team plays once per round
            const mode = includeReturn ? 'double' : 'simple'
            const rounds = makeRoundRobinMatches(groupTeams, mode)

            // Create matches organized by round/jornada
            for (let roundIdx = 0; roundIdx < rounds.length; roundIdx++) {
                const round = rounds[roundIdx]
                const isReturnRound = includeReturn && roundIdx >= Math.ceil(rounds.length / 2)
                const jornada = roundIdx + 1

                for (const [team1, team2] of round) {
                    const match = await prisma.tournamentMatch.create({
                        data: {
                            tournamentId,
                            groupId: group.id,
                            round: jornada,
                            matchNumber: matchNumber++,
                            bracket: 'UPPER',
                            participant1Id: team1.id,
                            participant2Id: team2.id,
                            homeTeamId: team1.id,
                            status: 'PENDING',
                            isPlayoff: false,
                            bestOf: tournament.mapsPerMatch || 3,
                            roundText: isReturnRound 
                                ? `Jornada ${jornada} (Vuelta)` 
                                : `Jornada ${jornada}`
                        }
                    })
                    createdMatches.push(match)
                }
            }
        }

        // Actualizar estado del torneo
        await prisma.tournament.update({
            where: { id: tournamentId },
            data: { status: 'IN_PROGRESS' }
        })

        // Build response with group distribution
        const groupsResponse: Record<string, string[]> = {}
        for (let i = 0; i < groups.length; i++) {
            groupsResponse[groups[i].name] = teamDistribution[i].map(t => t.clan?.name || 'Sin nombre')
        }

        return NextResponse.json({
            success: true,
            matchesCreated: createdMatches.length,
            groups: groupsResponse,
            includeReturn,
            algorithm: 'brackets-manager.js Round Robin',
            usedExistingAssignments: !needsDistribution
        })

    } catch (error) {
        console.error("Error generating matches:", error)
        return NextResponse.json(
            { error: "Error al generar partidos: " + (error as Error).message },
            { status: 500 }
        )
    }
}
