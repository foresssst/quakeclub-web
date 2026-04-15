import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"


export async function POST(request: NextRequest, { params }: { params: Promise<{ tag: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user.steamId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { tag } = await params
    const body = await request.json()
    const { playerSteamId } = body

    if (!playerSteamId) {
      return NextResponse.json({ error: "Steam ID requerido" }, { status: 400 })
    }

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

    // Check if player exists
    const player = await prisma.player.findUnique({
      where: { steamId: playerSteamId },
    })

    if (!player) {
      return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 })
    }

    // Check if player is already in a clan
    const existingMembership = await prisma.clanMember.findFirst({
      where: { playerId: player.id },
    })

    if (existingMembership) {
      return NextResponse.json({ error: "El jugador ya está en un clan" }, { status: 400 })
    }

    // Check if there's already a pending invitation
    const existingInvitation = await prisma.clanInvitation.findFirst({
      where: {
        clanId: clan.id,
        inviteeId: player.id,
        status: "PENDING",
      },
    })

    if (existingInvitation) {
      return NextResponse.json({ error: "Ya existe una invitación pendiente para este jugador" }, { status: 400 })
    }

    // Create invitation and notification in a transaction
    const invitationId = `invitation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const [invitation] = await prisma.$transaction([
      // Create invitation
      prisma.clanInvitation.create({
        data: {
          id: invitationId,
          clanId: clan.id,
          inviterId: adminPlayer.id,
          inviteeId: player.id,
          status: "PENDING",
        },
      }),
      // Create notification for invitee
      prisma.notification.create({
        data: {
          id: notificationId,
          userId: player.id,
          type: 'CLAN_INVITE',
          title: `Invitación de [${clan.tag}]`,
          message: `${adminPlayer.username} te ha invitado a unirte al clan ${clan.name}`,
          link: '/clanes/invitaciones',
          metadata: {
            invitationId: invitationId,
            clanId: clan.id,
            clanTag: clan.tag,
            clanName: clan.name,
            inviterUsername: adminPlayer.username,
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Invitación enviada correctamente. El jugador la verá en su bandeja de entrada.",
      invitation
    })
  } catch (error) {
    console.error("Error adding member:", error)
    return NextResponse.json({ error: "Error al agregar miembro" }, { status: 500 })
  }
}
