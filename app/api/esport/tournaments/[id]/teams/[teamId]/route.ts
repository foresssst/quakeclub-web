import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

// GET /api/esport/tournaments/[id]/teams/[teamId] - Detalle del equipo
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const { teamId } = await params

    const team = await prisma.tournamentTeam.findUnique({
      where: { id: teamId },
      include: {
        captain: { select: { id: true, username: true, steamId: true, avatar: true } },
        members: {
          include: {
            player: { select: { id: true, username: true, steamId: true, avatar: true } }
          },
          orderBy: { invitedAt: "asc" }
        },
        registration: { select: { id: true, status: true } },
        tournament: { select: { id: true, name: true, minRosterSize: true, maxRosterSize: true } }
      }
    })

    if (!team) {
      return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 })
    }

    return NextResponse.json(team)
  } catch (error) {
    console.error("Error fetching team:", error)
    return NextResponse.json({ error: "Error al obtener equipo" }, { status: 500 })
  }
}

// PUT /api/esport/tournaments/[id]/teams/[teamId] - Editar equipo (solo capitán)
export async function PUT(
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
    const { name, tag, avatarUrl } = body

    const team = await prisma.tournamentTeam.findUnique({
      where: { id: teamId },
      include: { captain: true }
    })

    if (!team) {
      return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 })
    }

    if (team.captain.steamId !== session.steamId) {
      return NextResponse.json({ error: "Solo el capitán puede editar el equipo" }, { status: 403 })
    }

    const data: any = {}
    if (name?.trim()) data.name = name.trim()
    if (tag?.trim()) {
      if (tag.trim().length > 6) {
        return NextResponse.json({ error: "El tag no puede tener más de 6 caracteres" }, { status: 400 })
      }
      const newTag = tag.trim().toUpperCase()
      // Verificar que el tag no esté en uso por otro equipo
      const tagExists = await prisma.tournamentTeam.findFirst({
        where: { tournamentId: team.tournamentId, tag: newTag, id: { not: teamId } }
      })
      if (tagExists) {
        return NextResponse.json({ error: "Ese tag ya está en uso en este torneo" }, { status: 400 })
      }
      data.tag = newTag
    }
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl || null

    const updated = await prisma.tournamentTeam.update({
      where: { id: teamId },
      data,
      include: {
        captain: { select: { id: true, username: true, steamId: true, avatar: true } },
        members: {
          include: {
            player: { select: { id: true, username: true, steamId: true, avatar: true } }
          }
        }
      }
    })

    return NextResponse.json({ success: true, team: updated })
  } catch (error) {
    console.error("Error updating team:", error)
    return NextResponse.json({ error: "Error al actualizar equipo" }, { status: 500 })
  }
}

// DELETE /api/esport/tournaments/[id]/teams/[teamId] - Eliminar equipo (solo capitán, si no inscrito)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.steamId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { teamId } = await params

    const team = await prisma.tournamentTeam.findUnique({
      where: { id: teamId },
      include: { captain: true, registration: true }
    })

    if (!team) {
      return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 })
    }

    if (team.captain.steamId !== session.steamId) {
      return NextResponse.json({ error: "Solo el capitán puede eliminar el equipo" }, { status: 403 })
    }

    if (team.registration && team.registration.status !== "REJECTED") {
      return NextResponse.json({ error: "No puedes eliminar un equipo ya inscrito en el torneo" }, { status: 400 })
    }

    await prisma.tournamentTeam.delete({ where: { id: teamId } })

    return NextResponse.json({ success: true, message: "Equipo eliminado" })
  } catch (error) {
    console.error("Error deleting team:", error)
    return NextResponse.json({ error: "Error al eliminar equipo" }, { status: 500 })
  }
}
