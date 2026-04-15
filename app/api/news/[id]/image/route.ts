import { NextResponse } from "next/server"
import { getNewsById } from "@/lib/news-storage"
import { parseDataImageUrl } from "@/lib/news-images"
import { DEFAULT_OG_IMAGE, absoluteUrl } from "@/lib/seo"
import { getSecurityHeaders } from "@/lib/security"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const news = getNewsById(id)

    if (!news?.image) {
      return NextResponse.redirect(absoluteUrl(DEFAULT_OG_IMAGE.url), 307)
    }

    if (!news.image.startsWith("data:image/")) {
      return NextResponse.redirect(absoluteUrl(news.image), 307)
    }

    const parsed = parseDataImageUrl(news.image)
    if (!parsed) {
      return NextResponse.redirect(absoluteUrl(DEFAULT_OG_IMAGE.url), 307)
    }

    const response = new NextResponse(parsed.buffer, {
      headers: {
        "Content-Type": parsed.mimeType,
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    })

    const headers = getSecurityHeaders()
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    console.error("Error serving news image:", error)
    return NextResponse.redirect(absoluteUrl(DEFAULT_OG_IMAGE.url), 307)
  }
}
