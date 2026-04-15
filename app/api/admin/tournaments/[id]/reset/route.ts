import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// POST /api/admin/tournaments/[id]/reset - Reset tournament (delete groups and matches)
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession()
        if (!session?.user?.isAdmin) {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 401 }
            )
        }

        const { id } = await params
        const { mode } = await request.json() // 'all' | 'matches' | 'playoffs'

        // Verify tournament exists
        const tournament = await prisma.tournament.findUnique({
            where: { id },
            include: {
                groups: true,
                matches: true
            }
        })

        if (!tournament) {
            return NextResponse.json(
                { error: 'Torneo no encontrado' },
                { status: 404 }
            )
        }

        let deletedMatches = 0
        let deletedGroups = 0
        let deletedMaps = 0

        if (mode === 'all' || mode === 'matches') {
            // Delete all match maps first
            const matchIds = tournament.matches.map(m => m.id)
            if (matchIds.length > 0) {
                const mapsResult = await prisma.tournamentMatchMap.deleteMany({
                    where: { matchId: { in: matchIds } }
                })
                deletedMaps = mapsResult.count
            }

            // Delete all matches
            const matchesResult = await prisma.tournamentMatch.deleteMany({
                where: { tournamentId: id }
            })
            deletedMatches = matchesResult.count
        }

        if (mode === 'playoffs') {
            // Delete only playoff matches
            const playoffMatches = tournament.matches.filter(m => m.isPlayoff)
            const playoffMatchIds = playoffMatches.map(m => m.id)
            
            if (playoffMatchIds.length > 0) {
                const mapsResult = await prisma.tournamentMatchMap.deleteMany({
                    where: { matchId: { in: playoffMatchIds } }
                })
                deletedMaps = mapsResult.count

                const matchesResult = await prisma.tournamentMatch.deleteMany({
                    where: { 
                        tournamentId: id,
                        isPlayoff: true
                    }
                })
                deletedMatches = matchesResult.count
            }
        }

        if (mode === 'all') {
            // Reset group positions for all registrations
            await prisma.tournamentRegistration.updateMany({
                where: { tournamentId: id },
                data: { 
                    groupId: null,
                    groupPosition: null
                }
            })

            // Delete all groups
            const groupsResult = await prisma.tournamentGroup.deleteMany({
                where: { tournamentId: id }
            })
            deletedGroups = groupsResult.count
        }

        return NextResponse.json({
            success: true,
            message: mode === 'all' 
                ? `Torneo reiniciado: ${deletedMatches} partidos, ${deletedMaps} mapas y ${deletedGroups} grupos eliminados`
                : mode === 'playoffs'
                    ? `Playoffs reiniciados: ${deletedMatches} partidos y ${deletedMaps} mapas eliminados`
                    : `Partidos reiniciados: ${deletedMatches} partidos y ${deletedMaps} mapas eliminados`,
            deletedMatches,
            deletedMaps,
            deletedGroups
        })

    } catch (error) {
        console.error('Error resetting tournament:', error)
        return NextResponse.json(
            { error: 'Error al reiniciar torneo' },
            { status: 500 }
        )
    }
}
