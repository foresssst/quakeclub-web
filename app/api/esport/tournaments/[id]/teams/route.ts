import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

// GET /api/esport/tournaments/[id]/teams - Listar equipos del torneo
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idOrSlug } = await params

    const tournament = await prisma.tournament.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] }
    })

    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 })
    }

    const teams = await prisma.tournamentTeam.findMany({
      where: { tournamentId: tournament.id },
      include: {
        captain: { select: { id: true, username: true, steamId: true, avatar: true } },
        members: {
          include: {
            player: { select: { id: true, username: true, steamId: true, avatar: true } }
          },
          orderBy: { invitedAt: "asc" }
        },
        registration: { select: { id: true, status: true } }
      },
      orderBy: { createdAt: "asc" }
    })

    return NextResponse.json({ teams })
  } catch (error) {
    console.error("Error fetching teams:", error)
    return NextResponse.json({ error: "Error al obtener equipos" }, { status: 500 })
  }
}

// POST /api/esport/tournaments/[id]/teams - Crear equipo
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.steamId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { id: idOrSlug } = await params
    const body = await request.json()
    const { name, tag } = body

    if (!name?.trim() || !tag?.trim()) {
      return NextResponse.json({ error: "Nombre y tag son requeridos" }, { status: 400 })
    }

    if (tag.trim().length > 6) {
      return NextResponse.json({ error: "El tag no puede tener más de 6 caracteres" }, { status: 400 })
    }

    const tournament = await prisma.tournament.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] }
    })

    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 })
    }

    // Buscar jugador
    const player = await prisma.player.findFirst({
      where: { steamId: session.steamId }
    })

    if (!player) {
      return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 })
    }

    // Verificar que no tenga ya un equipo en este torneo (como capitán)
    const existingTeam = await prisma.tournamentTeam.findFirst({
      where: { tournamentId: tournament.id, captainId: player.id }
    })

    if (existingTeam) {
      return NextResponse.json({ error: "Ya tienes un equipo creado en este torneo" }, { status: 400 })
    }

    // Verificar que no esté ya en otro equipo de este torneo
    const existingMembership = await prisma.tournamentTeamMember.findFirst({
      where: {
        team: { tournamentId: tournament.id },
        playerId: player.id,
        status: { not: "REJECTED" }
      }
    })

    if (existingMembership) {
      return NextResponse.json({ error: "Ya estás en un equipo en este torneo" }, { status: 400 })
    }

    // Verificar tag único en el torneo
    const tagExists = await prisma.tournamentTeam.findFirst({
      where: { tournamentId: tournament.id, tag: tag.trim().toUpperCase() }
    })

    if (tagExists) {
      return NextResponse.json({ error: "Ese tag ya está en uso en este torneo" }, { status: 400 })
    }

    // Crear equipo + capitán como miembro ACCEPTED
    const team = await prisma.tournamentTeam.create({
      data: {
        tournamentId: tournament.id,
        name: name.trim(),
        tag: tag.trim().toUpperCase(),
        captainId: player.id,
        members: {
          create: {
            playerId: player.id,
            role: "titular",
            status: "ACCEPTED",
            joinedAt: new Date()
          }
        }
      },
      include: {
        captain: { select: { id: true, username: true, steamId: true, avatar: true } },
        members: {
          include: {
            player: { select: { id: true, username: true, steamId: true, avatar: true } }
          }
        }
      }
    })

    return NextResponse.json({ success: true, team }, { status: 201 })
  } catch (error) {
    console.error("Error creating team:", error)
    return NextResponse.json({ error: "Error al crear equipo" }, { status: 500 })
  }
}
