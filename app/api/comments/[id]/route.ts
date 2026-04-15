import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logSecurityEvent, getSecurityHeaders } from "@/lib/security"

function withHeaders(response: NextResponse) {
  const headers = getSecurityHeaders()
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
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

    const comment = await prisma.comment.findUnique({ where: { id } })
    if (!comment) {
      return withHeaders(NextResponse.json({ error: "Comentario no encontrado" }, { status: 404 }))
    }

    // Admin or author can delete
    const isAuthor = session.user.steamId === comment.steamId
    const isAdmin = session.user.isAdmin
    if (!isAuthor && !isAdmin) {
      return withHeaders(NextResponse.json({ error: "No autorizado" }, { status: 403 }))
    }

    await prisma.comment.delete({ where: { id } })

    logSecurityEvent("COMMENT_DELETED", {
      commentId: id,
      deletedBy: session.user.steamId || session.user.id,
      wasAdmin: isAdmin && !isAuthor,
    })

    return withHeaders(NextResponse.json({ success: true }))
  } catch (error) {
    return withHeaders(NextResponse.json({ error: "Error al eliminar comentario" }, { status: 500 }))
  }
}
