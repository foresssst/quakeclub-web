import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { PICKBAN_FORMATS } from "@/lib/pickban"

// GET - Obtener map pool del torneo
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const tournament = await prisma.tournament.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true, pickBanFormat: true },
    })
    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 })
    }

    const maps = await prisma.tournamentMapPool.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { order: "asc" },
    })

    return NextResponse.json({
      maps,
      pickBanFormat: tournament.pickBanFormat,
      formats: Object.values(PICKBAN_FORMATS),
    })
  } catch (error) {
    console.error("Error fetching map pool:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

// PUT - Actualizar map pool y formato
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    const body = await request.json()
    const { maps, pickBanFormat } = body as {
      maps: string[]
      pickBanFormat?: string
    }

    if (!maps || !Array.isArray(maps) || maps.length === 0) {
      return NextResponse.json({ error: "Se requiere al menos 1 mapa" }, { status: 400 })
    }

    const tournament = await prisma.tournament.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    })
    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 })
    }

    // Validate format if provided
    if (pickBanFormat && !PICKBAN_FORMATS[pickBanFormat]) {
      return NextResponse.json({ error: `Formato inválido: ${pickBanFormat}` }, { status: 400 })
    }

    // Validate pool size vs format
    if (pickBanFormat) {
      const fmt = PICKBAN_FORMATS[pickBanFormat]
      if (maps.length < fmt.poolSize) {
        return NextResponse.json({
          error: `${fmt.name} requiere al menos ${fmt.poolSize} mapas en el pool`,
        }, { status: 400 })
      }
    }

    // Replace entire map pool in a transaction
    await prisma.$transaction([
      prisma.tournamentMapPool.deleteMany({
        where: { tournamentId: tournament.id },
      }),
      ...maps.map((mapName: string, index: number) =>
        prisma.tournamentMapPool.create({
          data: {
            tournamentId: tournament.id,
            mapName: mapName.toLowerCase(),
            order: index,
          },
        })
      ),
      prisma.tournament.update({
        where: { id: tournament.id },
        data: { pickBanFormat: pickBanFormat || null },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating map pool:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
