"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PlayerAvatar } from "@/components/player-avatar"

interface Comment {
  id: string
  newsId: string
  steamId: string
  username: string
  avatar: string | null
  content: string
  createdAt: string
}

interface Props {
  newsId: string
}

export function NewsComments({ newsId }: Props) {
  const queryClient = useQueryClient()
  const [content, setContent] = useState("")

  const { data: session } = useQuery({
    queryKey: ["auth-session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session")
      if (!res.ok) return null
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data, isFetched } = useQuery({
    queryKey: ["comments", newsId],
    queryFn: async () => {
      const res = await fetch(`/api/comments?newsId=${newsId}`)
      if (!res.ok) return { comments: [], total: 0 }
      return res.json()
    },
    staleTime: 30 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newsId, content: text }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al comentar")
      }
      return res.json()
    },
    onSuccess: () => {
      setContent("")
      queryClient.invalidateQueries({ queryKey: ["comments", newsId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await fetch(`/api/comments/${commentId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", newsId] })
    },
  })

  const comments: Comment[] = data?.comments || []
  const user = session?.user

  const formatDate = (dateStr: string) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || createMutation.isPending) return
    createMutation.mutate(content.trim())
  }

  return (
    <div className="bg-card shadow-sm border border-foreground/[0.06] rounded-xl overflow-hidden normal-case">
      <div className="px-6 sm:px-8 py-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/40 mb-4">
          Comentarios ({data?.total || 0})
        </h3>

        {/* Comment form */}
        {user?.steamId ? (
          <form onSubmit={handleSubmit} className="mb-6">
            <div className="flex gap-3">
              <div className="flex-shrink-0 mt-1">
                <PlayerAvatar steamId={user.steamId} playerName={user.username} size="sm" />
              </div>
              <div className="flex-1">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Escribe un comentario..."
                  maxLength={2000}
                  rows={3}
                  className="w-full rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2 text-sm text-foreground/85 placeholder:text-foreground/25 focus:border-foreground/[0.18] focus:outline-none resize-none"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-foreground/30">{content.length}/2000</span>
                  <button
                    type="submit"
                    disabled={!content.trim() || createMutation.isPending}
                    className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-background transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {createMutation.isPending ? "Enviando..." : "Comentar"}
                  </button>
                </div>
                {createMutation.isError && (
                  <p className="text-xs text-red-600 mt-1">{(createMutation.error as Error).message}</p>
                )}
              </div>
            </div>
          </form>
        ) : (
          <div className="mb-6 text-center py-4 bg-foreground/[0.03] rounded-lg">
            <p className="text-sm text-foreground/50">
              <Link href="/login" className="text-foreground font-semibold hover:underline">
                Inicia sesión con Steam
              </Link>
              {" "}para comentar
            </p>
          </div>
        )}

        {/* Comments list */}
        {!isFetched ? (
          <div className="text-center py-8 text-foreground/30 text-sm">Cargando comentarios...</div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-foreground/30 text-sm">
            No hay comentarios aún. Sé el primero en comentar.
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 group">
                <Link href={`/perfil/${comment.steamId}`} className="flex-shrink-0">
                  <PlayerAvatar steamId={comment.steamId} playerName={comment.username} size="sm" />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/perfil/${comment.steamId}`}
                      className="text-sm font-semibold text-foreground/80 hover:text-foreground transition-colors"
                    >
                      {comment.username}
                    </Link>
                    <span className="text-[10px] text-foreground/30">{formatDate(comment.createdAt)}</span>
                    {(user?.isAdmin || user?.steamId === comment.steamId) && (
                      <button
                        onClick={() => {
                          if (confirm("¿Eliminar este comentario?")) {
                            deleteMutation.mutate(comment.id)
                          }
                        }}
                        className="text-[10px] text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                      >
                        eliminar
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-foreground/60 mt-0.5 whitespace-pre-wrap break-words">{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
