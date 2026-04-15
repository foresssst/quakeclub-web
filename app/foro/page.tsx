"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { LoadingScreen } from "@/components/loading-screen"

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  threadCount: number
  lastThread: {
    id: string
    title: string
    lastReplyAt: string | null
    lastReplyBy: string | null
    createdAt: string
  } | null
}

export default function ForoPage() {
  const { data, isFetched } = useQuery({
    queryKey: ["forum-categories"],
    queryFn: async () => {
      const res = await fetch("/api/forum/categories")
      if (!res.ok) return { categories: [] }
      return res.json()
    },
    staleTime: 60 * 1000,
  })

  const categories: Category[] = data?.categories || []

  if (!isFetched) return <LoadingScreen />

  return (
    <div className="container mx-auto py-4 sm:py-6 px-3 sm:px-4 max-w-[1400px] pt-4 sm:pt-10">
      <div className="max-w-[900px] mx-auto space-y-3 animate-fade-up">
        {/* Header */}
        <div className="bg-card border border-black/[0.07] rounded-[18px] px-5 py-4" style={{ boxShadow: "0 2px 4px rgba(0,0,0,0.04), 0 8px 20px rgba(0,0,0,0.12)" }}>
          <h1 className="font-tiktok text-lg sm:text-xl font-bold uppercase tracking-wide text-foreground">
            Foro
          </h1>
          <p className="text-[11px] text-[#666] mt-0.5">Discusión de la comunidad QuakeClub</p>
        </div>

        {/* Categories */}
        {categories.length === 0 ? (
          <div className="bg-card border border-black/[0.07] rounded-[18px] px-5 py-10 text-center" style={{ boxShadow: "0 2px 4px rgba(0,0,0,0.04), 0 8px 20px rgba(0,0,0,0.12)" }}>
            <p className="text-[#666] text-[13px]">No hay categorías aún.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/foro/${cat.slug}`}
                className="block bg-card border border-black/[0.07] rounded-[14px] px-5 py-4 hover:bg-[#d6d6dc] transition-colors duration-200 group"
                style={{ boxShadow: "0 2px 4px rgba(0,0,0,0.04), 0 6px 16px rgba(0,0,0,0.10)" }}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-[13px] font-bold text-foreground group-hover:text-[#333] uppercase tracking-wide">
                      {cat.name}
                    </h2>
                    {cat.description && (
                      <p className="text-[11px] text-[#666] mt-0.5">{cat.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-5 flex-shrink-0 text-right">
                    <div>
                      <p className="text-base font-bold text-foreground">{cat.threadCount}</p>
                      <p className="text-[9px] text-[#888] uppercase tracking-wider">Hilos</p>
                    </div>

                    {cat.lastThread && (
                      <div className="hidden sm:block max-w-[180px]">
                        <p className="text-[11px] text-[#555] truncate">{cat.lastThread.title}</p>
                        <p className="text-[9px] text-[#888] mt-0.5">
                          {cat.lastThread.lastReplyBy
                            ? `${cat.lastThread.lastReplyBy}`
                            : formatDate(cat.lastThread.createdAt)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString("es-CL", { day: "numeric", month: "short" })
}
