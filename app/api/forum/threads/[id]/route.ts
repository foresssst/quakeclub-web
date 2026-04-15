import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logSecurityEvent, getSecurityHeaders } from "@/lib/security"

function withHeaders(response: NextResponse) {
  const headers = getSecurityHeaders()
  Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v))
  return response
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const thread = await prisma.forumThread.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    })

    if (!thread) {
      return withHeaders(NextResponse.json({ error: "Hilo no encontrado" }, { status: 404 }))
    }

    return withHeaders(NextResponse.json({ thread }))
  } catch (error) {
    return withHeaders(NextResponse.json({ error: "Error" }, { status: 500 }))
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user.isAdmin) {
      return withHeaders(NextResponse.json({ error: "No autorizado" }, { status: 403 }))
    }

    const { id } = await params
    const body = await request.json()

    const data: Record<string, unknown> = {}
    if (body.title !== undefined) data.title = body.title.trim().replace(/<[^>]*>/g, "")
    if (body.content !== undefined) data.content = body.content.trim().replace(/<[^>]*>/g, "")
    if (body.status !== undefined) data.status = body.status
    if (body.isPinned !== undefined) data.isPinned = body.isPinned

    const thread = await prisma.forumThread.update({ where: { id }, data })

    logSecurityEvent("FORUM_THREAD_UPDATED", { threadId: id, changes: Object.keys(data) })

    return withHeaders(NextResponse.json({ thread }))
  } catch (error) {
    return withHeaders(NextResponse.json({ error: "Error al actualizar" }, { status: 500 }))
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user.isAdmin) {
      return withHeaders(NextResponse.json({ error: "No autorizado" }, { status: 403 }))
    }

    const { id } = await params
    await prisma.forumThread.delete({ where: { id } })

    logSecurityEvent("FORUM_THREAD_DELETED", { threadId: id })

    return withHeaders(NextResponse.json({ success: true }))
  } catch (error) {
    return withHeaders(NextResponse.json({ error: "Error al eliminar" }, { status: 500 }))
  }
}
