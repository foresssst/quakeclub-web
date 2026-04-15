import { NextResponse } from "next/server"
import { createNews } from "@/lib/news-storage"
import { getSession } from "@/lib/auth"
import { validateNewsContent, sanitizeMarkdown, logSecurityEvent, getSecurityHeaders } from "@/lib/security"

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session?.user.isAdmin) {
      logSecurityEvent("UNAUTHORIZED_NEWS_CREATE", { userId: session?.user.id })
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const newsData = await request.json()

    const validation = validateNewsContent(newsData.title, newsData.content, newsData.excerpt)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const sanitizedData = {
      ...newsData,
      title: newsData.title.trim(),
      content: sanitizeMarkdown(newsData.content),
      excerpt: newsData.excerpt.trim(),
      author: newsData.author?.trim() || "Admin",
    }

    const news = createNews(sanitizedData)
    logSecurityEvent("NEWS_CREATED", { newsId: news.id, userId: session.user.id })

    const response = NextResponse.json({ news }, { status: 201 })
    const headers = getSecurityHeaders()
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    logSecurityEvent("NEWS_CREATE_ERROR", { error: String(error) })
    return NextResponse.json({ error: "Failed to create news" }, { status: 500 })
  }
}
