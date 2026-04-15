"use client"

import { useState, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import type { PatchNote, PatchNoteMention } from "@/types/patchnote"
import { ContentContainer, ContentHeader } from "@/components/ui/content-container"
import { LoadingScreen } from "@/components/loading-screen"
import ReactMarkdown from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"

  // Generar slug desde el título
  const toSlug = (title: string) =>
    title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

export default function PatchNotesPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [hashHandled, setHashHandled] = useState(false)

  const { data: notesData, isLoading } = useQuery({
    queryKey: ["patchnotes"],
    queryFn: async () => {
      const res = await fetch("/api/patchnotes/list")
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      return data.notes || []
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  })

  const notes: PatchNote[] = notesData || []

  // Si hay un hash en la URL, expandir ese patch note y hacer scroll
  useEffect(() => {
    if (hashHandled || notes.length === 0) return
    const hash = window.location.hash.slice(1)
    if (!hash) { setHashHandled(true); return }
    const match = notes.find((n) => toSlug(n.title) === hash || `v${n.version}` === hash)
    if (match) {
      setExpandedId(match.id)
      setTimeout(() => {
        document.getElementById(`patch-${match.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 100)
    }
    setHashHandled(true)
  }, [notes, hashHandled])

  const effectiveExpanded = expandedId ?? (notes.length > 0 ? notes[0].id : null)

  // Marcar como leído al visitar la página
  useEffect(() => {
    if (notes.length > 0) {
      localStorage.setItem("patchnotes-seen-version", notes[0].version)
    }
  }, [notes])

  // Procesar menciones @steamId en el contenido, reemplazándolas por markdown links
  const processContent = (content: string, mentions?: PatchNoteMention[]) => {
    if (!mentions || mentions.length === 0) return content
    const mentionMap = new Map(mentions.map((m) => [m.steamId, m]))
    return content.replace(/@(7656119\d{10})/g, (_, steamId) => {
      const m = mentionMap.get(steamId)
      return m ? `[@${m.name}](/perfil/${steamId})` : `@${steamId}`
    })
  }

  const formatDate = (date: string) => {
    const [year, month, day] = date.split("-").map(Number)
    const d = new Date(year, month - 1, day)
    return d.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })
  }

  return (
    <div className="relative min-h-screen">
      <div className="container mx-auto px-2 sm:px-4 max-w-[1080px] pb-16 pt-4 sm:pt-8 relative z-10 animate-fade-up">
        <div className="max-w-[860px] mx-auto space-y-4">
          <ContentContainer className="animate-scale-fade">
            <ContentHeader className="flex items-center justify-between">
              <div>
                <h1 className="font-tiktok text-lg sm:text-xl font-bold uppercase tracking-wide text-foreground">
                  Patch Notes
                </h1>
                <p className="mt-1 text-[10px] tracking-wide text-[var(--qc-text-muted)]">
                  Historial de cambios y mejoras de la plataforma
                </p>
              </div>
              {notes.length > 0 && (
                <span className="text-[10px] font-mono text-[var(--qc-text-subtle)] tracking-wide">
                  v{notes[0].version}
                </span>
              )}
            </ContentHeader>

            <div className="p-3 sm:p-5">
              {isLoading ? (
                <LoadingScreen compact />
              ) : notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center border border-foreground/[0.04] bg-foreground/[0.02] py-16 rounded-xl">
                  <p className="text-[13px] text-[var(--qc-text-muted)]">No hay patch notes publicados</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notes.map((note, index) => {
                    const isExpanded = effectiveExpanded === note.id
                    const isLatest = index === 0

                    return (
                      <div key={note.id} id={`patch-${note.id}`} className="animate-scale-fade" style={{ animationDelay: `${index * 40}ms` }}>
                        <button
                          onClick={() => setExpandedId(isExpanded && expandedId !== null ? '__none__' : note.id)}
                          className={`w-full text-left rounded-xl border transition-all duration-200 ${
                            isExpanded
                              ? "border-foreground/[0.08] bg-[var(--qc-bg-pure)]"
                              : "border-foreground/[0.04] bg-foreground/[0.02] hover:border-foreground/[0.08] hover:bg-foreground/[0.03]"
                          }`}
                        >
                          {/* Header */}
                          <div className="px-4 sm:px-5 py-3.5 sm:py-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={`shrink-0 inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider font-mono ${
                                isLatest
                                  ? "bg-foreground/[0.10] text-foreground"
                                  : "bg-foreground/[0.05] text-[var(--qc-text-muted)]"
                              }`}>
                                v{note.version}
                              </span>
                              <h2 className="text-[13px] sm:text-[14px] font-bold text-foreground truncate">
                                {note.title}
                              </h2>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-[10px] text-[var(--qc-text-subtle)] tracking-wide hidden sm:block">
                                {formatDate(note.date)}
                              </span>
                              <svg
                                xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                className={`text-[var(--qc-text-subtle)] transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                              >
                                <path d="m6 9 6 6 6-6"/>
                              </svg>
                            </div>
                          </div>

                          {/* Expanded content */}
                          {isExpanded && (
                            <div className="px-4 sm:px-5 pb-5 sm:pb-6">
                              <div className="border-t border-foreground/[0.06] pt-4 sm:pt-5">
                                {/* Date on mobile */}
                                <div className="flex items-center gap-2 mb-4 sm:hidden">
                                  <span className="text-[10px] text-[var(--qc-text-subtle)] tracking-wide">
                                    {formatDate(note.date)}
                                  </span>
                                </div>

                                <div className="text-[13px] leading-[1.8] text-[var(--qc-text-secondary)] normal-case">
                                  <ReactMarkdown
                                    remarkPlugins={[remarkBreaks, remarkGfm]}
                                    disallowedElements={["script", "iframe", "object", "embed"]}
                                    unwrapDisallowed={true}
                                    components={{
                                      h2: ({ children }) => (
                                        <h2 className="text-[14px] font-bold text-foreground mt-6 mb-2 first:mt-0 uppercase tracking-[0.08em] font-tiktok">
                                          {children}
                                        </h2>
                                      ),
                                      h3: ({ children }) => (
                                        <h3 className="text-[13px] font-bold text-foreground/80 mt-5 mb-2 first:mt-0 uppercase tracking-[0.10em] font-tiktok">
                                          {children}
                                        </h3>
                                      ),
                                      p: ({ children }) => (
                                        <p className="my-2 text-[var(--qc-text-secondary)]">{children}</p>
                                      ),
                                      ul: ({ children }) => (
                                        <ul className="space-y-2 my-3">{children}</ul>
                                      ),
                                      ol: ({ children }) => (
                                        <ol className="space-y-2 my-3 list-decimal pl-5 marker:text-foreground/15">{children}</ol>
                                      ),
                                      li: ({ children }) => (
                                        <li className="flex gap-2 text-[var(--qc-text-secondary)]">
                                          <span className="text-foreground/15 select-none shrink-0 mt-[2px]">–</span>
                                          <span className="flex-1">{children}</span>
                                        </li>
                                      ),
                                      strong: ({ children }) => (
                                        <strong className="text-foreground font-semibold">{children}</strong>
                                      ),
                                      em: ({ children }) => (
                                        <em className="italic text-[var(--qc-text-muted)]">{children}</em>
                                      ),
                                      code: ({ children }) => (
                                        <code className="bg-foreground/[0.06] text-foreground/70 px-1.5 py-0.5 rounded text-[11px] font-mono">
                                          {children}
                                        </code>
                                      ),
                                      a: ({ children, href }) => {
                                        // Mención de jugador: link interno a /perfil/steamId
                                        const mentionMatch = href?.match(/^\/perfil\/(7656119\d{10})$/)
                                        if (mentionMatch && note.mentions) {
                                          const m = note.mentions.find((x: PatchNoteMention) => x.steamId === mentionMatch[1])
                                          if (m) {
                                            return (
                                              <a href={href} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-foreground/[0.06] hover:bg-foreground/[0.10] transition-colors align-middle no-underline">
                                                <span className="w-4 h-4 rounded-full overflow-hidden bg-foreground/10 shrink-0 inline-block">
                                                  {m.avatar ? (
                                                    <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                                                  ) : (
                                                    <span className="w-full h-full flex items-center justify-center text-[7px] font-bold text-foreground/30">?</span>
                                                  )}
                                                </span>
                                                <span className="text-[12px] font-semibold text-foreground">{m.name}</span>
                                              </a>
                                            )
                                          }
                                        }
                                        return (
                                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-foreground underline decoration-foreground/15 underline-offset-2 hover:decoration-foreground/40 transition-colors">
                                            {children}
                                          </a>
                                        )
                                      },
                                      blockquote: ({ children }) => (
                                        <blockquote className="my-3 border-l-2 border-foreground/[0.08] pl-4 text-[var(--qc-text-muted)] italic">
                                          {children}
                                        </blockquote>
                                      ),
                                    }}
                                  >
                                    {processContent(note.content, (note as any).mentions)}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            </div>
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </ContentContainer>
        </div>
      </div>
    </div>
  )
}
