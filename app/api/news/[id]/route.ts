import { NextResponse } from "next/server"
import { getNewsById, updateNews, deleteNews } from "@/lib/news-storage"
import { getSession } from "@/lib/auth"
import { getNewsImagePath } from "@/lib/news-images"
import { validateNewsContent, sanitizeMarkdown, logSecurityEvent, getSecurityHeaders } from "@/lib/security"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const news = getNewsById(id)
    if (!news) {
      return NextResponse.json({ error: "News not found" }, { status: 404 })
    }

    const session = await getSession().catch(() => null)
    const imageUrl = getNewsImagePath(news)
    const payload =
      session?.user?.isAdmin
        ? {
            ...news,
            imageUrl,
          }
        : {
            ...news,
            image: imageUrl || news.image,
            imageUrl,
          }

    const response = NextResponse.json({
      news: payload,
    })
    const headers = getSecurityHeaders()
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    console.error("Error fetching news:", error)
    return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user.isAdmin) {
      logSecurityEvent("UNAUTHORIZED_NEWS_UPDATE", { userId: session?.user.id })
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { id } = await params
    const updates = await request.json()

    if (updates.title || updates.content || updates.excerpt) {
      const currentNews = getNewsById(id)
      if (!currentNews) {
        return NextResponse.json({ error: "News not found" }, { status: 404 })
      }

      const validation = validateNewsContent(
        updates.title || currentNews.title,
        updates.content || currentNews.content,
        updates.excerpt || currentNews.excerpt,
      )

      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 })
      }

      if (updates.content) {
        updates.content = sanitizeMarkdown(updates.content)
      }
      if (updates.title) {
        updates.title = updates.title.trim()
      }
      if (updates.excerpt) {
        updates.excerpt = updates.excerpt.trim()
      }
    }

    const news = updateNews(id, updates)

    if (!news) {
      return NextResponse.json({ error: "News not found" }, { status: 404 })
    }

    logSecurityEvent("NEWS_UPDATED", { newsId: id, userId: session.user.id })

    const response = NextResponse.json({ news })
    const headers = getSecurityHeaders()
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    logSecurityEvent("NEWS_UPDATE_ERROR", { error: String(error) })
    return NextResponse.json({ error: "Failed to update news" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user.isAdmin) {
      logSecurityEvent("UNAUTHORIZED_NEWS_DELETE", { userId: session?.user.id })
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { id } = await params
    const success = deleteNews(id)

    if (!success) {
      return NextResponse.json({ error: "News not found" }, { status: 404 })
    }

    logSecurityEvent("NEWS_DELETED", { newsId: id, userId: session.user.id })

    const response = NextResponse.json({ success: true })
    const headers = getSecurityHeaders()
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    logSecurityEvent("NEWS_DELETE_ERROR", { error: String(error) })
    return NextResponse.json({ error: "Failed to delete news" }, { status: 500 })
  }
}
