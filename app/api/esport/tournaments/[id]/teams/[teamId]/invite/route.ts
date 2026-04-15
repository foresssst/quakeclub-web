import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

// POST /api/esport/tournaments/[id]/teams/[teamId]/invite - Invitar jugador
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.steamId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { teamId } = await params
    const body = await request.json()
    const { steamId, playerId } = body

    if (!steamId && !playerId) {
      return NextResponse.json({ error: "Debes especificar steamId o playerId" }, { status: 400 })
    }

    // Verificar equipo y que el solicitante es capitán
    const team = await prisma.tournamentTeam.findUnique({
      where: { id: teamId },
      include: {
        captain: true,
        tournament: { select: { id: true, maxRosterSize: true } },
        members: { where: { status: { not: "REJECTED" } } }
      }
    })

    if (!team) {
      return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 })
    }

    if (team.captain.steamId !== session.steamId) {
      return NextResponse.json({ error: "Solo el capitán puede invitar jugadores" }, { status: 403 })
    }

    // Verificar límite de roster
    if (team.tournament.maxRosterSize && team.members.length >= team.tournament.maxRosterSize) {
      return NextResponse.json({ error: "El equipo ya tiene el máximo de jugadores permitidos" }, { status: 400 })
    }

    // Buscar jugador
    const player = await prisma.player.findFirst({
      where: steamId ? { steamId } : { id: playerId }
    })

    if (!player) {
      return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 })
    }

    // Verificar que no esté ya en este equipo
    const existingMember = await prisma.tournamentTeamMember.findUnique({
      where: { teamId_playerId: { teamId, playerId: player.id } }
    })

    if (existingMember) {
      if (existingMember.status === "REJECTED") {
        // Re-invitar: actualizar a PENDING
        const updated = await prisma.tournamentTeamMember.update({
          where: { id: existingMember.id },
          data: { status: "PENDING", invitedAt: new Date(), joinedAt: null },
          include: { player: { select: { id: true, username: true, steamId: true, avatar: true } } }
        })
        return NextResponse.json({ success: true, member: updated })
      }
      return NextResponse.json({ error: "Este jugador ya está en el equipo o tiene invitación pendiente" }, { status: 400 })
    }

    // Verificar que no esté en otro equipo del mismo torneo
    const otherTeam = await prisma.tournamentTeamMember.findFirst({
      where: {
        team: { tournamentId: team.tournamentId },
        playerId: player.id,
        status: { not: "REJECTED" }
      }
    })

    if (otherTeam) {
      return NextResponse.json({ error: "Este jugador ya está en otro equipo de este torneo" }, { status: 400 })
    }

    // Crear invitación
    const member = await prisma.tournamentTeamMember.create({
      data: {
        teamId,
        playerId: player.id,
        status: "PENDING"
      },
      include: {
        player: { select: { id: true, username: true, steamId: true, avatar: true } }
      }
    })

    return NextResponse.json({ success: true, member }, { status: 201 })
  } catch (error) {
    console.error("Error inviting player:", error)
    return NextResponse.json({ error: "Error al invitar jugador" }, { status: 500 })
  }
}
