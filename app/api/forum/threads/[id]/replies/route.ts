import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkRateLimit, logSecurityEvent, getSecurityHeaders } from "@/lib/security"

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
    const { searchParams } = new URL(request.url)

    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "30")), 50)
    const skip = (page - 1) * limit

    const where = { threadId: id }

    const [replies, total] = await Promise.all([
      prisma.forumReply.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.forumReply.count({ where }),
    ])

    return withHeaders(NextResponse.json({ replies, total, page, totalPages: Math.ceil(total / limit) }))
  } catch (error) {
    return withHeaders(NextResponse.json({ error: "Error al obtener respuestas" }, { status: 500 }))
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user.steamId) {
      return withHeaders(NextResponse.json({ error: "Debes iniciar sesión con Steam" }, { status: 401 }))
    }

    if (!checkRateLimit(`forum-reply:${session.user.steamId}`, 5, 5 * 60 * 1000)) {
      return withHeaders(NextResponse.json({ error: "Demasiadas respuestas. Espera unos minutos." }, { status: 429 }))
    }

    const { id: threadId } = await params
    const { content } = await request.json()

    if (!content?.trim()) {
      return withHeaders(NextResponse.json({ error: "Contenido requerido" }, { status: 400 }))
    }
    if (content.trim().length > 5000) {
      return withHeaders(NextResponse.json({ error: "Máximo 5000 caracteres" }, { status: 400 }))
    }

    const thread = await prisma.forumThread.findUnique({ where: { id: threadId } })
    if (!thread) {
      return withHeaders(NextResponse.json({ error: "Hilo no encontrado" }, { status: 404 }))
    }
    if (thread.status === "CLOSED") {
      return withHeaders(NextResponse.json({ error: "Este hilo está cerrado" }, { status: 403 }))
    }

    const player = await prisma.player.findUnique({
      where: { steamId: session.user.steamId },
      select: { id: true, steamId: true, username: true, avatar: true },
    })
    if (!player) {
      return withHeaders(NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 }))
    }

    const sanitized = content.trim().replace(/<[^>]*>/g, "")

    const [reply] = await prisma.$transaction([
      prisma.forumReply.create({
        data: {
          threadId,
          authorId: player.id,
          steamId: player.steamId,
          username: player.username,
          avatar: player.avatar,
          content: sanitized,
        },
      }),
      prisma.forumThread.update({
        where: { id: threadId },
        data: {
          replyCount: { increment: 1 },
          lastReplyAt: new Date(),
          lastReplyBy: player.username,
        },
      }),
    ])

    // Notify thread author if different from replier
    if (thread.authorId !== player.id) {
      try {
        await prisma.notification.create({
          data: {
            id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            userId: thread.authorId,
            type: "FORUM_REPLY",
            title: `${player.username} respondió en "${thread.title.substring(0, 50)}"`,
            link: `/foro/${thread.categoryId}/${thread.id}`,
          },
        })
      } catch {
        // Non-critical, don't fail the reply
      }
    }

    return withHeaders(NextResponse.json({ reply }, { status: 201 }))
  } catch (error) {
    return withHeaders(NextResponse.json({ error: "Error al responder" }, { status: 500 }))
  }
}
