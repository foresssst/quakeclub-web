import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/players/linked-accounts?steamId=xxx - Get confirmed linked accounts for a player
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const steamId = searchParams.get('steamId')

    if (!steamId) {
        return NextResponse.json({ error: 'steamId requerido' }, { status: 400 })
    }

    // Find all confirmed groups this player belongs to
    const linkedAccounts = await prisma.linkedAccount.findMany({
        where: {
            steamId,
            group: { status: 'confirmed' }
        },
        include: {
            group: {
                include: {
                    accounts: {
                        where: { steamId: { not: steamId } },
                        include: {
                            player: {
                                select: {
                                    id: true,
                                    steamId: true,
                                    username: true,
                                    avatar: true,
                                }
                            }
                        }
                    }
                }
            }
        }
    })

    // Flatten linked accounts from all groups
    const linked = linkedAccounts.flatMap(la =>
        la.group.accounts.map(a => ({
            steamId: a.steamId,
            isPrimary: a.isPrimary,
            player: a.player,
        }))
    )

    // Determine if this player is the primary in any group
    const isPrimary = linkedAccounts.some(la => la.isPrimary)

    return NextResponse.json({ linked, isPrimary })
}
