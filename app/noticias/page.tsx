"use client"

import Link from "next/link"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import type { NewsItem } from "@/types/news"
import { NewsImage } from "@/components/news-image"
import { ContentContainer, ContentHeader } from "@/components/ui/content-container"
import { LoadingScreen } from "@/components/loading-screen"

export default function NoticiasPage() {
  const t = useTranslations("news")
  const [sortBy, setSortBy] = useState("recent")

  const { data: newsData, isLoading: loading } = useQuery({
    queryKey: ["news-list"],
    queryFn: async () => {
      const res = await fetch("/api/news/list")
      if (!res.ok) throw new Error("Failed to fetch news")
      const data = await res.json()
      return data.news || []
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  })

  const news = newsData || []

  const getTimeAgo = (date: string) => {
    // Parsear la fecha como fecha local (no UTC)
    const [year, month, day] = date.split("-").map(Number)
    const newsDate = new Date(year, month - 1, day)
    const now = new Date()

    // Comparar solo las fechas, sin horas
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const newsMidnight = new Date(newsDate.getFullYear(), newsDate.getMonth(), newsDate.getDate())

    const diffTime = todayMidnight.getTime() - newsMidnight.getTime()
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return t("today")
    if (diffDays === 1) return t("yesterday")
    if (diffDays < 0) return t("today") // Fecha futura, mostrar como hoy
    return t("daysAgo", { days: diffDays })
  }

  return (
    <div className="relative min-h-screen">

      <div className="container mx-auto py-4 sm:py-6 px-3 sm:px-4 max-w-[1400px] pt-4 sm:pt-10">
        <div className="max-w-[1080px] mx-auto space-y-4 animate-fade-up">
          {/* Top Ad - In-Feed */}

          <ContentContainer className="animate-scale-fade">
            <ContentHeader className="flex items-center justify-between">
              <div>
                <h1 className="font-tiktok text-lg sm:text-xl font-bold uppercase tracking-wide text-foreground">
                  {t("title")}
                </h1>
                <p className="mt-1 text-[10px] tracking-wide text-foreground/40">{t("subtitle")}</p>
              </div>
            </ContentHeader>

            <div className="p-3 sm:p-4">
              {loading ? (
                <LoadingScreen compact />
              ) : news.length === 0 ? (
                <div className="flex flex-col items-center justify-center border border-black/[0.05] bg-foreground/[0.02] py-16 rounded-xl">
                  <p className="text-[13px] text-foreground/45">{t("noNews")}</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {news.map((newsItem: NewsItem) => (
                    <Link
                      key={newsItem.id}
                      href={`/noticias/${newsItem.slug || newsItem.id}`}
                      className="group block stat-card overflow-hidden"
                    >
                      <div className="relative h-32 sm:h-40 w-full overflow-hidden bg-background">
                        {newsItem.imageUrl || newsItem.image ? (
                          <NewsImage
                            src={newsItem.imageUrl || newsItem.image || "/branding/logo.png"}
                            alt={newsItem.title}
                            width={400}
                            height={176}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-foreground/10">
                            <div className="w-10 h-10 border-2 border-current rounded" />
                          </div>
                        )}
                        <div className="absolute top-2 right-2 rounded-md bg-black/65 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/90">
                          {getTimeAgo(newsItem.date)}
                        </div>
                      </div>

                      <div className="p-3.5">
                        <h2 className="mb-1.5 line-clamp-2 text-[13px] font-bold leading-snug text-foreground transition-colors group-hover:text-foreground/75">
                          {newsItem.title}
                        </h2>

                        <p className="mb-2.5 line-clamp-2 text-[11px] leading-relaxed text-foreground/50">{newsItem.excerpt}</p>

                        <div className="flex items-center justify-between border-t border-foreground/[0.04] pt-2.5 text-[9px] text-foreground/32">
                          <span>
                            {t("by")} <strong className="text-foreground/62">QuakeClub</strong>
                          </span>
                          <span className="group-hover:translate-x-0.5 transition-transform duration-200 text-foreground font-medium">
                            {t("readMore")}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </ContentContainer>

          {/* Bottom Ad - Display */}
        </div>
      </div>

    </div>
  )
}
