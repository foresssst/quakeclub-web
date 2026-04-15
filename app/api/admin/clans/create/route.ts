import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { generateClanSlug } from '@/lib/slug'

// POST: Crear clan como admin
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const { name, tag, description, founderSteamId } = body

    // Validaciones
    if (!name || name.trim().length < 1) {
      return NextResponse.json(
        { error: 'El nombre debe tener al menos 1 carácter' },
        { status: 400 }
      )
    }

    if (!tag || tag.trim().length < 1 || tag.trim().length > 6) {
      return NextResponse.json(
        { error: 'El tag debe tener entre 1 y 6 caracteres' },
        { status: 400 }
      )
    }

    if (!founderSteamId) {
      return NextResponse.json(
        { error: 'Steam ID del fundador requerido' },
        { status: 400 }
      )
    }

    // Verificar que el tag no exista
    const existingClan = await prisma.clan.findUnique({
      where: { tag: tag.trim().toUpperCase() },
    })

    if (existingClan) {
      return NextResponse.json(
        { error: 'Ya existe un clan con ese tag' },
        { status: 400 }
      )
    }

    // Buscar o crear el jugador fundador
    let founder = await prisma.player.findUnique({
      where: { steamId: founderSteamId },
      include: {
        PlayerRating: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!founder) {
      return NextResponse.json(
        { error: 'Jugador fundador no encontrado. Debe existir en la base de datos.' },
        { status: 404 }
      )
    }

    // Verificar que el fundador no esté en otro clan
    const existingMembership = await prisma.clanMember.findFirst({
      where: { playerId: founder.id },
    })

    if (existingMembership) {
      return NextResponse.json(
        { error: 'El jugador ya pertenece a otro clan' },
        { status: 400 }
      )
    }

    // Crear clan con fundador
    const clanId = `clan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const memberId = `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const founderElo = founder.PlayerRating[0]?.rating || 900

    // Generar slug único
    const baseSlug = generateClanSlug(name.trim())
    let slug = baseSlug
    let counter = 1
    while (await prisma.clan.findUnique({ where: { slug } })) {
      slug = `${baseSlug}_${counter}`
      counter++
    }

    const clan = await prisma.clan.create({
      data: {
        id: clanId,
        name: name.trim(),
        tag: tag.trim().toUpperCase(),
        slug: slug,
        description: description?.trim() || null,
        founderId: founder.id,
        averageElo: founderElo,
        updatedAt: new Date(),
        ClanMember: {
          create: {
            id: memberId,
            playerId: founder.id,
            steamId: founder.steamId,
            role: 'FOUNDER',
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
                avatar: true,
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
        description: clan.description,
        founder: clan.ClanMember[0].Player,
      },
      message: `Clan [${clan.tag}] ${clan.name} creado correctamente`,
    })
  } catch (error) {
    console.error('Error creating clan:', error)
    return NextResponse.json(
      { error: 'Error al crear el clan' },
      { status: 500 }
    )
  }
}
