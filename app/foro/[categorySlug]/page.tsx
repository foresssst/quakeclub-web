"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { LoadingScreen } from "@/components/loading-screen"

interface Thread {
  id: string
  title: string
  steamId: string
  username: string
  avatar: string | null
  status: string
  isPinned: boolean
  replyCount: number
  lastReplyAt: string | null
  lastReplyBy: string | null
  createdAt: string
}

export default function CategoryPage() {
  const params = useParams()
  const slug = params.categorySlug as string

  const { data: catData } = useQuery({
    queryKey: ["forum-category", slug],
    queryFn: async () => {
      const res = await fetch(`/api/forum/categories/${slug}`)
      if (!res.ok) return null
      return res.json()
    },
    staleTime: 60 * 1000,
  })

  const category = catData?.category

  const { data: threadsData, isFetched } = useQuery({
    queryKey: ["forum-threads", category?.id],
    queryFn: async () => {
      const res = await fetch(`/api/forum/threads?categoryId=${category.id}`)
      if (!res.ok) return { threads: [], total: 0 }
      return res.json()
    },
    enabled: !!category?.id,
    staleTime: 30 * 1000,
  })

  const threads: Thread[] = threadsData?.threads || []

  if (!category && !isFetched) return <LoadingScreen />

  return (
    <div className="container mx-auto py-6 sm:py-8 px-3 sm:px-4 max-w-[1400px] pt-8 sm:pt-12">
      <div className="max-w-4xl mx-auto space-y-4 animate-fade-up">
        {/* Breadcrumb + Header */}
        <div className="bg-card shadow-sm border border-foreground/[0.06] rounded-xl px-6 py-6">
          <div className="flex items-center gap-2 text-xs text-foreground/40 mb-2">
            <Link href="/foro" className="hover:text-foreground/60 transition-colors">Foro</Link>
            <span>/</span>
            <span className="text-foreground/60">{category?.name || slug}</span>
          </div>
          <h1 className="font-tiktok text-2xl sm:text-3xl font-bold uppercase tracking-wider text-foreground">
            {category?.name || slug}
          </h1>
          {category?.description && (
            <p className="text-sm text-foreground/50 mt-1">{category.description}</p>
          )}
        </div>

        {/* Threads */}
        {!isFetched ? (
          <LoadingScreen />
        ) : threads.length === 0 ? (
          <div className="bg-card shadow-sm border border-foreground/[0.06] rounded-xl px-6 py-12 text-center">
            <p className="text-foreground/40 text-sm">No hay hilos en esta categoría aún.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {threads.map((thread) => (
              <Link
                key={thread.id}
                href={`/foro/${slug}/${thread.id}`}
                className="block bg-card shadow-sm border border-foreground/[0.06] rounded-xl px-5 py-4 hover:bg-[#d4d4d9] transition-colors group"
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <img
                    src={thread.avatar || "/placeholders/default-avatar.png"}
                    alt={thread.username}
                    className="w-9 h-9 rounded-full flex-shrink-0"
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {thread.isPinned && (
                        <span className="text-[9px] font-bold uppercase bg-foreground text-white px-1.5 py-0.5 rounded">Fijado</span>
                      )}
                      {thread.status === "CLOSED" && (
                        <span className="text-[9px] font-bold uppercase bg-red-500/80 text-white px-1.5 py-0.5 rounded">Cerrado</span>
                      )}
                      <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-[#333]">
                        {thread.title}
                      </h3>
                    </div>
                    <p className="text-[11px] text-foreground/40 mt-0.5">
                      por <span className="text-foreground/50">{thread.username}</span> · {formatDate(thread.createdAt)}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 flex-shrink-0 text-right">
                    <div>
                      <p className="text-sm font-bold text-foreground">{thread.replyCount}</p>
                      <p className="text-[10px] text-foreground/30">respuestas</p>
                    </div>
                    {thread.lastReplyBy && (
                      <div className="hidden sm:block max-w-[120px]">
                        <p className="text-[11px] text-foreground/50 truncate">{thread.lastReplyBy}</p>
                        <p className="text-[10px] text-foreground/30">
                          {thread.lastReplyAt && formatDate(thread.lastReplyAt)}
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
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffDays === 0) {
    return date.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
  }
  if (diffDays < 7) return `hace ${diffDays}d`
  return date.toLocaleDateString("es-CL", { day: "numeric", month: "short" })
}
