import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

// GET /api/esport/tournaments/[id]/invitations - Mis invitaciones pendientes en este torneo
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.steamId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { id: idOrSlug } = await params

    const tournament = await prisma.tournament.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] }
    })

    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 })
    }

    const player = await prisma.player.findFirst({
      where: { steamId: session.steamId }
    })

    if (!player) {
      return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 })
    }

    const invitations = await prisma.tournamentTeamMember.findMany({
      where: {
        playerId: player.id,
        status: "PENDING",
        team: { tournamentId: tournament.id }
      },
      include: {
        team: {
          include: {
            captain: { select: { id: true, username: true, steamId: true, avatar: true } },
            members: {
              where: { status: "ACCEPTED" },
              include: {
                player: { select: { id: true, username: true, steamId: true, avatar: true } }
              }
            }
          }
        }
      }
    })

    return NextResponse.json(invitations)
  } catch (error) {
    console.error("Error fetching invitations:", error)
    return NextResponse.json({ error: "Error al obtener invitaciones" }, { status: 500 })
  }
}
