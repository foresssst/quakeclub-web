"use client"

import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { useState, useMemo } from "react"
import { parseQuakeColors } from "@/lib/quake-colors"
import { PlayerAvatar } from "@/components/player-avatar"
import { IdentityBadges } from "@/components/identity-badges"
import { ContentContainer, ContentHeader } from "@/components/ui/content-container"
import { LoadingScreen } from "@/components/loading-screen"
import { RankValue } from "@/components/rank-value"
import { TierBadgeInline } from "@/components/tier-badge"

const PER_PAGE = 20

interface RankedPlayer {
  playerId: string
  steamId: string
  username: string
  avatar?: string | null
  rating: number
  rank: number
  countryCode?: string | null
  clanTag?: string | null
  clanSlug?: string | null
  clanAvatarUrl?: string | null
  avgKD?: number
  totalGames?: number
  totalKills?: number
}

interface RankingsResponse {
  rankings: RankedPlayer[]
  totalCount: number
  count: number
  offset: number
  gameType: string
}

export default function RankingsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const t = useTranslations("rankings")

  const gameType = searchParams.get("gameType") || "ca"
  const [currentPage, setCurrentPage] = useState(1)

  const offset = (currentPage - 1) * PER_PAGE

  const { data, isLoading } = useQuery<RankingsResponse>({
    queryKey: ["rankings", gameType, currentPage],
    queryFn: async () => {
      const res = await fetch(`/api/rankings?gameType=${gameType}&perPage=${PER_PAGE}&offset=${offset}`)
      if (!res.ok) throw new Error("Failed to fetch rankings")
      return res.json()
    },
    staleTime: 60 * 1000,
  })

  const rankings = data?.rankings || []
  const totalCount = data?.totalCount || 0
  const totalPages = Math.ceil(totalCount / PER_PAGE)

  const handleGameTypeChange = (newGameType: string) => {
    setCurrentPage(1)
    router.push(`/rankings?gameType=${newGameType}`)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const pageNumbers = useMemo(() => {
    const pages: (number | "ellipsis")[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push("ellipsis")
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (currentPage < totalPages - 2) pages.push("ellipsis")
      pages.push(totalPages)
    }
    return pages
  }, [currentPage, totalPages])

  return (
    <div className="relative min-h-screen">
      <div className="container mx-auto py-4 sm:py-6 px-2 sm:px-4 max-w-[1400px] pt-4 sm:pt-10">
        <div className="max-w-[1080px] mx-auto space-y-4 sm:space-y-5 animate-fade-up">
          <ContentContainer className="animate-scale-fade">
            <ContentHeader className="flex-col items-stretch gap-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h1 className="font-tiktok text-lg sm:text-xl font-bold uppercase tracking-wide text-foreground">
                    {t("title")}
                  </h1>
                  <span className="mt-0.5 block text-[10px] tracking-wide text-[var(--qc-text-muted)]">
                    {isLoading ? "..." : `${totalCount} ${t("players")}`}
                  </span>
                </div>
                <div className="flex gap-0.5 flex-wrap rounded-lg bg-secondary p-0.5 overflow-x-auto mobile-hide-scrollbar">
                  {["ca", "duel", "tdm", "ctf", "ffa"].map((type) => (
                    <button
                      key={type}
                      onClick={() => handleGameTypeChange(type)}
                      className={`px-3 py-1.5 sm:px-2.5 sm:py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all rounded-md flex-shrink-0 ${
                        gameType === type ? "bg-foreground text-background shadow-sm" : "text-[var(--qc-text-muted)] hover:text-foreground"
                      }`}
                    >
                      {type.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </ContentHeader>

            <div className="p-2 sm:p-4">
              {isLoading ? (
                <div>
                  <div className="flex items-center gap-2 px-2 py-2 border-b border-foreground/[0.06]">
                    <div className="w-8 text-[9px] font-bold uppercase text-center text-[var(--qc-text-muted)]">#</div>
                    <div className="flex-1 text-[9px] font-bold uppercase text-[var(--qc-text-muted)]">{t("player")}</div>
                    <div className="w-12 text-[9px] font-bold uppercase text-center text-[var(--qc-text-muted)]">ELO</div>
                    <div className="w-10 text-[9px] font-bold uppercase text-center text-[var(--qc-text-muted)]">{t("kd")}</div>
                    <div className="w-12 text-[9px] font-bold uppercase text-center text-[var(--qc-text-muted)] hidden sm:block">{t("games")}</div>
                    <div className="w-12 text-[9px] font-bold uppercase text-center text-[var(--qc-text-muted)] hidden sm:block">{t("kills")}</div>
                  </div>
                  <LoadingScreen compact />
                </div>
              ) : rankings.length > 0 ? (
                <div>
                  {currentPage === 1 && <div className="py-2 border-b border-foreground/[0.06]" />}

                  <div className="flex items-center gap-2 px-2 py-2 border-b border-foreground/[0.06]">
                    <div className="w-8 text-[9px] font-bold uppercase text-center text-[var(--qc-text-muted)]">#</div>
                    <div className="flex-1 text-[9px] font-bold uppercase text-[var(--qc-text-muted)]">{t("player")}</div>
                    <div className="w-9 text-[9px] font-bold uppercase text-center text-[var(--qc-text-muted)] hidden sm:block">TIER</div>
                    <div className="w-12 text-[9px] font-bold uppercase text-center text-[var(--qc-text-muted)]">ELO</div>
                    <div className="w-10 text-[9px] font-bold uppercase text-center text-[var(--qc-text-muted)]">{t("kd")}</div>
                    <div className="w-12 text-[9px] font-bold uppercase text-center text-[var(--qc-text-muted)] hidden sm:block">{t("games")}</div>
                    <div className="w-12 text-[9px] font-bold uppercase text-center text-[var(--qc-text-muted)] hidden sm:block">{t("kills")}</div>
                  </div>

                  <div className="space-y-0">
                    {rankings.map((player) => (
                      <Link
                        key={player.playerId}
                        href={`/perfil/${player.steamId}`}
                        className="flex items-center gap-2 w-full border-b border-foreground/[0.05] py-2 sm:py-1.5 px-2 transition-all hover:bg-foreground/[0.02] rounded-lg group"
                      >
                        <RankValue
                          rank={player.rank}
                          totalPlayers={totalCount}
                          className="w-8 text-center text-xs flex-shrink-0"
                          showHash={true}
                          variant="flat"
                        />

                        <div className="qc-identity-inline flex-1 min-w-0 gap-2 sm:gap-3">
                          <span className="qc-identity-inline__avatar">
                            <PlayerAvatar
                              steamId={player.steamId}
                              playerName={player.username}
                              avatarUrl={player.avatar}
                            />
                          </span>
                          <IdentityBadges
                            className="qc-identity-inline__badges"
                            countryCode={player.countryCode}
                            countryName={player.countryCode}
                            clanTag={player.clanTag}
                            clanName={player.clanTag}
                            clanAvatar={player.clanAvatarUrl}
                            size="sm"
                            showTooltips={false}
                            clanClassName={player.clanTag && player.clanSlug ? "hover:opacity-80 transition-opacity" : undefined}
                            onClanClick={player.clanTag && player.clanSlug ? (event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              router.push(`/clanes/${player.clanSlug}`)
                            } : undefined}
                          />
                          <span className="qc-identity-inline__name text-[13px] text-[var(--qc-text-secondary)] truncate group-hover:text-foreground transition-colors">
                            {parseQuakeColors(player.username)}
                          </span>
                        </div>

                        <div className="justify-center w-9 hidden sm:flex flex-shrink-0 icon-shadow">
                          <TierBadgeInline elo={Math.round(player.rating)} gameType={gameType} size="sm" />
                        </div>
                        <span className="w-12 text-[13px] text-center text-foreground font-medium flex-shrink-0 tabular-nums">
                          {Math.round(player.rating)}
                        </span>
                        <span className="w-10 text-[11px] text-center text-[var(--qc-text-secondary)] flex-shrink-0 tabular-nums">
                          {player.avgKD !== undefined ? player.avgKD.toFixed(2) : "-"}
                        </span>
                        <span className="w-12 text-[11px] text-center text-[var(--qc-text-secondary)] hidden sm:block flex-shrink-0 tabular-nums">{player.totalGames || "-"}</span>
                        <span className="w-12 text-[11px] text-center text-[var(--qc-text-secondary)] hidden sm:block flex-shrink-0 tabular-nums">{player.totalKills || "-"}</span>
                      </Link>
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex flex-col items-center gap-2.5 mt-5 pt-4 section-divider">
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-lg text-[11px] font-bold transition-all disabled:opacity-20 disabled:cursor-not-allowed text-[var(--qc-text-muted)] hover:text-foreground hover:bg-foreground/[0.03]"
                          aria-label="Previous page"
                        >
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>

                        {pageNumbers.map((page, idx) =>
                          page === "ellipsis" ? (
                            <span key={`ellipsis-${idx}`} className="w-7 h-9 sm:w-7 sm:h-8 flex items-center justify-center text-[10px] text-[var(--qc-text-muted)]">
                              ...
                            </span>
                          ) : (
                            <button
                              key={page}
                              onClick={() => handlePageChange(page)}
                              className={`w-9 h-9 sm:w-8 sm:h-8 rounded-lg text-[10px] font-bold transition-all ${
                                currentPage === page
                                  ? "bg-foreground text-background"
                                  : "text-[var(--qc-text-muted)] hover:text-foreground hover:bg-foreground/[0.03]"
                              }`}
                            >
                              {page}
                            </button>
                          ),
                        )}

                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-lg text-[11px] font-bold transition-all disabled:opacity-20 disabled:cursor-not-allowed text-[var(--qc-text-muted)] hover:text-foreground hover:bg-foreground/[0.03]"
                          aria-label="Next page"
                        >
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      </div>

                      <p className="text-[9px] text-[var(--qc-text-muted)] uppercase tracking-wider tabular-nums">
                        {t("page")} {currentPage} / {totalPages}
                      </p>
                    </div>
                  )}

                  <div className="py-4 mt-4 section-divider" />
                </div>
              ) : (
                <div className="py-16 text-center">
                  <p className="text-sm text-[var(--qc-text-secondary)]">{t("noData")}</p>
                </div>
              )}
            </div>
          </ContentContainer>
        </div>
      </div>
    </div>
  )
}
