import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/admin/users
 *
 * List players with search, filters, and pagination.
 * Query params:
 *   - search: string (username or steamId)
 *   - filter: "all" | "banned" | "suspended" | "admin"
 *   - page: number (default 1)
 *   - limit: number (default 50)
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getSession()
        if (!session?.user?.isAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const search = searchParams.get("search") || ""
        const filter = searchParams.get("filter") || "all"
        const page = parseInt(searchParams.get("page") || "1")
        const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
        const skip = (page - 1) * limit

        // Build where clause
        const where: any = {}

        if (search) {
            where.OR = [
                { username: { contains: search, mode: "insensitive" } },
                { steamId: { contains: search } },
            ]
        }

        switch (filter) {
            case "banned":
                where.isBanned = true
                break
            case "suspended":
                where.isSuspended = true
                break
            case "admin":
                where.roles = { has: "admin" }
                break
        }

        // Get players with related data
        const [players, total] = await Promise.all([
            prisma.player.findMany({
                where,
                select: {
                    id: true,
                    steamId: true,
                    username: true,
                    avatar: true,
                    roles: true,
                    isBanned: true,
                    isSuspended: true,
                    banReason: true,
                    suspendReason: true,
                    bannedAt: true,
                    banExpiresAt: true,
                    lastSeen: true,
                    createdAt: true,
                    ClanMember: {
                        select: {
                            Clan: {
                                select: {
                                    tag: true,
                                    name: true,
                                    slug: true,
                                }
                            }
                        },
                        take: 1,
                    },
                },
                orderBy: [
                    { isBanned: "desc" },
                    { isSuspended: "desc" },
                    { lastSeen: "desc" },
                ],
                skip,
                take: limit,
            }),
            prisma.player.count({ where }),
        ])

        // Get stats
        const [totalPlayers, bannedCount, suspendedCount, adminCount] = await Promise.all([
            prisma.player.count(),
            prisma.player.count({ where: { isBanned: true } }),
            prisma.player.count({ where: { isSuspended: true } }),
            prisma.player.count({ where: { roles: { has: "admin" } } }),
        ])

        // Format response
        const formattedPlayers = players.map(p => ({
            id: p.id,
            steamId: p.steamId,
            username: p.username,
            avatar: p.avatar,
            roles: p.roles,
            isBanned: p.isBanned,
            isSuspended: p.isSuspended,
            banReason: p.banReason,
            suspendReason: p.suspendReason,
            bannedAt: p.bannedAt,
            banExpiresAt: p.banExpiresAt,
            lastSeen: p.lastSeen,
            createdAt: p.createdAt,
            clan: p.ClanMember[0]?.Clan || null,
        }))

        return NextResponse.json({
            players: formattedPlayers,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
            stats: {
                total: totalPlayers,
                banned: bannedCount,
                suspended: suspendedCount,
                admins: adminCount,
            },
        })
    } catch (error) {
        console.error("[Admin Users API] Error:", error)
        return NextResponse.json({ error: "Internal error" }, { status: 500 })
    }
}
