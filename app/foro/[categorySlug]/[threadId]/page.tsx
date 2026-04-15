"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { LoadingScreen } from "@/components/loading-screen"

interface Reply {
  id: string
  steamId: string
  username: string
  avatar: string | null
  content: string
  createdAt: string
}

export default function ThreadPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const slug = params.categorySlug as string
  const threadId = params.threadId as string

  const [replyContent, setReplyContent] = useState("")

  const { data: session } = useQuery({
    queryKey: ["auth-session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session")
      if (!res.ok) return null
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: threadData, isFetched } = useQuery({
    queryKey: ["forum-thread", threadId],
    queryFn: async () => {
      const res = await fetch(`/api/forum/threads/${threadId}`)
      if (!res.ok) return null
      return res.json()
    },
    staleTime: 30 * 1000,
  })

  const { data: repliesData } = useQuery({
    queryKey: ["forum-replies", threadId],
    queryFn: async () => {
      const res = await fetch(`/api/forum/threads/${threadId}/replies?limit=50`)
      if (!res.ok) return { replies: [] }
      return res.json()
    },
    staleTime: 15 * 1000,
    enabled: !!threadId,
  })

  const replyMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/forum/threads/${threadId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al responder")
      }
      return res.json()
    },
    onSuccess: () => {
      setReplyContent("")
      queryClient.invalidateQueries({ queryKey: ["forum-replies", threadId] })
      queryClient.invalidateQueries({ queryKey: ["forum-thread", threadId] })
    },
  })

  const deleteReplyMutation = useMutation({
    mutationFn: async (replyId: string) => {
      const res = await fetch(`/api/forum/replies/${replyId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forum-replies", threadId] })
      queryClient.invalidateQueries({ queryKey: ["forum-thread", threadId] })
    },
  })

  const adminMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`/api/forum/threads/${threadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Error")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forum-thread", threadId] })
    },
  })

  const deleteThreadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/forum/threads/${threadId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error")
      return res.json()
    },
    onSuccess: () => {
      router.push(`/foro/${slug}`)
    },
  })

  const thread = threadData?.thread
  const replies: Reply[] = repliesData?.replies || []
  const user = session?.user
  const isAdmin = user?.isAdmin

  if (!isFetched) return <LoadingScreen />
  if (!thread) {
    return (
      <div className="container mx-auto py-12 text-center">
        <p className="text-foreground/40">Hilo no encontrado</p>
        <Link href="/foro" className="text-sm text-foreground hover:underline mt-2 inline-block">
          Volver al foro
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 sm:py-8 px-3 sm:px-4 max-w-[1400px] pt-8 sm:pt-12">
      <div className="max-w-4xl mx-auto space-y-4 animate-fade-up">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-foreground/40 px-1">
          <Link href="/foro" className="hover:text-foreground/60 transition-colors">Foro</Link>
          <span>/</span>
          <Link href={`/foro/${slug}`} className="hover:text-foreground/60 transition-colors">
            {thread.category?.name || slug}
          </Link>
          <span>/</span>
          <span className="text-foreground/60 truncate max-w-[200px]">{thread.title}</span>
        </div>

        {/* Thread header + original post */}
        <div className="bg-card shadow-sm border border-foreground/[0.06] rounded-xl overflow-hidden">
          <div className="px-6 py-5 border-b border-foreground/[0.06] bg-[#d4d4d9]">
            <div className="flex items-center gap-2 mb-1">
              {thread.isPinned && (
                <span className="text-[9px] font-bold uppercase bg-foreground text-white px-1.5 py-0.5 rounded">Fijado</span>
              )}
              {thread.status === "CLOSED" && (
                <span className="text-[9px] font-bold uppercase bg-red-500/80 text-white px-1.5 py-0.5 rounded">Cerrado</span>
              )}
            </div>
            <h1 className="font-tiktok text-xl sm:text-2xl font-bold uppercase tracking-wider text-foreground">
              {thread.title}
            </h1>

            {/* Admin controls */}
            {isAdmin && (
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => adminMutation.mutate({ isPinned: !thread.isPinned })}
                  className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-foreground/[0.06] hover:bg-black/[0.1] transition-colors"
                >
                  {thread.isPinned ? "Desfijar" : "Fijar"}
                </button>
                <button
                  onClick={() => adminMutation.mutate({ status: thread.status === "CLOSED" ? "OPEN" : "CLOSED" })}
                  className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-foreground/[0.06] hover:bg-black/[0.1] transition-colors"
                >
                  {thread.status === "CLOSED" ? "Reabrir" : "Cerrar"}
                </button>
                <button
                  onClick={() => {
                    if (confirm("¿Eliminar este hilo y todas sus respuestas?")) {
                      deleteThreadMutation.mutate()
                    }
                  }}
                  className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
                >
                  Eliminar hilo
                </button>
              </div>
            )}
          </div>

          {/* Original post */}
          <div className="px-6 py-5">
            <div className="flex gap-3">
              <Link href={`/perfil/${thread.steamId}`}>
                <img
                  src={thread.avatar || "/placeholders/default-avatar.png"}
                  alt={thread.username}
                  className="w-10 h-10 rounded-full flex-shrink-0 hover:ring-2 hover:ring-black/10 transition-all"
                />
              </Link>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/perfil/${thread.steamId}`}
                    className="text-sm font-bold text-foreground hover:underline"
                  >
                    {thread.username}
                  </Link>
                  <span className="text-[10px] text-foreground/30">{formatDate(thread.createdAt)}</span>
                </div>
                <div className="mt-2 text-sm text-foreground/70 whitespace-pre-wrap break-words leading-relaxed">
                  {thread.content}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Replies */}
        {replies.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-foreground/30 px-1">
              {thread.replyCount} {thread.replyCount === 1 ? "respuesta" : "respuestas"}
            </h3>
            {replies.map((reply) => (
              <div key={reply.id} className="bg-card shadow-sm border border-foreground/[0.06] rounded-xl px-6 py-4 group">
                <div className="flex gap-3">
                  <Link href={`/perfil/${reply.steamId}`}>
                    <img
                      src={reply.avatar || "/placeholders/default-avatar.png"}
                      alt={reply.username}
                      className="w-8 h-8 rounded-full flex-shrink-0 hover:ring-2 hover:ring-black/10 transition-all"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/perfil/${reply.steamId}`}
                        className="text-sm font-semibold text-foreground/80 hover:text-foreground transition-colors"
                      >
                        {reply.username}
                      </Link>
                      <span className="text-[10px] text-foreground/30">{formatDate(reply.createdAt)}</span>
                      {(isAdmin || user?.steamId === reply.steamId) && (
                        <button
                          onClick={() => {
                            if (confirm("¿Eliminar esta respuesta?")) {
                              deleteReplyMutation.mutate(reply.id)
                            }
                          }}
                          className="text-[10px] text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                        >
                          eliminar
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-foreground/60 mt-1 whitespace-pre-wrap break-words">{reply.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reply form */}
        {thread.status === "CLOSED" ? (
          <div className="bg-card shadow-sm border border-foreground/[0.06] rounded-xl px-6 py-4 text-center">
            <p className="text-sm text-foreground/40">Este hilo está cerrado. No se aceptan más respuestas.</p>
          </div>
        ) : user?.steamId ? (
          <div className="bg-card shadow-sm border border-foreground/[0.06] rounded-xl px-6 py-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/40 mb-3">Responder</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!replyContent.trim() || replyMutation.isPending) return
                replyMutation.mutate(replyContent.trim())
              }}
            >
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Escribe tu respuesta..."
                maxLength={5000}
                rows={4}
                className="w-full bg-white/60 border border-foreground/[0.08] rounded-lg px-3 py-2 text-sm text-foreground/80 placeholder:text-foreground/30 focus:outline-none focus:border-black/20 resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-foreground/30">{replyContent.length}/5000</span>
                <button
                  type="submit"
                  disabled={!replyContent.trim() || replyMutation.isPending}
                  className="px-4 py-1.5 bg-foreground text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-[#333338] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {replyMutation.isPending ? "Enviando..." : "Responder"}
                </button>
              </div>
              {replyMutation.isError && (
                <p className="text-xs text-red-600 mt-1">{(replyMutation.error as Error).message}</p>
              )}
            </form>
          </div>
        ) : (
          <div className="bg-card shadow-sm border border-foreground/[0.06] rounded-xl px-6 py-5 text-center">
            <p className="text-sm text-foreground/50">
              <Link href="/login" className="text-foreground font-semibold hover:underline">
                Inicia sesión con Steam
              </Link>
              {" "}para responder
            </p>
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
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "ahora"
  if (diffMins < 60) return `hace ${diffMins}m`
  if (diffHours < 24) return `hace ${diffHours}h`
  if (diffDays < 7) return `hace ${diffDays}d`
  return date.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })
}
