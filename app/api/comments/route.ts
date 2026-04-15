import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkRateLimit, logSecurityEvent, getSecurityHeaders } from "@/lib/security"

function withHeaders(response: NextResponse) {
  const headers = getSecurityHeaders()
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const newsId = searchParams.get("newsId")
    if (!newsId) {
      return withHeaders(NextResponse.json({ error: "newsId requerido" }, { status: 400 }))
    }

    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "50")), 100)
    const skip = (page - 1) * limit

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where: { newsId },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.comment.count({ where: { newsId } }),
    ])

    return withHeaders(NextResponse.json({
      comments,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    }))
  } catch (error) {
    return withHeaders(NextResponse.json({ error: "Error al obtener comentarios" }, { status: 500 }))
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session?.user.steamId) {
      return withHeaders(NextResponse.json({ error: "Debes iniciar sesión con Steam" }, { status: 401 }))
    }

    if (!checkRateLimit(`comment:${session.user.steamId}`, 5, 5 * 60 * 1000)) {
      return withHeaders(NextResponse.json({ error: "Demasiados comentarios. Espera unos minutos." }, { status: 429 }))
    }

    const { newsId, content } = await request.json()
    if (!newsId || !content?.trim()) {
      return withHeaders(NextResponse.json({ error: "newsId y content requeridos" }, { status: 400 }))
    }

    const trimmed = content.trim()
    if (trimmed.length > 2000) {
      return withHeaders(NextResponse.json({ error: "El comentario no puede superar 2000 caracteres" }, { status: 400 }))
    }

    // Strip HTML tags
    const sanitized = trimmed.replace(/<[^>]*>/g, "")

    const player = await prisma.player.findUnique({
      where: { steamId: session.user.steamId },
      select: { id: true, steamId: true, username: true, avatar: true },
    })

    if (!player) {
      return withHeaders(NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 }))
    }

    const comment = await prisma.comment.create({
      data: {
        newsId,
        authorId: player.id,
        steamId: player.steamId,
        username: player.username,
        avatar: player.avatar,
        content: sanitized,
      },
    })

    logSecurityEvent("COMMENT_CREATED", { newsId, commentId: comment.id, userId: session.user.steamId })

    return withHeaders(NextResponse.json({ comment }, { status: 201 }))
  } catch (error) {
    logSecurityEvent("COMMENT_CREATE_ERROR", { error: String(error) })
    return withHeaders(NextResponse.json({ error: "Error al crear comentario" }, { status: 500 }))
  }
}
