import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logSecurityEvent, getSecurityHeaders } from "@/lib/security"

function withHeaders(response: NextResponse) {
  const headers = getSecurityHeaders()
  Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v))
  return response
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return withHeaders(NextResponse.json({ error: "No autorizado" }, { status: 401 }))
    }

    const { id } = await params

    const reply = await prisma.forumReply.findUnique({ where: { id } })
    if (!reply) {
      return withHeaders(NextResponse.json({ error: "Respuesta no encontrada" }, { status: 404 }))
    }

    const isAuthor = session.user.steamId === reply.steamId
    const isAdmin = session.user.isAdmin
    if (!isAuthor && !isAdmin) {
      return withHeaders(NextResponse.json({ error: "No autorizado" }, { status: 403 }))
    }

    await prisma.$transaction([
      prisma.forumReply.delete({ where: { id } }),
      prisma.forumThread.update({
        where: { id: reply.threadId },
        data: { replyCount: { decrement: 1 } },
      }),
    ])

    logSecurityEvent("FORUM_REPLY_DELETED", { replyId: id, deletedBy: session.user.steamId || session.user.id })

    return withHeaders(NextResponse.json({ success: true }))
  } catch (error) {
    return withHeaders(NextResponse.json({ error: "Error al eliminar" }, { status: 500 }))
  }
}
