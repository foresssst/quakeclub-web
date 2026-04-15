import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

interface RouteParams {
  params: Promise<{
    steamId: string
  }>
}

/**
 * Endpoint para obtener el clan tag de un jugador (usado por minqlx clan.py)
 * GET /api/players/[steamId]/clan
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { steamId } = await params

    const membership = await prisma.clanMember.findFirst({
      where: { steamId },
      include: {
        Clan: {
          select: {
            id: true,
            name: true,
            tag: true,
            inGameTag: true,
          },
        },
      },
    })

    if (!membership) {
      return NextResponse.json({
        steamId,
        clanId: null,
        clanName: null,
        inGameTag: null,
        role: null,
      })
    }

    // Usar inGameTag si está definido, sino usar tag normal
    const inGameTag = membership.Clan.inGameTag || membership.Clan.tag

    return NextResponse.json({
      steamId,
      clanId: membership.Clan.id,
      clanName: membership.Clan.name,
      inGameTag,
      role: membership.role,
    })
  } catch (error) {
    console.error("[Player Clan API] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch player clan" },
      { status: 500 }
    )
  }
}
