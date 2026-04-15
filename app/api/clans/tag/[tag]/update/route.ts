import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"


export async function PATCH(request: NextRequest, { params }: { params: Promise<{ tag: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user.steamId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { tag } = await params
    const body = await request.json()
    const { name, newTag, description, inGameTag } = body

    // Get clan
    const clan = await prisma.clan.findUnique({
      where: { tag: tag.toUpperCase() },
    })

    if (!clan) {
      return NextResponse.json({ error: "Clan no encontrado" }, { status: 404 })
    }

    // Verificar que el usuario es FOUNDER
    const player = await prisma.player.findUnique({
      where: { steamId: session.user.steamId },
    })

    if (!player) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }

    const membership = await prisma.clanMember.findFirst({
      where: {
        clanId: clan.id,
        playerId: player.id,
      },
    })

    if (!membership || membership.role !== "FOUNDER") {
      return NextResponse.json({ error: "Solo el fundador puede editar el clan" }, { status: 403 })
    }

    // Validar nuevos datos
    const updateData: any = {}

    if (name && name.trim().length >= 3) {
      // Verificar si el nombre está ocupado
      const existingClan = await prisma.clan.findFirst({
        where: {
          name: name.trim(),
          NOT: { id: clan.id },
        },
      })

      if (existingClan) {
        return NextResponse.json({ error: "Ese nombre ya está en uso" }, { status: 400 })
      }

      updateData.name = name.trim()
    }

    if (newTag && newTag.trim().length >= 2 && newTag.trim().length <= 5) {
      // Verificar si el tag está ocupado
      const existingClan = await prisma.clan.findFirst({
        where: {
          tag: newTag.trim().toUpperCase(),
          NOT: { id: clan.id },
        },
      })

      if (existingClan) {
        return NextResponse.json({ error: "Ese tag ya está en uso" }, { status: 400 })
      }

      updateData.tag = newTag.trim().toUpperCase()
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null
    }

    // Agregar inGameTag (el tag que se mostrará en Quake Live)
    if (inGameTag !== undefined) {
      // Permitir hasta 10 caracteres incluyendo códigos de color (^1, ^2, etc)
      const cleanTag = inGameTag?.trim() || null
      if (cleanTag && cleanTag.length > 15) {
        return NextResponse.json({ error: "El tag in-game es demasiado largo (max 15 caracteres)" }, { status: 400 })
      }
      updateData.inGameTag = cleanTag
    }

    // Update clan
    const updatedClan = await prisma.clan.update({
      where: { id: clan.id },
      data: updateData,
    })

    return NextResponse.json({ success: true, clan: updatedClan })
  } catch (error) {
    console.error("Error updating clan:", error)
    return NextResponse.json({ error: "Error al actualizar el clan" }, { status: 500 })
  }
}
