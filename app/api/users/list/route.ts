import { NextResponse } from "next/server"
import { getSession, getAllUsers } from "@/lib/auth"
import { logSecurityEvent, getSecurityHeaders } from "@/lib/security"
import { prisma } from "@/lib/prisma"


export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user) {
      logSecurityEvent("UNAUTHORIZED_USERS_LIST", { reason: "No session" })
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Get users from JSON file (for admin status)
    const jsonUsers = getAllUsers()

    // Get players from database (for avatar, steamId, roles)
    const dbPlayers = await prisma.player.findMany({
      select: {
        id: true,
        steamId: true,
        username: true,
        avatar: true,
        roles: true,
      }
    })

    // Merge data - prioritize database info but include admin status from JSON
    const mergedUsers = dbPlayers.map(player => {
      const jsonUser = jsonUsers.find(u => u.steamId === player.steamId)
      return {
        id: player.id,
        username: player.username,
        steamId: player.steamId,
        avatar: player.avatar,
        isAdmin: jsonUser?.isAdmin || false,
        roles: player.roles || []
      }
    })

    // Sort by admin status first, then by username
    mergedUsers.sort((a, b) => {
      if (a.isAdmin && !b.isAdmin) return -1
      if (!a.isAdmin && b.isAdmin) return 1
      return a.username.localeCompare(b.username)
    })

    const response = NextResponse.json({ users: mergedUsers })
    const headers = getSecurityHeaders()
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    logSecurityEvent("USERS_LIST_ERROR", { error: String(error) })
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}
