"use client"
import { systemConfirm } from "@/components/ui/system-modal"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AdminLayout } from "@/components/admin-layout"

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  order: number
  threadCount: number
}

export default function AdminForumPage() {
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [newOrder, setNewOrder] = useState(0)

  // Thread creation
  const [threadCategoryId, setThreadCategoryId] = useState("")
  const [threadTitle, setThreadTitle] = useState("")
  const [threadContent, setThreadContent] = useState("")

  const { data } = useQuery({
    queryKey: ["forum-categories"],
    queryFn: async () => {
      const res = await fetch("/api/forum/categories")
      if (!res.ok) return { categories: [] }
      return res.json()
    },
    staleTime: 30 * 1000,
  })

  const categories: Category[] = data?.categories || []

  const createCategoryMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/forum/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null, order: newOrder }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      return res.json()
    },
    onSuccess: () => {
      setNewName("")
      setNewDesc("")
      setNewOrder(0)
      queryClient.invalidateQueries({ queryKey: ["forum-categories"] })
    },
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: async (slug: string) => {
      const res = await fetch(`/api/forum/categories/${slug}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forum-categories"] })
    },
  })

  const createThreadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/forum/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: threadCategoryId,
          title: threadTitle.trim(),
          content: threadContent.trim(),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      return res.json()
    },
    onSuccess: () => {
      setThreadTitle("")
      setThreadContent("")
      setThreadCategoryId("")
      queryClient.invalidateQueries({ queryKey: ["forum-categories"] })
    },
  })

  return (
    <AdminLayout title="Foro" subtitle="Administrar categorías e hilos del foro">
      <div className="space-y-6 p-6">
        {/* Create category */}
        <div className="bg-[var(--qc-bg-pure)] rounded-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/40 mb-4">Nueva Categoría</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!newName.trim()) return
              createCategoryMutation.mutate()
            }}
            className="flex flex-wrap gap-3"
          >
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre"
              className="flex-1 min-w-[150px] rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2 text-sm text-foreground placeholder:text-foreground/25 focus:border-foreground/[0.18] focus:outline-none"
            />
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Descripción (opcional)"
              className="flex-1 min-w-[200px] rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2 text-sm text-foreground placeholder:text-foreground/25 focus:border-foreground/[0.18] focus:outline-none"
            />
            <input
              type="number"
              value={newOrder}
              onChange={(e) => setNewOrder(parseInt(e.target.value) || 0)}
              placeholder="Orden"
              className="w-20 rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2 text-sm text-foreground placeholder:text-foreground/25 focus:border-foreground/[0.18] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newName.trim() || createCategoryMutation.isPending}
              className="rounded-lg bg-foreground px-4 py-2 text-xs font-bold uppercase tracking-wider text-background transition-colors hover:opacity-90 disabled:opacity-40"
            >
              Crear
            </button>
          </form>
          {createCategoryMutation.isError && (
            <p className="text-xs text-red-600 mt-2">{(createCategoryMutation.error as Error).message}</p>
          )}
        </div>

        {/* Category list */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/40 mb-3">
            Categorías ({categories.length})
          </h3>
          {categories.length === 0 ? (
            <p className="text-sm text-foreground/40">No hay categorías.</p>
          ) : (
            <div className="space-y-2">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between bg-[var(--qc-bg-pure)] rounded-xl px-5 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{cat.name}</p>
                    <p className="text-[11px] text-foreground/40">
                      /{cat.slug} · {cat.threadCount} hilos · orden: {cat.order}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      if (await systemConfirm(`¿Eliminar categoría "${cat.name}" y todos sus hilos?`)) {
                        deleteCategoryMutation.mutate(cat.slug)
                      }
                    }}
                    className="text-[10px] font-bold uppercase px-2 py-1 rounded text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create thread */}
        <div className="bg-[var(--qc-bg-pure)] rounded-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/40 mb-4">Nuevo Hilo</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!threadCategoryId || !threadTitle.trim() || !threadContent.trim()) return
              createThreadMutation.mutate()
            }}
            className="space-y-3"
          >
            <select
              value={threadCategoryId}
              onChange={(e) => setThreadCategoryId(e.target.value)}
              className="w-full rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2 text-sm text-foreground focus:border-foreground/[0.18] focus:outline-none"
            >
              <option value="">Seleccionar categoría...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <input
              type="text"
              value={threadTitle}
              onChange={(e) => setThreadTitle(e.target.value)}
              placeholder="Título del hilo"
              maxLength={200}
              className="w-full rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2 text-sm text-foreground placeholder:text-foreground/25 focus:border-foreground/[0.18] focus:outline-none"
            />
            <textarea
              value={threadContent}
              onChange={(e) => setThreadContent(e.target.value)}
              placeholder="Contenido del hilo..."
              maxLength={5000}
              rows={5}
              className="w-full rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2 text-sm text-foreground placeholder:text-foreground/25 focus:border-foreground/[0.18] focus:outline-none resize-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-foreground/30">{threadContent.length}/5000</span>
              <button
                type="submit"
                disabled={!threadCategoryId || !threadTitle.trim() || !threadContent.trim() || createThreadMutation.isPending}
                className="rounded-lg bg-foreground px-4 py-2 text-xs font-bold uppercase tracking-wider text-background transition-colors hover:opacity-90 disabled:opacity-40"
              >
                {createThreadMutation.isPending ? "Creando..." : "Crear Hilo"}
              </button>
            </div>
          </form>
          {createThreadMutation.isError && (
            <p className="text-xs text-red-600 mt-2">{(createThreadMutation.error as Error).message}</p>
          )}
          {createThreadMutation.isSuccess && (
            <p className="text-xs text-green-600 mt-2">Hilo creado exitosamente</p>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
