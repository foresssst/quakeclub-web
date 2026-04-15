import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { logSecurityEvent, getSecurityHeaders } from "@/lib/security"
import { prisma } from "@/lib/prisma"

// Valid roles that can be assigned
const VALID_ROLES = ["founder", "dev", "admin", "mod"] as const

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession()
        if (!session?.user.isAdmin) {
            logSecurityEvent("UNAUTHORIZED_ROLES_UPDATE", { userId: session?.user.id })
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        const { id } = await params
        const body = await request.json()
        const { roles } = body

        // Validate roles array
        if (!Array.isArray(roles)) {
            return NextResponse.json({ error: "Roles must be an array" }, { status: 400 })
        }

        // Validate each role
        const invalidRoles = roles.filter(role => !VALID_ROLES.includes(role))
        if (invalidRoles.length > 0) {
            return NextResponse.json({
                error: `Invalid roles: ${invalidRoles.join(", ")}. Valid roles are: ${VALID_ROLES.join(", ")}`
            }, { status: 400 })
        }

        // Update the player's roles
        const updatedPlayer = await prisma.player.update({
            where: { id },
            data: { roles },
            select: { id: true, username: true, roles: true }
        })

        logSecurityEvent("USER_ROLES_UPDATED", {
            updatedUserId: id,
            adminId: session.user.id,
            newRoles: roles,
            username: updatedPlayer.username
        })

        const response = NextResponse.json({
            success: true,
            player: updatedPlayer
        })
        const headers = getSecurityHeaders()
        Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value)
        })

        return response
    } catch (error) {
        console.error("Error updating roles:", error)
        logSecurityEvent("USER_ROLES_UPDATE_ERROR", { error: String(error) })
        return NextResponse.json({ error: "Failed to update roles" }, { status: 500 })
    }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession()
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        const { id } = await params

        const player = await prisma.player.findUnique({
            where: { id },
            select: { id: true, roles: true }
        })

        if (!player) {
            return NextResponse.json({ error: "Player not found" }, { status: 404 })
        }

        const response = NextResponse.json({ roles: player.roles || [] })
        const headers = getSecurityHeaders()
        Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value)
        })

        return response
    } catch (error) {
        console.error("Error fetching roles:", error)
        return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 })
    }
}
