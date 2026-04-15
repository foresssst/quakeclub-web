import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"


export async function DELETE(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user.steamId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { slug } = await params

    // Get clan
    const clan = await prisma.clan.findUnique({
      where: { slug },
    })

    if (!clan) {
      return NextResponse.json({ error: "Clan no encontrado" }, { status: 404 })
    }

    // Verify user is FOUNDER
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
      return NextResponse.json({ error: "Solo el fundador puede eliminar el clan" }, { status: 403 })
    }

    // Delete all related data (cascade should handle this, but being explicit)
    await prisma.clanInvitation.deleteMany({
      where: { clanId: clan.id },
    })

    await prisma.clanMember.deleteMany({
      where: { clanId: clan.id },
    })

    await prisma.clan.delete({
      where: { id: clan.id },
    })

    return NextResponse.json({ success: true, message: "Clan eliminado correctamente" })
  } catch (error) {
    console.error("Error deleting clan:", error)
    return NextResponse.json({ error: "Error al eliminar el clan" }, { status: 500 })
  }
}
