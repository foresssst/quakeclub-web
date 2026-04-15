"use client"
import { systemConfirm } from "@/components/ui/system-modal"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AdminLayout } from "@/components/admin-layout"

interface PollOption {
  id: string
  text: string
  voteCount: number
}

interface Poll {
  id: string
  title: string
  description: string | null
  status: string
  totalVotes: number
  createdAt: string
  options: PollOption[]
}

export default function AdminPollsPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [options, setOptions] = useState(["", ""])

  // Auth guard
  const { data: authData } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me")
      if (!res.ok) {
        router.push("/login?returnTo=/admin/polls")
        throw new Error("Not authenticated")
      }
      const data = await res.json()
      if (!data.user.isAdmin) {
        router.push("/")
        throw new Error("Not admin")
      }
      return data
    },
    staleTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  })

  const { data } = useQuery({
    queryKey: ["polls"],
    queryFn: async () => {
      const res = await fetch("/api/polls")
      if (!res.ok) return { polls: [] }
      return res.json()
    },
    staleTime: 30 * 1000,
    enabled: !!authData?.user?.isAdmin,
  })

  const polls: Poll[] = data?.polls || []

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          options: options.filter((o) => o.trim()),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      return res.json()
    },
    onSuccess: () => {
      setTitle("")
      setDescription("")
      setOptions(["", ""])
      queryClient.invalidateQueries({ queryKey: ["polls"] })
    },
  })

  const closeMutation = useMutation({
    mutationFn: async (pollId: string) => {
      const res = await fetch(`/api/polls/${pollId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      })
      if (!res.ok) throw new Error("Error")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["polls"] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (pollId: string) => {
      const res = await fetch(`/api/polls/${pollId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["polls"] })
    },
  })

  const addOption = () => {
    if (options.length < 10) setOptions([...options, ""])
  }

  const removeOption = (index: number) => {
    if (options.length > 2) setOptions(options.filter((_, i) => i !== index))
  }

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  return (
    <AdminLayout title="Encuestas" subtitle="Crear y administrar encuestas">
      <div className="space-y-6 p-6">
        {/* Create poll */}
        <div className="bg-[var(--qc-bg-pure)] rounded-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/40 mb-4">Nueva Encuesta</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!title.trim() || options.filter((o) => o.trim()).length < 2) return
              createMutation.mutate()
            }}
            className="space-y-3"
          >
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título de la encuesta"
              className="w-full rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2 text-sm text-foreground placeholder:text-foreground/25 focus:border-foreground/[0.18] focus:outline-none"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción (opcional)"
              rows={2}
              className="w-full rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2 text-sm text-foreground placeholder:text-foreground/25 focus:border-foreground/[0.18] focus:outline-none resize-none"
            />

            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">Opciones</p>
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    placeholder={`Opción ${i + 1}`}
                    maxLength={200}
                    className="flex-1 rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2 text-sm text-foreground placeholder:text-foreground/25 focus:border-foreground/[0.18] focus:outline-none"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      className="text-red-400 hover:text-red-600 text-xs px-2"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {options.length < 10 && (
                <button
                  type="button"
                  onClick={addOption}
                  className="text-[10px] font-bold uppercase text-foreground/40 hover:text-foreground/60 transition-colors"
                >
                  + Agregar opción
                </button>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!title.trim() || options.filter((o) => o.trim()).length < 2 || createMutation.isPending}
                className="rounded-lg bg-foreground px-4 py-2 text-xs font-bold uppercase tracking-wider text-background transition-colors hover:opacity-90 disabled:opacity-40"
              >
                {createMutation.isPending ? "Creando..." : "Crear Encuesta"}
              </button>
            </div>
          </form>
          {createMutation.isError && (
            <p className="text-xs text-red-600 mt-2">{(createMutation.error as Error).message}</p>
          )}
          {createMutation.isSuccess && (
            <p className="text-xs text-green-600 mt-2">Encuesta creada exitosamente</p>
          )}
        </div>

        {/* Poll list */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/40 mb-3">
            Encuestas ({polls.length})
          </h3>
          {polls.length === 0 ? (
            <p className="text-sm text-foreground/40">No hay encuestas.</p>
          ) : (
            <div className="space-y-2">
              {polls.map((poll) => (
                <div
                  key={poll.id}
                  className="bg-[var(--qc-bg-pure)] rounded-xl px-5 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            poll.status === "ACTIVE"
                              ? "bg-green-500/10 text-green-600"
                              : "bg-foreground/[0.06] text-foreground/40"
                          }`}
                        >
                          {poll.status === "ACTIVE" ? "Activa" : "Cerrada"}
                        </span>
                        <p className="text-sm font-semibold text-foreground truncate">{poll.title}</p>
                      </div>
                      <p className="text-[11px] text-foreground/40 mt-1">
                        {poll.totalVotes} votos · {poll.options.length} opciones ·{" "}
                        {new Date(poll.createdAt).toLocaleDateString("es-CL")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {poll.status === "ACTIVE" && (
                        <button
                          onClick={() => closeMutation.mutate(poll.id)}
                          className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-foreground/[0.06] hover:bg-black/[0.1] transition-colors"
                        >
                          Cerrar
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (await systemConfirm(`¿Eliminar encuesta "${poll.title}"?`)) {
                            deleteMutation.mutate(poll.id)
                          }
                        }}
                        className="text-[10px] font-bold uppercase px-2 py-1 rounded text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
