/**
 * Redis client for syncing moderation actions with game servers.
 * The minqlx plugins use Redis to check player status on connect.
 */

import Redis from "ioredis"

let redisClient: Redis | null = null

export function getRedis(): Redis {
    if (!redisClient) {
        redisClient = new Redis({
            host: process.env.REDIS_HOST || "127.0.0.1",
            port: parseInt(process.env.REDIS_PORT || "6379"),
            maxRetriesPerRequest: 3,
        })
    }
    return redisClient
}

/**
 * Format date as "YYYY-MM-DD HH:MM:SS" (matches minqlx TIME_FORMAT)
 */
function formatDate(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

// ============================================================
// BAN (ban.py) - Temporary ban, cannot connect
// ============================================================

/**
 * Apply a temporary ban in Redis (syncs with ban.py plugin).
 */
export async function applyTempBan(
    steamId: string,
    durationSeconds: number,
    reason: string,
    actorId: string
): Promise<void> {
    const redis = getRedis()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + durationSeconds * 1000)
    const expiresTimestamp = Math.floor(expiresAt.getTime() / 1000)

    const banId = await redis.zcard(`minqlx:players:${steamId}:bans`)
    await redis.zadd(`minqlx:players:${steamId}:bans`, expiresTimestamp, banId.toString())
    await redis.hset(`minqlx:players:${steamId}:bans:${banId}`, {
        expires: formatDate(expiresAt),
        reason: reason,
        issued: formatDate(now),
        issued_by: actorId,
    })
}

/**
 * Remove temporary bans for a player.
 */
export async function clearTempBans(steamId: string): Promise<void> {
    const redis = getRedis()
    const banKeys = await redis.keys(`minqlx:players:${steamId}:bans:*`)
    const keysToDelete = [`minqlx:players:${steamId}:bans`, ...banKeys]
    if (keysToDelete.length > 0) {
        await redis.del(...keysToDelete)
    }
}

// ============================================================
// PERMABAN (permaban.py) - Permanent ban, cannot connect ever
// ============================================================

/**
 * Apply a permanent ban in Redis (syncs with permaban.py plugin).
 */
export async function applyPermaban(steamId: string): Promise<void> {
    const redis = getRedis()
    await redis.set(`minqlx:players:${steamId}:permabanned`, "1")
    await redis.sadd("minqlx:perma_banned", steamId)
}

/**
 * Remove a permanent ban from Redis.
 */
export async function removePermaban(steamId: string): Promise<void> {
    const redis = getRedis()
    await redis.del(`minqlx:players:${steamId}:permabanned`)
    await redis.srem("minqlx:perma_banned", steamId)
}

// ============================================================
// WARN (warn.py) - Warning with strikes, 3 strikes = auto-ban
// ============================================================

/**
 * Apply a warning in Redis (syncs with warn.py plugin).
 * Warnings accumulate strikes. At maxStrikes (default 3), player gets banned.
 */
export async function applyWarn(
    steamId: string,
    durationSeconds: number,
    reason: string,
    actorId: string
): Promise<number> {
    const redis = getRedis()
    const now = new Date()
    const baseKey = `minqlx:players:${steamId}:warnings`

    // Get current strikes
    const currentStrikes = parseInt(await redis.get(`${baseKey}:strikes`) || "0")

    // Check if there's an existing warn to extend
    const existingWarns = await redis.zrangebyscore(baseKey, Math.floor(Date.now() / 1000), "+inf", "WITHSCORES")
    let expiresAt: Date

    if (existingWarns.length > 0) {
        // Extend from the longest existing warn
        const longestWarn = await redis.hgetall(`${baseKey}:${existingWarns[existingWarns.length - 2]}`)
        const previousExpire = new Date(longestWarn.expires.replace(" ", "T"))
        expiresAt = new Date(previousExpire.getTime() + durationSeconds * 1000)
    } else {
        expiresAt = new Date(now.getTime() + durationSeconds * 1000)
    }

    const expiresTimestamp = Math.floor(expiresAt.getTime() / 1000)
    const warnId = await redis.zcard(baseKey)

    await redis.zadd(baseKey, expiresTimestamp, warnId.toString())
    await redis.incr(`${baseKey}:strikes`)
    await redis.hset(`${baseKey}:${warnId}`, {
        expires: formatDate(expiresAt),
        reason: reason,
        issued: formatDate(now),
        issued_by: actorId,
    })

    return currentStrikes + 1
}

