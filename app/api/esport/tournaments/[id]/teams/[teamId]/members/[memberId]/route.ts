import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

// DELETE /api/esport/tournaments/[id]/teams/[teamId]/members/[memberId] - Remover miembro (capitán)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; teamId: string; memberId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.steamId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { teamId, memberId } = await params

    const team = await prisma.tournamentTeam.findUnique({
      where: { id: teamId },
      include: { captain: true }
    })

    if (!team) {
      return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 })
    }

    if (team.captain.steamId !== session.steamId) {
      return NextResponse.json({ error: "Solo el capitán puede remover miembros" }, { status: 403 })
    }

    const member = await prisma.tournamentTeamMember.findUnique({
      where: { id: memberId }
    })

    if (!member || member.teamId !== teamId) {
      return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 })
    }

    // No se puede remover al capitán
    if (member.playerId === team.captainId) {
      return NextResponse.json({ error: "No puedes removerte a ti mismo como capitán" }, { status: 400 })
    }

    await prisma.tournamentTeamMember.delete({ where: { id: memberId } })

    return NextResponse.json({ success: true, message: "Miembro removido" })
  } catch (error) {
    console.error("Error removing member:", error)
    return NextResponse.json({ error: "Error al remover miembro" }, { status: 500 })
  }
}
