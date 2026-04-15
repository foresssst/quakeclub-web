"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { LoadingScreen } from "@/components/loading-screen"

interface PollOption {
  id: string
  text: string
  voteCount: number
  order: number
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

const BAR_COLORS = [
  "bg-foreground",
  "bg-[#8b7355]",
  "bg-[#4a5568]",
  "bg-[#6b4c3b]",
  "bg-[#3b4a5c]",
  "bg-[#5c4a6b]",
  "bg-[#4a6b5c]",
  "bg-[#6b5c4a]",
]

export default function EncuestaDetailPage() {
  const params = useParams()
  const pollId = params.id as string
  const queryClient = useQueryClient()
  const [selectedOption, setSelectedOption] = useState<string | null>(null)

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
    queryKey: ["poll", pollId],
    queryFn: async () => {
      const res = await fetch(`/api/polls/${pollId}`)
      if (!res.ok) return null
      return res.json()
    },
    staleTime: 15 * 1000,
  })

  const voteMutation = useMutation({
    mutationFn: async (optionId: string) => {
      const res = await fetch(`/api/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al votar")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["poll", pollId] })
    },
  })

  const closeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/polls/${pollId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      })
      if (!res.ok) throw new Error("Error")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["poll", pollId] })
    },
  })

  const poll: Poll | null = data?.poll || null
  const userVote: string | null = data?.userVote || null
  const user = session?.user
  const isAdmin = user?.isAdmin
  const hasVoted = !!userVote
  const showResults = hasVoted || poll?.status === "CLOSED" || !user?.steamId

  if (!isFetched) return <LoadingScreen />

  if (!poll) {
    return (
      <div className="container mx-auto py-12 text-center">
        <p className="text-[#333]">Encuesta no encontrada</p>
        <Link href="/encuestas" className="text-sm text-foreground hover:underline mt-2 inline-block">
          Volver a encuestas
        </Link>
      </div>
    )
  }

  const sortedOptions = showResults
    ? [...poll.options].sort((a, b) => b.voteCount - a.voteCount)
    : poll.options

  return (
    <main className="container mx-auto px-2 sm:px-4 max-w-[1100px] pb-16 pt-3 sm:pt-10 relative z-10 animate-fade-up">
      <div className="glass-card-elevated rounded-xl overflow-hidden animate-scale-fade">
        {/* Header */}
        <div className="p-4 sm:p-6 lg:p-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-[10px] text-[#333] uppercase tracking-wider mb-4">
            <Link href="/encuestas" className="hover:text-foreground transition-colors">Encuestas</Link>
            <svg width="8" height="8" viewBox="0 0 12 12" fill="none" className="opacity-30">
              <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-foreground truncate max-w-[200px]">{poll.title}</span>
          </div>

          {/* Title section */}
          <div className="flex items-start justify-between gap-4 pb-5 border-b border-foreground/[0.06]">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${
                  poll.status === "ACTIVE"
                    ? "bg-emerald-500/15 text-emerald-600"
                    : "bg-foreground/[0.06] text-black/35"
                }`}>
                  {poll.status === "ACTIVE" ? "Activa" : "Cerrada"}
                </span>
                <span className="text-[9px] text-[#333] uppercase">{formatDate(poll.createdAt)}</span>
              </div>
              <h1 className="font-tiktok text-lg sm:text-xl font-bold uppercase tracking-wider text-foreground">
                {poll.title}
              </h1>
              {poll.description && (
                <p className="text-sm text-[#333] mt-1 normal-case">{poll.description}</p>
              )}
            </div>

            {/* Vote counter */}
            <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-foreground flex items-center justify-center">
              <div className="text-center">
                <p className="text-xl font-bold text-white leading-none">{poll.totalVotes}</p>
                <p className="text-[7px] text-white/40 uppercase tracking-wider mt-0.5">votos</p>
              </div>
            </div>
          </div>

          {isAdmin && poll.status === "ACTIVE" && (
            <div className="pt-3 pb-1">
              <button
                onClick={() => {
                  if (confirm("¿Cerrar esta encuesta? No se aceptarán más votos.")) closeMutation.mutate()
                }}
                className="text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
              >
                Cerrar encuesta
              </button>
            </div>
          )}
        </div>

        {/* Options / Results */}
        <div className="px-4 sm:px-6 lg:px-8 pb-6 sm:pb-8">
          {showResults ? (
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#333] flex items-center gap-2 mb-4">
                <span className="w-1 h-3 bg-foreground/20 rounded-full" />
                Resultados
              </h3>
              {sortedOptions.map((option, idx) => {
                const pct = poll.totalVotes > 0 ? (option.voteCount / poll.totalVotes) * 100 : 0
                const isUserChoice = userVote === option.id
                const isWinner = idx === 0 && poll.totalVotes > 0
                const barColor = BAR_COLORS[idx % BAR_COLORS.length]

                return (
                  <div
                    key={option.id}
                    className={`p-3 sm:p-4 rounded-lg border transition-all ${
                      isUserChoice
                        ? "bg-card border-foreground/[0.08]"
                        : "bg-card/60 border-foreground/[0.04]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isWinner && (
                          <span className="text-[8px] font-bold uppercase bg-foreground text-white px-1.5 py-0.5 rounded-sm flex-shrink-0">
                            #1
                          </span>
                        )}
                        <span className={`text-sm truncate normal-case ${isUserChoice ? "font-bold text-foreground" : "text-[#333]"}`}>
                          {option.text}
                        </span>
                        {isUserChoice && (
                          <span className="text-[8px] font-bold uppercase bg-foreground/10 text-foreground px-1.5 py-0.5 rounded-sm flex-shrink-0">
                            Tu voto
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                        <span className="text-sm font-bold text-foreground">{pct.toFixed(0)}%</span>
                        <span className="text-[10px] text-[#333]">({option.voteCount})</span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-1.5 bg-foreground/[0.04] rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColor} rounded-full transition-all duration-700 ease-out ${
                          isUserChoice ? "opacity-100" : "opacity-60"
                        }`}
                        style={{ width: `${Math.max(pct, 1)}%` }}
                      />
                    </div>
                  </div>
                )
              })}

              {/* Login prompt */}
              {!user?.steamId && poll.status === "ACTIVE" && (
                <div className="text-center pt-3">
                  <p className="text-sm text-[#333] normal-case">
                    <Link href="/login" className="text-foreground font-bold hover:underline">
                      Inicia sesión con Steam
                    </Link>
                    {" "}para votar
                  </p>
                </div>
              )}

              {/* Summary */}
              <div className="text-center pt-3 border-t border-foreground/[0.04]">
                <p className="text-[10px] text-[#333] uppercase tracking-wider">
                  {poll.totalVotes} {poll.totalVotes === 1 ? "voto total" : "votos totales"}
                </p>
              </div>
            </div>
          ) : (
            /* Voting form */
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!selectedOption || voteMutation.isPending) return
                voteMutation.mutate(selectedOption)
              }}
            >
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#333] flex items-center gap-2 mb-4">
                <span className="w-1 h-3 bg-foreground/20 rounded-full" />
                Selecciona una opción
              </h3>
              <div className="space-y-2">
                {poll.options.map((option) => (
                  <label
                    key={option.id}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-lg cursor-pointer transition-all ${
                      selectedOption === option.id
                        ? "bg-foreground text-white"
                        : "bg-card/60 text-[#333] hover:bg-card border border-foreground/[0.04] hover:border-foreground/[0.08]"
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      selectedOption === option.id
                        ? "border-white"
                        : "border-black/15"
                    }`}>
                      {selectedOption === option.id && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <span className={`text-sm normal-case ${
                      selectedOption === option.id ? "text-white font-medium" : "text-[#333]"
                    }`}>
                      {option.text}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end mt-5">
                <button
                  type="submit"
                  disabled={!selectedOption || voteMutation.isPending}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white bg-foreground hover:bg-[#333338] rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  {voteMutation.isPending ? "Votando..." : "Confirmar Voto"}
                </button>
              </div>
              {voteMutation.isError && (
                <p className="text-xs text-red-600 mt-2 text-center">{(voteMutation.error as Error).message}</p>
              )}
            </form>
          )}
        </div>
      </div>
    </main>
  )
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })
}
