import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { calculateClanAverageElo } from "@/lib/clan-elo"


export async function DELETE(request: NextRequest, { params }: { params: Promise<{ tag: string; memberId: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user.steamId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { tag, memberId } = await params

    // Get clan
    const clan = await prisma.clan.findUnique({
      where: { tag: tag.toUpperCase() },
    })

    if (!clan) {
      return NextResponse.json({ error: "Clan no encontrado" }, { status: 404 })
    }

    // Verify user is FOUNDER or ADMIN
    const adminPlayer = await prisma.player.findUnique({
      where: { steamId: session.user.steamId },
    })

    if (!adminPlayer) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }

    const adminMembership = await prisma.clanMember.findFirst({
      where: {
        clanId: clan.id,
        playerId: adminPlayer.id,
      },
    })

    if (!adminMembership || (adminMembership.role !== "FOUNDER" && adminMembership.role !== "ADMIN")) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 })
    }

    // Get member to remove
    const member = await prisma.clanMember.findUnique({
      where: { id: memberId },
    })

    if (!member || member.clanId !== clan.id) {
      return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 })
    }

    // Cannot remove founder
    if (member.role === "FOUNDER") {
      return NextResponse.json({ error: "No puedes eliminar al fundador" }, { status: 400 })
    }

    // Solo el FOUNDER puede eliminar ADMIN (prevenir abuso de privilegios)
    if (member.role === "ADMIN" && adminMembership.role !== "FOUNDER") {
      return NextResponse.json(
        { error: "Solo el fundador puede eliminar administradores" },
        { status: 403 }
      )
    }

    // Delete member
    await prisma.clanMember.delete({
      where: { id: memberId },
    })

    // Delete any pending join requests from this player for this clan
    await prisma.clanJoinRequest.deleteMany({
      where: {
        playerId: member.playerId,
        clanId: clan.id,
      },
    })

    // Update clan average ELO
    const remainingMembers = await prisma.clanMember.findMany({
      where: { clanId: clan.id },
      include: {
        Player: {
          include: {
            PlayerRating: { where: { ratingType: 'public' } }, // Solo ratings públicos
          },
        },
      },
    })

    if (remainingMembers.length > 0) {
      const eloResult = await calculateClanAverageElo(clan.id)
      await prisma.clan.update({
        where: { id: clan.id },
        data: { averageElo: eloResult.averageElo, totalGames: eloResult.totalGames, totalWins: eloResult.totalWins, updatedAt: new Date() },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error removing member:", error)
    return NextResponse.json({ error: "Error al eliminar miembro" }, { status: 500 })
  }
}
