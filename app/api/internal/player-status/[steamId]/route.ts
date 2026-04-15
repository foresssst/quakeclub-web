import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getWarnStrikes } from "@/lib/redis"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ steamId: string }> }
) {
    const apiKey = request.headers.get("x-api-key")
    if (apiKey !== process.env.MINQLX_API_KEY) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { steamId } = await params

    try {
        const player = await prisma.player.findUnique({
            where: { steamId },
            select: {
                isBanned: true,
                isSuspended: true,
                banReason: true,
                suspendReason: true,
                banExpiresAt: true,
            },
        })

        if (!player) {
            return NextResponse.json({ isBanned: false, isSuspended: false, warnStrikes: 0 })
        }

        const now = new Date()

        if (player.isBanned && player.banExpiresAt && player.banExpiresAt <= now) {
            await prisma.player.update({
                where: { steamId },
                data: { isBanned: false, banReason: null, banExpiresAt: null },
            })
        }

        const isBannedActive = player.isBanned && (!player.banExpiresAt || player.banExpiresAt > now)
        const warnStrikes = await getWarnStrikes(steamId).catch(() => 0)

        return NextResponse.json({
            isBanned: isBannedActive,
            banReason: player.banReason,
            banExpiresAt: player.banExpiresAt?.toISOString() ?? null,
            isSuspended: player.isSuspended,
            suspendReason: player.suspendReason,
            warnStrikes,
        })
    } catch (e) {
        console.error("[player-status] Error:", e)
        return NextResponse.json({ error: "Internal error" }, { status: 500 })
    }
}
