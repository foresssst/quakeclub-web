import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from '@/lib/auth'
import { generateTournamentSlug, generateUniqueSlug } from '@/lib/slug'
import { logAuditAsync } from '@/lib/audit'


// POST /api/admin/tournaments - Crear nuevo torneo
export async function POST(request: Request) {
    try {
        const session = await getSession()
        if (!session?.user?.isAdmin) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const {
            name,
            description,
            gameType,
            format, // SINGLE_ELIMINATION, DOUBLE_ELIMINATION, etc.
            maxParticipants,
            registrationOpens,
            registrationCloses,
            startsAt,
            rules,
            prizes,
            imageUrl,
            // Custom tournament fields
            tournamentType,
            groupsCount,
            teamsPerGroup,
            mapsPerMatch,
            playoffFormat,
            minRosterSize,
            maxRosterSize,
            tournamentRules,
            scheduleNotes
        } = body

        // Validaciones básicas
        if (!name || !gameType || !startsAt) {
            return NextResponse.json(
                { error: "Nombre, tipo de juego y fecha de inicio son requeridos" },
                { status: 400 }
            )
        }

        // Validar configuración de torneo customizado
        if (tournamentType === 'CUSTOM_GROUP') {
            if (!groupsCount || !teamsPerGroup) {
                return NextResponse.json(
                    { error: "Torneos customizados requieren configuración de grupos" },
                    { status: 400 }
                )
            }
        }

        // Determine the format based on tournament type
        let tournamentFormat = format || 'SINGLE_ELIMINATION'
        if (tournamentType === 'CUSTOM_GROUP') {
            tournamentFormat = 'ROUND_ROBIN'
        }

        // Generar slug único basado en el nombre
        const baseSlug = generateTournamentSlug(name)
        const existingSlugs = await prisma.tournament.findMany({
            select: { slug: true },
            where: { slug: { not: null } }
        }).then(tournaments => tournaments.map(t => t.slug!).filter(Boolean))
        const slug = generateUniqueSlug(baseSlug, existingSlugs)

        console.log('Creating tournament with format:', tournamentFormat, 'type:', tournamentType, 'slug:', slug)

        const tournament = await prisma.tournament.create({
            data: {
                name,
                slug,
                description: description || null,
                gameType,
                format: tournamentFormat,
                teamBased: true,
                maxParticipants: maxParticipants || 10,
                status: 'UPCOMING',
                registrationOpens: registrationOpens ? new Date(registrationOpens) : null,
                registrationCloses: registrationCloses ? new Date(registrationCloses) : null,
                startsAt: new Date(startsAt),
                rules: rules || null,
                prizes: prizes || null,
                imageUrl: imageUrl || null,
                createdBy: session.user.id,
                // Custom tournament fields
                tournamentType: tournamentType || 'STANDARD',
                groupsCount: groupsCount || null,
                teamsPerGroup: teamsPerGroup || null,
                mapsPerMatch: mapsPerMatch || null,
                playoffFormat: playoffFormat || null,
                minRosterSize: minRosterSize || null,
                maxRosterSize: maxRosterSize || null,
                tournamentRules: tournamentRules || null,
                scheduleNotes: scheduleNotes || null
            }
        })

        logAuditAsync({ category: "TOURNAMENT", action: "CREATE_TOURNAMENT", targetType: "tournament", targetId: tournament.id, targetName: tournament.name, details: { gameType: tournament.gameType, format: tournament.format } }, session, request)

        return NextResponse.json({
            success: true,
            tournament
        }, { status: 201 })

    } catch (error) {
        console.error("Error creating tournament:", error)
        return NextResponse.json(
            { error: "Error al crear torneo" },
            { status: 500 }
        )
    } finally {
        
    }
}
