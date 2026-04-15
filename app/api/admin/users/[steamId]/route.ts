import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditAsync } from "@/lib/audit"
import {
    applyPermaban,
    removePermaban,
    applyTempBan,
    clearTempBans,
    applyWarn,
    clearWarnings,
    getWarnStrikes,
    applySilence,
    clearSilences,
    applyBanvote,
    removeBanvote,
    isBanvoted,
    publishAction,
} from "@/lib/redis"

/**
 * GET /api/admin/users/[steamId]
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ steamId: string }> }
) {
    try {
        const session = await getSession()
        if (!session?.user?.isAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { steamId } = await params

        const player = await prisma.player.findUnique({
            where: { steamId },
            include: {
                ClanMember: {
                    include: {
                        Clan: {
                            select: {
                                id: true,
                                tag: true,
                                name: true,
                                slug: true,
                                avatarUrl: true,
                            }
                        }
                    }
                },
                PlayerRating: {
                    where: { ratingType: "public" },
                    orderBy: { totalGames: "desc" },
                    take: 5,
                },
                AccountAction: {
                    orderBy: { createdAt: "desc" },
                    take: 50,
                },
            },
        })

        if (!player) {
            return NextResponse.json({ error: "Player not found" }, { status: 404 })
        }

        const matchCount = await prisma.playerMatchStats.count({
            where: { steamId },
        })

        // Get Redis status
        const [warnStrikes, banvoted] = await Promise.all([
            getWarnStrikes(steamId),
            isBanvoted(steamId),
        ])

        return NextResponse.json({
            player: {
                id: player.id,
                steamId: player.steamId,
                username: player.username,
                avatar: player.avatar,
                roles: player.roles,
                isBanned: player.isBanned,
                isSuspended: player.isSuspended,
                banReason: player.banReason,
                suspendReason: player.suspendReason,
                bannedAt: player.bannedAt,
                bannedBy: player.bannedBy,
                banExpiresAt: player.banExpiresAt,
                lastSeen: player.lastSeen,
                createdAt: player.createdAt,
                clan: player.ClanMember[0]?.Clan || null,
                ratings: player.PlayerRating.map(r => ({
                    gameType: r.gameType,
                    rating: Math.round(r.rating),
                    games: r.totalGames,
                })),
                matchCount,
                // Redis status
                warnStrikes,
                banvoted,
            },
            history: player.AccountAction.map(a => ({
                id: a.id,
                type: a.type,
                reason: a.reason,
                details: a.details,
                duration: a.duration,
                actorId: a.actorId,
                actorName: a.actorName,
                createdAt: a.createdAt,
            })),
        })
    } catch (error) {
        console.error("[Admin User Detail API] Error:", error)
        return NextResponse.json({ error: "Internal error" }, { status: 500 })
    }
}

/**
 * PATCH /api/admin/users/[steamId]
 *
 * Actions: ban, unban, warn, unwarn, silence, unsilence, banvote, unbanvote, add_note, update_roles
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ steamId: string }> }
) {
    try {
        // Accept session auth (web panel) or API key auth (game servers)
        const apiKey = request.headers.get("x-api-key")
        const isGameServer = apiKey === process.env.MINQLX_API_KEY

        let session = null
        if (!isGameServer) {
            session = await getSession()
            if (!session?.user?.isAdmin) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
            }
        }

        const { steamId } = await params
        const body = await request.json()
        const { action, reason, duration, details, roles, actorSteamId, actorName: bodyActorName } = body

        const player = await prisma.player.findUnique({
            where: { steamId },
        })

        if (!player) {
            return NextResponse.json({ error: "Player not found" }, { status: 404 })
        }

        const actorId = isGameServer ? (actorSteamId || "game_server") : (session?.user?.steamId || "")
        const actorName = isGameServer ? (bodyActorName || "Game Server") : (session?.user?.username || "Admin")


        switch (action) {
            // ============================================================
            // BAN - Cannot connect to servers
            // ============================================================
            case "ban": {
                const banExpiresAt = duration
                    ? new Date(Date.now() + duration * 1000)
                    : null

                await prisma.$transaction([
                    prisma.player.update({
                        where: { steamId },
                        data: {
                            isBanned: true,
                            isSuspended: false,
                            banReason: reason || "Sin razón especificada",
                            suspendReason: null,
                            bannedAt: new Date(),
                            bannedBy: actorId,
                            banExpiresAt,
                        },
                    }),
                    prisma.accountAction.create({
                        data: {
                            steamId,
                            type: duration ? "ban" : "permaban",
                            reason: reason || "Sin razón especificada",
                            details: duration ? `Duración: ${duration}s` : "Permanente",
                            duration: duration || null,
                            actorId,
                            actorName,
                        },
                    }),
                ])

                // Sync to Redis
                if (duration) {
                    await applyTempBan(steamId, duration, reason || "Baneado desde panel web", actorId)
                } else {
                    await applyPermaban(steamId)
                }

                logAuditAsync({ category: "ADMIN", action: duration ? "TEMP_BAN" : "PERMABAN", targetType: "player", targetId: steamId, targetName: player.username, details: { reason, duration } }, session, request)
                publishAction({ action: duration ? "ban" : "permaban", steamId, reason: reason || "Sin razón", duration: duration || undefined, actorName })
                return NextResponse.json({ success: true, message: duration ? "Ban temporal aplicado" : "Permaban aplicado" })
            }

            case "unban": {
                await prisma.$transaction([
                    prisma.player.update({
                        where: { steamId },
                        data: {
                            isBanned: false,
                            banReason: null,
                            bannedAt: null,
                            bannedBy: null,
                            banExpiresAt: null,
                        },
                    }),
                    prisma.accountAction.create({
                        data: {
                            steamId,
                            type: "unban",
                            reason: reason || "Desbaneado",
                            actorId,
                            actorName,
                        },
                    }),
                ])

                await clearTempBans(steamId)
                await removePermaban(steamId)

                logAuditAsync({ category: "ADMIN", action: "UNBAN", targetType: "player", targetId: steamId, targetName: player.username, details: { reason } }, session, request)
                publishAction({ action: "unban", steamId, reason: reason || "Desbaneado", actorName })
                publishAction({ action: "unpermaban", steamId, actorName })
                return NextResponse.json({ success: true, message: "Usuario desbaneado" })
            }

            // ============================================================
            // WARN - Warning with strikes (3 strikes = auto-ban)
            // ============================================================
            case "warn": {
                const warnDuration = duration || 86400 // Default 1 day

                await prisma.accountAction.create({
                    data: {
                        steamId,
                        type: "warn",
                        reason: reason || "Advertencia",
                        details,
                        duration: warnDuration,
                        actorId,
                        actorName,
                    },
                })

                const strikes = await applyWarn(steamId, warnDuration, reason || "Advertencia", actorId)

                logAuditAsync({ category: "ADMIN", action: "WARN", targetType: "player", targetId: steamId, targetName: player.username, details: { reason, strikes, duration: warnDuration } }, session, request)
                publishAction({ action: "warn", steamId, reason: reason || "Advertencia", duration: warnDuration, actorName })
                return NextResponse.json({
                    success: true,
                    message: `Advertencia aplicada (${strikes}/3 strikes)`,
                    strikes,
                })
            }

            case "unwarn": {
                await prisma.accountAction.create({
                    data: {
                        steamId,
                        type: "unwarn",
                        reason: reason || "Advertencias removidas",
                        actorId,
                        actorName,
                    },
                })

                await clearWarnings(steamId)

                logAuditAsync({ category: "ADMIN", action: "UNWARN", targetType: "player", targetId: steamId, targetName: player.username }, session, request)
                publishAction({ action: "unwarn", steamId, actorName })
                return NextResponse.json({ success: true, message: "Advertencias removidas" })
            }

            // ============================================================
            // SILENCE - Cannot chat
            // ============================================================
            case "silence": {
                const silenceDuration = duration || 3600 // Default 1 hour

                await prisma.$transaction([
                    prisma.player.update({
                        where: { steamId },
                        data: {
                            isSuspended: true,
                            suspendReason: reason || "Silenciado",
                        },
                    }),
                    prisma.accountAction.create({
                        data: {
                            steamId,
                            type: "silence",
                            reason: reason || "Silenciado",
                            details,
                            duration: silenceDuration,
                            actorId,
                            actorName,
                        },
                    }),
                ])

                await applySilence(steamId, silenceDuration, reason || "Silenciado desde panel web", actorId)

                logAuditAsync({ category: "ADMIN", action: "SILENCE", targetType: "player", targetId: steamId, targetName: player.username, details: { reason, duration: silenceDuration } }, session, request)
                publishAction({ action: "silence", steamId, reason: reason || "Silenciado", duration: silenceDuration, actorName })
                return NextResponse.json({ success: true, message: "Usuario silenciado" })
            }

            case "unsilence": {
                await prisma.$transaction([
                    prisma.player.update({
                        where: { steamId },
                        data: {
                            isSuspended: false,
                            suspendReason: null,
                        },
                    }),
                    prisma.accountAction.create({
                        data: {
                            steamId,
                            type: "unsilence",
                            reason: reason || "Silencio removido",
                            actorId,
                            actorName,
                        },
                    }),
                ])

                await clearSilences(steamId)

                logAuditAsync({ category: "ADMIN", action: "UNSILENCE", targetType: "player", targetId: steamId, targetName: player.username }, session, request)
                publishAction({ action: "unsilence", steamId, actorName })
                return NextResponse.json({ success: true, message: "Silencio removido" })
            }

            // ============================================================
            // BANVOTE - Cannot call votes
            // ============================================================
            case "banvote": {
                await prisma.accountAction.create({
                    data: {
                        steamId,
                        type: "banvote",
                        reason: reason || "Prohibido votar",
                        actorId,
                        actorName,
                    },
                })

                await applyBanvote(steamId)

                logAuditAsync({ category: "ADMIN", action: "BANVOTE", targetType: "player", targetId: steamId, targetName: player.username, details: { reason } }, session, request)
                publishAction({ action: "banvote", steamId, reason: reason || "Prohibido votar", actorName })
                return NextResponse.json({ success: true, message: "Usuario no puede votar" })
            }

            case "unbanvote": {
                await prisma.accountAction.create({
                    data: {
                        steamId,
                        type: "unbanvote",
                        reason: reason || "Puede votar de nuevo",
                        actorId,
                        actorName,
                    },
                })

                await removeBanvote(steamId)

                logAuditAsync({ category: "ADMIN", action: "UNBANVOTE", targetType: "player", targetId: steamId, targetName: player.username }, session, request)
                publishAction({ action: "unbanvote", steamId, actorName })
                return NextResponse.json({ success: true, message: "Usuario puede votar de nuevo" })
            }

            // ============================================================
            // OTHER ACTIONS
            // ============================================================
            case "add_note": {
                await prisma.accountAction.create({
                    data: {
                        steamId,
                        type: "note",
                        reason: reason || "",
                        details,
                        actorId,
                        actorName,
                    },
                })

                logAuditAsync({ category: "ADMIN", action: "ADD_NOTE", targetType: "player", targetId: steamId, targetName: player.username, details: { reason, details } }, session, request)
                return NextResponse.json({ success: true, message: "Nota agregada" })
            }

            case "update_roles": {
                const oldRoles = player.roles.join(", ") || "ninguno"
                const newRoles = (roles || []).join(", ") || "ninguno"

                await prisma.$transaction([
                    prisma.player.update({
                        where: { steamId },
                        data: {
                            roles: roles || [],
                        },
                    }),
                    prisma.accountAction.create({
                        data: {
                            steamId,
                            type: "role_change",
                            reason: `Roles: ${oldRoles} → ${newRoles}`,
                            actorId,
                            actorName,
                        },
                    }),
                ])

                logAuditAsync({ category: "ADMIN", action: "UPDATE_ROLES", targetType: "player", targetId: steamId, targetName: player.username, details: { oldRoles, newRoles, roles } }, session, request)
                return NextResponse.json({ success: true, message: "Roles actualizados" })
            }

            default:
                return NextResponse.json({ error: "Invalid action" }, { status: 400 })
        }
    } catch (error) {
        console.error("[Admin User Action API] Error:", error)
        return NextResponse.json({ error: "Internal error" }, { status: 500 })
    }
}
