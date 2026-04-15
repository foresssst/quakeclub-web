import { NextResponse } from "next/server"
import { getSession, deleteUser, updateUserAdmin } from "@/lib/auth"
import { logSecurityEvent, getSecurityHeaders } from "@/lib/security"

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user.isAdmin) {
      logSecurityEvent("UNAUTHORIZED_USER_DELETE", { userId: session?.user.id })
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { id } = await params
    const success = deleteUser(id)

    if (!success) {
      return NextResponse.json({ error: "User not found or cannot be deleted" }, { status: 400 })
    }

    logSecurityEvent("USER_DELETED", { deletedUserId: id, adminId: session.user.id })

    const response = NextResponse.json({ success: true })
    const headers = getSecurityHeaders()
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    logSecurityEvent("USER_DELETE_ERROR", { error: String(error) })
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user.isAdmin) {
      logSecurityEvent("UNAUTHORIZED_USER_UPDATE", { userId: session?.user.id })
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { isAdmin } = body

    if (typeof isAdmin !== "boolean") {
      return NextResponse.json({ error: "Invalid isAdmin value" }, { status: 400 })
    }

    const success = updateUserAdmin(id, isAdmin)

    if (!success) {
      return NextResponse.json({ error: "User not found or cannot be updated" }, { status: 400 })
    }

    logSecurityEvent("USER_UPDATED", { updatedUserId: id, adminId: session.user.id, isAdmin })

    const response = NextResponse.json({ success: true })
    const headers = getSecurityHeaders()
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    logSecurityEvent("USER_UPDATE_ERROR", { error: String(error) })
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}
