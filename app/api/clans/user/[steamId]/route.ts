import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/clans/user/[steamId]
 * 
 * Obtiene los clanes a los que pertenece un usuario
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ steamId: string }> }
) {
  try {
    const { steamId } = await params

    const player = await prisma.player.findUnique({
      where: { steamId }
    })

    if (!player) {
      return NextResponse.json({ clans: [] })
    }

    const clanMemberships = await prisma.clanMember.findMany({
      where: {
        playerId: player.id
      },
      include: {
        Clan: {
          select: {
            id: true,
            tag: true,
            slug: true,
            name: true,
            avatarUrl: true
          }
        }
      }
    })

    const clans = clanMemberships.map(cm => cm.Clan)

    return NextResponse.json({
      success: true,
      clans
    })
  } catch (error) {
    console.error('[API] Error fetching user clans:', error)
    return NextResponse.json(
      { error: 'Error al obtener clanes' },
      { status: 500 }
    )
  }
}
