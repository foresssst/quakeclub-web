import { NextResponse } from "next/server"
import { getAllNews } from "@/lib/news-storage"
import { getNewsImagePath } from "@/lib/news-images"

export async function GET() {
  try {
    const news = getAllNews().map((item) => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      date: item.date,
      excerpt: item.excerpt,
      author: item.author,
      imageUrl: getNewsImagePath(item),
    }))
    return NextResponse.json({ news })
  } catch (error) {
    console.error("Error fetching news:", error)
    return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 })
  }
}
