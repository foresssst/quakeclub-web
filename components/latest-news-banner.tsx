"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"

interface NewsItem {
  id: string
  slug?: string
  title: string
  date: string
}

interface BannerConfig {
  mode: "latest" | "specific" | "motd"
  newsId?: string
  motdText?: string
}

export function LatestNewsBanner() {
  const { data: content } = useQuery({
    queryKey: ["banner", "content"],
    queryFn: async () => {
      const configRes = await fetch("/api/admin/banner-config")
      const config: BannerConfig = configRes.ok ? await configRes.json() : { mode: "latest" }

      if (config.mode === "motd" && config.motdText) {
        return { text: config.motdText }
      } else if (config.mode === "specific" && config.newsId) {
        const newsRes = await fetch(`/api/news/${config.newsId}`)
        if (newsRes.ok) {
          const data = await newsRes.json()
          if (data.news) {
            return { text: data.news.title, link: `/noticias/${data.news.slug || data.news.id}`, date: data.news.date }
          }
        }
      } else {
        const newsRes = await fetch("/api/news/list")
        if (newsRes.ok) {
          const data = await newsRes.json()
          if (data.news && data.news.length > 0) {
            const sortedNews = data.news.sort(
              (a: NewsItem, b: NewsItem) => new Date(b.date).getTime() - new Date(a.date).getTime(),
            )
            return {
              text: sortedNews[0].title,
              link: `/noticias/${sortedNews[0].slug || sortedNews[0].id}`,
              date: sortedNews[0].date,
            }
          }
        }
      }
      return null
    },
    staleTime: 10 * 60 * 1000,
    refetchOnMount: false,
  })

  if (!content) return null

  const BannerContent = (
    <div className="border-b border-white/[0.06] bg-[#17171b] shadow-[0_14px_36px_rgba(0,0,0,0.22)] lg:-ml-[20px] lg:pl-[20px]">
      <div className="mx-auto max-w-7xl px-3 sm:px-6">
        <div className="flex items-center justify-center gap-2 py-2 sm:py-2.5">
          <span className="h-2 w-2 rounded-full bg-[#d4af37]" />
          <h3 className="text-[10px] sm:text-xs font-bold text-white/80 text-center line-clamp-1 group-hover:text-white transition-colors font-tiktok uppercase tracking-[0.22em]">
            {content.text}
          </h3>
        </div>
      </div>
    </div>
  )

  if (content.link) {
    return (
      <Link
        href={content.link}
        data-news-banner
        className="block group transition-all hover:bg-[#2a2a2e]"
      >
        {BannerContent}
      </Link>
    )
  }

  return (
    <div data-news-banner>
      {BannerContent}
    </div>
  )
}
