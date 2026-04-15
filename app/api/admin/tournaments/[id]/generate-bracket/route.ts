import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BracketsManager } from '@/lib/brackets-manager'
import { getSession } from '@/lib/auth'
import { normalizeApprovedSeeds } from '@/lib/tournament-seeding'
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
/**
 * DELETE /api/admin/tournaments/[id]/generate-bracket
 *
 * Deletes all matches for a tournament (resets the bracket).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar permisos admin
    const { isAdmin, error } = await verifyAdmin()
    if (!isAdmin) return error!
    const { id } = await params
    // Delete all matches using BracketsManager
    const deletedCount = await BracketsManager.delete.allMatches(id)
    return NextResponse.json({
      success: true,
      message: `Bracket deleted successfully (${deletedCount} matches removed)`,
      deletedCount,
    })
  } catch (error) {
    console.error('Error deleting bracket:', error)
    return NextResponse.json(
      {
        error: 'Error deleting bracket',
      },
      { status: 500 }
    )
  }
}
/**
 * POST /api/admin/tournaments/[id]/generate-bracket
 *
 * Generates tournament brackets using the brackets-manager.js algorithm.
 *
 * This completely replaces the previous implementation with clean,
 * tested logic from brackets-manager.js library.
 *
 * Key improvements:
 * - Proper BYE balancing (no BYE vs BYE matches)
 * - BYE matches keep status 'BYE' (not marked as COMPLETED)
 * - Clean round/match creation without manual index calculations
 * - Proper loser bracket progression
 * - Handles all edge cases correctly
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar permisos admin
    const { isAdmin, error } = await verifyAdmin()
    if (!isAdmin) return error!
    const { id } = await params
    const body = await request.json()
    const shuffle = body.shuffle === true
    console.log(`\n==============================================`)
    console.log(`GENERATING BRACKET FOR TOURNAMENT: ${id}`)
    console.log(`Shuffle: ${shuffle}`)
    console.log(`==============================================\n`)
    // Fetch tournament with registrations
    const tournament = await prisma.tournament.findUnique({
      where: { id },
        include: {
          registrations: {
            where: {
              status: 'APPROVED',
            },
            select: {
              id: true,
              seed: true,
              registeredAt: true,
              clan: {
                select: {
                  tag: true,
                  name: true,
              },
            },
          },
        },
      },
    })
    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }
    // Validate format
    const format = tournament.format || 'SINGLE_ELIMINATION'
    if (format !== 'DOUBLE_ELIMINATION' && format !== 'SINGLE_ELIMINATION') {
      return NextResponse.json(
        { error: `Format ${format} is not supported yet. Use DOUBLE_ELIMINATION or SINGLE_ELIMINATION.` },
        { status: 400 }
      )
    }
    // Get approved registrations
    const teams = tournament.registrations
    const teamCount = teams.length
    type ApprovedTeam = (typeof teams)[number]
    const teamById = new Map<string, ApprovedTeam>(
      teams.map((team): [string, ApprovedTeam] => [team.id, team])
    )
    const orderedTeams = shuffle
      ? teams
      : (await normalizeApprovedSeeds(id))
          .map((seeded): ApprovedTeam | undefined => teamById.get(seeded.id))
          .filter((team): team is ApprovedTeam => Boolean(team))
    console.log(`Teams registered: ${teamCount}`)
    orderedTeams.forEach((team: ApprovedTeam, i: number) => {
      console.log(`  ${i + 1}. [${team.clan.tag}] ${team.clan.name}`)
    })
    // Validate minimum participants
    if (teamCount < 2) {
      return NextResponse.json(
        { error: 'At least 2 teams are required' },
        { status: 400 }
      )
    }
    // For double elimination, need at least 3 teams
    if (format === 'DOUBLE_ELIMINATION' && teamCount < 3) {
      return NextResponse.json(
        { error: 'Double Elimination requires at least 3 teams' },
        { status: 400 }
      )
    }
    // Extract registration IDs
    const registrationIds = orderedTeams.map((team: ApprovedTeam) => team.id)
    // Generate the bracket using BracketsManager
    if (format === 'DOUBLE_ELIMINATION') {
      await BracketsManager.create.doubleElimination(id, registrationIds, shuffle)
    } else if (format === 'SINGLE_ELIMINATION') {
      await BracketsManager.create.singleElimination(id, registrationIds, shuffle)
    } else {
      return NextResponse.json(
        { error: `Unsupported format: ${format}` },
        { status: 501 }
      )
    }
    // Fetch created matches for verification
    const createdMatches = await prisma.tournamentMatch.findMany({
      where: { tournamentId: id },
      orderBy: [{ bracket: 'asc' }, { round: 'asc' }, { matchNumber: 'asc' }],
      select: {
        id: true,
        round: true,
        matchNumber: true,
        bracket: true,
        status: true,
        participant1Id: true,
        participant2Id: true,
        winnerId: true,
        roundText: true,
      },
    })
    console.log(`\n✅ BRACKET GENERATED SUCCESSFULLY`)
    console.log(`Total matches created: ${createdMatches.length}`)
    console.log(`BYE matches: ${createdMatches.filter((match) => match.status === 'BYE').length}`)
    console.log(`Regular matches: ${createdMatches.filter((match) => match.status === 'PENDING').length}`)
    console.log(`==============================================\n`)
    return NextResponse.json({
      success: true,
      message: `Bracket generated successfully with ${createdMatches.length} matches`,
      stats: {
        totalMatches: createdMatches.length,
        byeMatches: createdMatches.filter((match) => match.status === 'BYE').length,
        pendingMatches: createdMatches.filter((match) => match.status === 'PENDING').length,
      },
      matches: createdMatches,
    })
  } catch (error) {
    console.error('Error generating bracket:', error)
    return NextResponse.json(
      {
        error: 'Error generating bracket',
      },
      { status: 500 }
    )
  }
}
