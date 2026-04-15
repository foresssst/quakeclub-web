"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { LoadingScreen } from "@/components/loading-screen"

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
  closedAt: string | null
  options: PollOption[]
}

export default function EncuestasPage() {
  const [tab, setTab] = useState<"ACTIVE" | "CLOSED">("ACTIVE")

  const { data, isFetched } = useQuery({
    queryKey: ["polls", tab],
    queryFn: async () => {
      const res = await fetch(`/api/polls?status=${tab}`)
      if (!res.ok) return { polls: [] }
      return res.json()
    },
    staleTime: 30 * 1000,
  })

  const polls: Poll[] = data?.polls || []

  if (!isFetched) return <LoadingScreen />

  return (
    <main className="container mx-auto px-2 sm:px-4 max-w-[1100px] pb-16 pt-3 sm:pt-10 relative z-10 animate-fade-up">
      <div className="glass-card-elevated rounded-xl overflow-hidden animate-scale-fade">
        {/* Header */}
        <div className="p-4 sm:p-6 lg:p-8 pb-0 sm:pb-0 lg:pb-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6 pb-4 border-b border-foreground/[0.06]">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#333] flex items-center gap-2">
              <span className="w-1 h-3 bg-foreground/20 rounded-full" />
              Encuestas
            </h2>
            <div className="sm:ml-auto flex items-center gap-0.5 bg-secondary rounded-lg p-0.5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08) inset" }}>
              {(["ACTIVE", "CLOSED"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all rounded-md ${
                    tab === t
                      ? "bg-[#d8d8de] text-foreground shadow-sm"
                      : "text-[#333] hover:text-foreground"
                  }`}
                >
                  {t === "ACTIVE" ? "Activas" : "Cerradas"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Poll list */}
        <div className="p-4 sm:p-6 lg:p-8 pt-0 sm:pt-0 lg:pt-0">
          {polls.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[10px] text-[#333] uppercase tracking-wider">
                {tab === "ACTIVE" ? "No hay encuestas activas" : "No hay encuestas cerradas"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {polls.map((poll) => {
                const topOption = poll.options.reduce((max, o) => o.voteCount > max.voteCount ? o : max, poll.options[0])
                const topPct = poll.totalVotes > 0 ? Math.round((topOption.voteCount / poll.totalVotes) * 100) : 0

                return (
                  <Link
                    key={poll.id}
                    href={`/encuestas/${poll.id}`}
                    className="flex gap-3 sm:gap-4 p-3 sm:p-4 bg-[var(--qc-bg-pure)] hover:bg-card border border-black/[0.05] hover:border-foreground/[0.08] rounded-lg transition-all group"
                    style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
                  >
                    {/* Vote count box */}
                    <div className="flex-shrink-0 w-14 h-14 rounded-lg bg-foreground flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-base font-bold text-white leading-none">{poll.totalVotes}</p>
                        <p className="text-[7px] text-white/40 uppercase tracking-wider mt-0.5">votos</p>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${
                          poll.status === "ACTIVE"
                            ? "bg-emerald-500/15 text-emerald-600"
                            : "bg-foreground/[0.06] text-black/35"
                        }`}>
                          {poll.status === "ACTIVE" ? "Activa" : "Cerrada"}
                        </span>
                        <span className="text-[9px] text-[#333] uppercase">{formatDate(poll.createdAt)}</span>
                      </div>
                      <h3 className="text-sm font-bold text-foreground group-hover:text-[#333] uppercase tracking-wide truncate">
                        {poll.title}
                      </h3>
                      {poll.description && (
                        <p className="text-[10px] text-foreground/40 mt-0.5 line-clamp-1 normal-case">{poll.description}</p>
                      )}

                      {/* Mini bar */}
                      {poll.totalVotes > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1 h-1 bg-foreground/[0.04] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-foreground/40 rounded-full"
                              style={{ width: `${topPct}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-[#333] font-medium flex-shrink-0">{topOption.text} · {topPct}%</span>
                        </div>
                      )}
                    </div>

                    {/* Arrow */}
                    <div className="flex-shrink-0 flex items-center">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[#333] opacity-30 group-hover:opacity-60 transition-opacity">
                        <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })
}
