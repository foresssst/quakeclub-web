import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { calculateClanAverageElo } from "@/lib/clan-elo"

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
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

    // Get current player
    const player = await prisma.player.findUnique({
      where: { steamId: session.user.steamId },
    })

    if (!player) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }

    // Check if user is a member of this clan
    const membership = await prisma.clanMember.findFirst({
      where: {
        clanId: clan.id,
        playerId: player.id,
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "No eres miembro de este clan" }, { status: 400 })
    }

    // Founders cannot leave - they must transfer ownership first
    if (membership.role === "FOUNDER") {
      return NextResponse.json(
        { error: "El fundador no puede abandonar el clan. Debes transferir el rol de fundador primero." },
        { status: 400 }
      )
    }

    // Delete the membership
    await prisma.clanMember.delete({
      where: { id: membership.id },
    })

    // Delete any pending join requests from this player for this clan
    await prisma.clanJoinRequest.deleteMany({
      where: {
        playerId: player.id,
        clanId: clan.id,
      },
    })

    // Update clan average ELO
    const remainingMembers = await prisma.clanMember.findMany({
      where: { clanId: clan.id },
      include: {
        Player: {
          include: {
            PlayerRating: { where: { ratingType: 'public' } },
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

    return NextResponse.json({ success: true, message: "Has abandonado el clan correctamente" })
  } catch (error) {
    console.error("Error leaving clan:", error)
    return NextResponse.json({ error: "Error al abandonar el clan" }, { status: 500 })
  }
}
