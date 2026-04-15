import { NextResponse } from "next/server"
import { getAllNews } from "@/lib/news-storage"
import { getNewsImagePath } from "@/lib/news-images"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "10")), 50)

        const allNews = getAllNews()

        // Ordenar por fecha descendente y limitar
        const sortedNews = allNews
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, limit)
            .map(news => ({
                id: news.id,
                title: news.title,
                excerpt: news.excerpt,
                date: news.date,
                imageUrl: getNewsImagePath(news),
                slug: news.slug
            }))

        return NextResponse.json({ news: sortedNews }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } })
    } catch (error) {
        console.error("Error fetching news:", error)
        return NextResponse.json({ news: [] }, { status: 500 })
    }
}
