import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ steamId: string }> }
) {
    const apiKey = request.headers.get("x-api-key")
    if (apiKey !== process.env.MINQLX_API_KEY) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { steamId } = await params

    // Find confirmed linked account groups for this player
    const linkedAccounts = await prisma.linkedAccount.findMany({
        where: {
            steamId,
            group: { status: "confirmed" }
        },
        include: {
            group: {
                include: {
                    accounts: {
                        where: { steamId: { not: steamId } },
                        include: {
                            player: {
                                select: { username: true, steamId: true }
                            }
                        }
                    }
                }
            }
        }
    })

    if (linkedAccounts.length === 0) {
        return NextResponse.json({ linked: [], isPrimary: true })
    }

    const linked = linkedAccounts.flatMap(la =>
        la.group.accounts.map(a => ({
            steamId: a.steamId,
            username: a.player?.username || null,
            isPrimary: a.isPrimary,
        }))
    )

    const isPrimary = linkedAccounts.some(la => la.isPrimary)

    return NextResponse.json({ linked, isPrimary })
}
