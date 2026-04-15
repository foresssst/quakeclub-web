import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// GET: Fetch players not in any clan
export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const players = await prisma.player.findMany({
      where: {
        ClanMember: {
          none: {},
        },
        isBanned: false,
      },
      select: {
        id: true,
        steamId: true,
        username: true,
        avatar: true,
      },
      orderBy: { username: 'asc' },
    })

    return NextResponse.json({ players })
  } catch (error) {
    console.error('Error fetching available players:', error)
    return NextResponse.json(
      { error: 'Error al obtener jugadores' },
      { status: 500 }
    )
  }
}
