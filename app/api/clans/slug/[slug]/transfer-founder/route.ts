import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user.steamId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { slug } = await params
    const body = await request.json()
    const { newFounderId } = body

    if (!newFounderId) {
      return NextResponse.json({ error: "Debes especificar el nuevo fundador" }, { status: 400 })
    }

    // Get clan
    const clan = await prisma.clan.findUnique({
      where: { slug },
    })

    if (!clan) {
      return NextResponse.json({ error: "Clan no encontrado" }, { status: 404 })
    }

    // Get current player
    const currentPlayer = await prisma.player.findUnique({
      where: { steamId: session.user.steamId },
    })

    if (!currentPlayer) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }

    // Check if current user is the founder
    const currentMembership = await prisma.clanMember.findFirst({
      where: {
        clanId: clan.id,
        playerId: currentPlayer.id,
      },
    })

    if (!currentMembership || currentMembership.role !== "FOUNDER") {
      return NextResponse.json({ error: "Solo el fundador puede transferir el rol" }, { status: 403 })
    }

    // Get the new founder's membership
    const newFounderMembership = await prisma.clanMember.findUnique({
      where: { id: newFounderId },
      include: {
        Player: true,
      },
    })

    if (!newFounderMembership || newFounderMembership.clanId !== clan.id) {
      return NextResponse.json({ error: "El jugador seleccionado no es miembro del clan" }, { status: 400 })
    }

    if (newFounderMembership.id === currentMembership.id) {
      return NextResponse.json({ error: "Ya eres el fundador" }, { status: 400 })
    }

    // Transaction: update both memberships and the clan founderId
    await prisma.$transaction([
      // Update new founder to FOUNDER role
      prisma.clanMember.update({
        where: { id: newFounderMembership.id },
        data: { role: "FOUNDER" },
      }),
      // Demote current founder to ADMIN
      prisma.clanMember.update({
        where: { id: currentMembership.id },
        data: { role: "ADMIN" },
      }),
      // Update clan's founderId
      prisma.clan.update({
        where: { id: clan.id },
        data: { founderId: newFounderMembership.playerId },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: `El rol de fundador ha sido transferido a ${newFounderMembership.Player.username}`,
    })
  } catch (error) {
    console.error("Error transferring founder:", error)
    return NextResponse.json({ error: "Error al transferir el rol de fundador" }, { status: 500 })
  }
}
