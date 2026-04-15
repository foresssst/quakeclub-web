import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ steamId: string }> }
) {
    const apiKey = request.headers.get("x-api-key")
    if (apiKey !== process.env.MINQLX_API_KEY) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { steamId } = await params
    const now = new Date()

    const activeQuits = await prisma.quitRecord.count({
        where: { steamId: String(steamId), expiresAt: { gt: now } },
    })

    const nextExpiry = await prisma.quitRecord.findFirst({
        where: { steamId: String(steamId), expiresAt: { gt: now } },
        orderBy: { expiresAt: "asc" },
        select: { expiresAt: true },
    })

    return NextResponse.json({
        steamId,
        activeQuits,
        nextExpiry: nextExpiry?.expiresAt ?? null,
    })
}