/**
 * Remove warnings for a player.
 */
export async function clearWarnings(steamId: string): Promise<void> {
    const redis = getRedis()
    const baseKey = `minqlx:players:${steamId}:warnings`
    const warnKeys = await redis.keys(`${baseKey}:*`)
    const keysToDelete = [baseKey, ...warnKeys]
    if (keysToDelete.length > 0) {
        await redis.del(...keysToDelete)
    }
}

/**
 * Get current warning strikes for a player.
 */
export async function getWarnStrikes(steamId: string): Promise<number> {
    const redis = getRedis()
    return parseInt(await redis.get(`minqlx:players:${steamId}:warnings:strikes`) || "0")
}

// ============================================================
// SILENCE (silence.py) - Mute chat, can still play
// ============================================================

/**
 * Apply a silence (mute) in Redis (syncs with silence.py plugin).
 */
export async function applySilence(
    steamId: string,
    durationSeconds: number,
    reason: string,
    actorId: string
): Promise<void> {
    const redis = getRedis()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + durationSeconds * 1000)
    const expiresTimestamp = Math.floor(expiresAt.getTime() / 1000)
    const baseKey = `minqlx:players:${steamId}:silences`

    const silenceId = await redis.zcard(baseKey)
    await redis.zadd(baseKey, expiresTimestamp, silenceId.toString())
    await redis.hset(`${baseKey}:${silenceId}`, {
        expires: formatDate(expiresAt),
        reason: reason,
        issued: formatDate(now),
        issued_by: actorId,
    })
}

/**
 * Remove silences for a player.
 */
export async function clearSilences(steamId: string): Promise<void> {
    const redis = getRedis()
    const baseKey = `minqlx:players:${steamId}:silences`
    const silenceKeys = await redis.keys(`${baseKey}:*`)
    const keysToDelete = [baseKey, ...silenceKeys]
    if (keysToDelete.length > 0) {
        await redis.del(...keysToDelete)
    }
}

// ============================================================
// BANVOTE (banvote.py) - Cannot call votes
// ============================================================

const BANVOTE_KEY = "minqlx:vote_ban"

/**
 * Ban a player from voting (syncs with banvote.py plugin).
 */
export async function applyBanvote(steamId: string): Promise<void> {
    const redis = getRedis()
    await redis.sadd(BANVOTE_KEY, steamId)
}

/**
 * Allow a player to vote again.
 */
export async function removeBanvote(steamId: string): Promise<void> {
    const redis = getRedis()
    await redis.srem(BANVOTE_KEY, steamId)
}

/**
 * Check if a player is banned from voting.
 */
export async function isBanvoted(steamId: string): Promise<boolean> {
    const redis = getRedis()
    return await redis.sismember(BANVOTE_KEY, steamId) === 1
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Check if a player is banned (permaban or temp ban).
 */
export async function isPlayerBanned(steamId: string): Promise<boolean> {
    const redis = getRedis()

    const permabanned = await redis.get(`minqlx:players:${steamId}:permabanned`)
    if (permabanned === "1") return true

    const now = Math.floor(Date.now() / 1000)
    const bans = await redis.zrangebyscore(`minqlx:players:${steamId}:bans`, now, "+inf")
    return bans.length > 0
}

/**
 * Clear ALL moderation actions for a player (full reset).
 */
export async function clearAllModeration(steamId: string): Promise<void> {
    await clearTempBans(steamId)
    await removePermaban(steamId)
    await clearWarnings(steamId)
    await clearSilences(steamId)
    await removeBanvote(steamId)
}

// ============================================================
// PUB/SUB — Real-time push to game servers
// ============================================================
const ACTIONS_CHANNEL = 'quakeclub:game_actions'

export async function publishAction(payload: {
    action: 'ban' | 'unban' | 'permaban' | 'unpermaban' | 'kick' | 'silence' | 'unsilence' | 'warn' | 'unwarn' | 'banvote' | 'unbanvote' | 'setmotd' | 'clearmotd'
    steamId: string
    reason?: string
    duration?: number
    actorName?: string
}) {
    try {
        const redis = getRedis()
        await redis.publish(ACTIONS_CHANNEL, JSON.stringify({ ...payload, ts: Date.now() }))
    } catch (e) {
        console.error('[publishAction] error:', e)
    }
}

export { ACTIONS_CHANNEL }
