import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

// POST /api/esport/tournaments/[id]/invitations/[memberId]/respond - Aceptar o rechazar invitación
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.steamId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { memberId } = await params
    const body = await request.json()
    const { action } = body // "accept" o "reject"

    if (!action || !["accept", "reject"].includes(action)) {
      return NextResponse.json({ error: "Acción inválida. Usa 'accept' o 'reject'" }, { status: 400 })
    }

    const player = await prisma.player.findFirst({
      where: { steamId: session.steamId }
    })

    if (!player) {
      return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 })
    }

    const member = await prisma.tournamentTeamMember.findUnique({
      where: { id: memberId },
      include: { team: true }
    })

    if (!member) {
      return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 })
    }

    if (member.playerId !== player.id) {
      return NextResponse.json({ error: "Esta invitación no es tuya" }, { status: 403 })
    }

    if (member.status !== "PENDING") {
      return NextResponse.json({ error: "Esta invitación ya fue respondida" }, { status: 400 })
    }

    if (action === "accept") {
      // Verificar que no esté en otro equipo del mismo torneo
      const otherTeam = await prisma.tournamentTeamMember.findFirst({
        where: {
          team: { tournamentId: member.team.tournamentId },
          playerId: player.id,
          status: "ACCEPTED",
          id: { not: memberId }
        }
      })

      if (otherTeam) {
        return NextResponse.json({ error: "Ya estás en otro equipo de este torneo" }, { status: 400 })
      }

      await prisma.tournamentTeamMember.update({
        where: { id: memberId },
        data: { status: "ACCEPTED", joinedAt: new Date() }
      })

      return NextResponse.json({ success: true, message: "Invitación aceptada" })
    } else {
      await prisma.tournamentTeamMember.update({
        where: { id: memberId },
        data: { status: "REJECTED" }
      })

      return NextResponse.json({ success: true, message: "Invitación rechazada" })
    }
  } catch (error) {
    console.error("Error responding to invitation:", error)
    return NextResponse.json({ error: "Error al responder invitación" }, { status: 500 })
  }
}
