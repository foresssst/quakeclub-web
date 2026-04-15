import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logSecurityEvent, getSecurityHeaders } from "@/lib/security"

function withHeaders(response: NextResponse) {
  const headers = getSecurityHeaders()
  Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v))
  return response
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get("categoryId")
    if (!categoryId) {
      return withHeaders(NextResponse.json({ error: "categoryId requerido" }, { status: 400 }))
    }

    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "20")), 50)
    const skip = (page - 1) * limit

    const where = { categoryId }

    const [threads, total] = await Promise.all([
      prisma.forumThread.findMany({
        where,
        orderBy: [{ isPinned: "desc" }, { lastReplyAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          steamId: true,
          username: true,
          avatar: true,
          status: true,
          isPinned: true,
          replyCount: true,
          lastReplyAt: true,
          lastReplyBy: true,
          createdAt: true,
        },
      }),
      prisma.forumThread.count({ where }),
    ])

    return withHeaders(NextResponse.json({ threads, total, page, totalPages: Math.ceil(total / limit) }))
  } catch (error) {
    return withHeaders(NextResponse.json({ error: "Error al obtener hilos" }, { status: 500 }))
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session?.user.isAdmin) {
      return withHeaders(NextResponse.json({ error: "Solo el admin puede crear hilos" }, { status: 403 }))
    }

    const { categoryId, title, content } = await request.json()
    if (!categoryId || !title?.trim() || !content?.trim()) {
      return withHeaders(NextResponse.json({ error: "categoryId, title y content requeridos" }, { status: 400 }))
    }

    if (title.trim().length > 200) {
      return withHeaders(NextResponse.json({ error: "Título máximo 200 caracteres" }, { status: 400 }))
    }
    if (content.trim().length > 5000) {
      return withHeaders(NextResponse.json({ error: "Contenido máximo 5000 caracteres" }, { status: 400 }))
    }

    const category = await prisma.forumCategory.findUnique({ where: { id: categoryId } })
    if (!category) {
      return withHeaders(NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 }))
    }

    // Get player info for denormalized fields
    let authorId = "admin"
    let steamId = session.user.steamId || "admin"
    let username = session.user.username || "Admin"
    let avatar = session.user.avatar || null

    if (session.user.steamId) {
      const player = await prisma.player.findUnique({
        where: { steamId: session.user.steamId },
        select: { id: true, steamId: true, username: true, avatar: true },
      })
      if (player) {
        authorId = player.id
        steamId = player.steamId
        username = player.username
        avatar = player.avatar
      }
    }

    const sanitizedContent = content.trim().replace(/<[^>]*>/g, "")
    const sanitizedTitle = title.trim().replace(/<[^>]*>/g, "")

    const thread = await prisma.forumThread.create({
      data: {
        categoryId,
        title: sanitizedTitle,
        content: sanitizedContent,
        authorId,
        steamId,
        username,
        avatar,
      },
    })

    logSecurityEvent("FORUM_THREAD_CREATED", { threadId: thread.id, categoryId })

    return withHeaders(NextResponse.json({ thread }, { status: 201 }))
  } catch (error) {
    return withHeaders(NextResponse.json({ error: "Error al crear hilo" }, { status: 500 }))
  }
}
