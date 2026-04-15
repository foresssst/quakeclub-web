import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"


export async function GET() {
    try {
        const session = await getSession()

        if (!session) {
            return NextResponse.json({ count: 0, notifications: [] })
        }

        // Admin users without steamId don't have notifications
        if (!session.user.steamId || session.user.steamId === "") {
            return NextResponse.json({ count: 0, notifications: [] })
        }

        // Get player ID from steamId
        const player = await prisma.player.findUnique({
            where: { steamId: session.user.steamId },
            select: { id: true }
        })

        if (!player) {
            return NextResponse.json({ count: 0, notifications: [] })
        }

        // Clean orphan CLAN_REQUEST notifications (requests that no longer exist)
        const clanRequestNotifications = await prisma.notification.findMany({
            where: {
                userId: player.id,
                type: 'CLAN_REQUEST',
                isRead: false,
            },
            select: { id: true, metadata: true }
        })

        const orphanIds: string[] = []
        for (const notif of clanRequestNotifications) {
            const metadata = notif.metadata as { requestId?: string } | null
            if (metadata?.requestId) {
                const requestExists = await prisma.clanJoinRequest.findUnique({
                    where: { id: metadata.requestId },
                    select: { id: true }
                })
                if (!requestExists) {
                    orphanIds.push(notif.id)
                }
            }
        }

        // Delete orphan notifications
        if (orphanIds.length > 0) {
            await prisma.notification.deleteMany({
                where: { id: { in: orphanIds } }
            })
        }

        // Get unread notifications (after cleanup)
        const notifications = await prisma.notification.findMany({
            where: {
                userId: player.id,
                isRead: false,
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 10,
        })

        return NextResponse.json({
            count: notifications.length,
            notifications: notifications.map(n => ({
                id: n.id,
                type: n.type,
                title: n.title,
                message: n.message,
                link: n.link,
                createdAt: n.createdAt,
            }))
        })
    } catch (error) {
        console.error('Error fetching notifications:', error)
        return NextResponse.json({ count: 0, notifications: [] })
    }
}
