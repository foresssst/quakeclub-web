import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { generateClanSlug } from "@/lib/slug"


export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const steamId = session.user.steamId

    if (!steamId) {
      return NextResponse.json({ error: "Se requiere Steam ID" }, { status: 400 })
    }

    // Obtener datos del request
    const body = await request.json()
    const { name, tag, description } = body

    // Validaciones
    if (!name || name.trim().length < 1) {
      return NextResponse.json({ error: "El nombre del clan debe tener al menos 1 carácter" }, { status: 400 })
    }

    if (!tag || tag.trim().length < 1 || tag.trim().length > 6) {
      return NextResponse.json({ error: "El tag debe tener entre 1 y 6 caracteres" }, { status: 400 })
    }

    // Verificar que el jugador existe y obtener su ID
    // Si no existe, crearlo (puede ser un usuario que aún no ha jugado partidas)
    let player = await prisma.player.findUnique({
      where: { steamId },
    })

    if (!player) {
      // Crear el jugador en la base de datos
      const playerId = `player_${steamId}_${Date.now()}`
      player = await prisma.player.create({
        data: {
          id: playerId,
          steamId: steamId,
          username: session.user.username || "Unknown",
          updatedAt: new Date(),
        },
      })
    }

    // Verificar que el jugador no está en otro clan
    const existingMembership = await prisma.clanMember.findFirst({
      where: { playerId: player.id },
    })

    if (existingMembership) {
      return NextResponse.json(
        { error: "Ya perteneces a un clan. Debes salir o que te expulsen, cualquiera de las 2." },
        { status: 400 },
      )
    }

    // Verificar que el nombre del clan no existe
    const existingClanByName = await prisma.clan.findUnique({
      where: { name: name.trim() },
    })

    if (existingClanByName) {
      return NextResponse.json({ error: "Ya existe un clan con ese nombre" }, { status: 400 })
    }

    // Verificar que el tag no existe
    const existingClanByTag = await prisma.clan.findUnique({
      where: { tag: tag.trim().toUpperCase() },
    })

    if (existingClanByTag) {
      return NextResponse.json({ error: "Ya existe un clan con ese tag" }, { status: 400 })
    }

    // Obtener el ELO del jugador
    const playerRating = await prisma.playerRating.findFirst({
      where: { steamId: steamId },
    })

    const playerElo = playerRating?.rating || 900.0

    // Generar IDs
    const clanId = `clan_${Date.now()}`
    const memberId = `member_${Date.now()}`

    // Generar slug único
    const baseSlug = generateClanSlug(name.trim())
    let slug = baseSlug
    let counter = 1
    while (await prisma.clan.findUnique({ where: { slug } })) {
      slug = `${baseSlug}_${counter}`
      counter++
    }

    // Crear el clan
    const clan = await prisma.clan.create({
      data: {
        id: clanId,
        name: name.trim(),
        tag: tag.trim().toUpperCase(),
        slug: slug,
        description: description?.trim() || null,
        founderId: player.id,
        averageElo: playerElo, // El ELO inicial es el del fundador
        updatedAt: new Date(),
        ClanMember: {
          create: {
            id: memberId,
            playerId: player.id,
            steamId: steamId,
            role: "FOUNDER", // El creador es automáticamente FOUNDER
          },
        },
      },
      include: {
        ClanMember: {
          include: {
            Player: {
              select: {
                steamId: true,
                username: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      clan: {
        id: clan.id,
        name: clan.name,
        tag: clan.tag,
        slug: clan.slug, // Return slug for redirect
        description: clan.description,
        averageElo: clan.averageElo,
        createdAt: clan.createdAt,
        members: clan.ClanMember.map((m: any) => ({
          steamId: m.Player.steamId,
          username: m.Player.username,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
      },
    })
  } catch (error) {
    console.error("Error creating clan:", error)
    return NextResponse.json({ error: "Error al crear el clan" }, { status: 500 })
  }
}
