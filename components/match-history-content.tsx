"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import Image from "next/image"
import { ChevronLeft } from 'lucide-react'
import { parseQuakeColors } from "@/lib/quake-colors"
import { useDebouncedLoading } from "@/hooks/use-debounced-loading"
import { useTranslations } from "next-intl"
import { LoadingScreen } from "@/components/loading-screen"

interface MatchHistoryContentProps {
  steamId: string
  username: string
  isOwnProfile: boolean
}

interface Match {
  matchId: string
  map: string
  gameType: string
  result: string
  timestamp: number
  server: string
  score: string
  eloChange?: number
  eloBefore?: number
  eloAfter?: number
  opponent?: string
  kills?: number
  deaths?: number
  isRated?: boolean
  isAborted?: boolean
  gameStatus?: string
}

export function MatchHistoryContent({ steamId, username, isOwnProfile }: MatchHistoryContentProps) {
  const t = useTranslations("profile")
  const tMatches = useTranslations("matches")
  const [selectedGameMode, setSelectedGameMode] = useState<string>("todo")

  const { data: matchesData, isLoading } = useQuery({
    queryKey: ['all-matches', steamId, selectedGameMode],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set("limit", "all")
      if (selectedGameMode !== "todo") {
        params.set("gameType", selectedGameMode)
      }
      const response = await fetch(`/api/players/${steamId}/matches?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch matches')
      }
      const data = await response.json()
      if (!data.success) return []

      return data.matches.map((match: any) => ({
        matchId: match.matchId,
        map: match.map,
        gameType: match.gameType,
        result: match.result,
        timestamp: new Date(match.playedAt).getTime(),
        server: match.serverName || "QuakeClub Server",
        score: `${match.kills}/${match.deaths}`,
        eloChange: match.eloChange,
        eloBefore: match.eloBefore,
        eloAfter: match.eloAfter,
        opponent: match.opponent,
        kills: match.kills,
        deaths: match.deaths,
        isRated: match.isRated,
        isAborted: match.isAborted,
        gameStatus: match.gameStatus,
      }))
    },
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  })

  const matches: Match[] = matchesData || []
  const showLoading = useDebouncedLoading(isLoading, 600)

  const gameModes = [
    { id: "todo", name: t("all") },
    { id: "ca", name: "CA" },
    { id: "duel", name: "Duel" },
    { id: "ctf", name: "CTF" },
    { id: "ffa", name: "FFA" },
    { id: "tdm", name: "TDM" },
    { id: "ad", name: "AD" },
    { id: "ft", name: "FT" },
    { id: "dom", name: "DOM" },
  ]

  const formatEloChange = (change?: number) => {
    if (!change || change === 0) return <span className="text-foreground/30">-</span>
    if (change > 0) return <span className="text-green-600 font-bold">+{change}</span>
    return <span className="text-red-500 font-bold">{change}</span>
  }

  const isUnrated = (game: Match) => !game.isRated || game.isAborted || (game.gameStatus && game.gameStatus !== "SUCCESS")

  return (
    <div className="mx-auto max-w-[1100px] space-y-4 p-4">
      {/* Anuncio arriba */}
      <div className="animate-fade-in">
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 animate-fade-in">
        <Link
          href={isOwnProfile ? "/perfil/yo" : `/perfil/${steamId}`}
          className="flex items-center gap-2 text-foreground hover:text-[#d4b46f] transition-all hover:gap-3 glass-card rounded-xl px-4 py-2.5"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="font-bold uppercase tracking-wider text-sm font-tiktok">{t("backToProfile")}</span>
        </Link>
      </div>

      {/* Contenedor principal */}
      <div className="animate-scale-fade [animation-delay:100ms] glass-card-elevated rounded-xl overflow-hidden">
        {/* Header */}
        <div className="bg-foreground/[0.02] border-b border-[rgba(0,0,0,0.06)] px-4 sm:px-5 py-4 sm:py-5">
          <h1 className="font-tiktok text-lg sm:text-xl font-bold uppercase tracking-wider text-foreground mb-4">
            <span className="text-shadow-sm">{t("matchHistoryTitle")} - {parseQuakeColors(username)}</span>
          </h1>

          {/* Tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {gameModes.map((mode) => (
              <button
                key={mode.id}
                onClick={() => setSelectedGameMode(mode.id)}
                className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all font-tiktok rounded-lg ${selectedGameMode === mode.id
                  ? "bg-foreground text-white"
                  : "text-foreground/30 hover:text-foreground/50"
                  }`}
              >
                {mode.name}
              </button>
            ))}
          </div>
        </div>

        {/* Contenido */}
        <div className="px-4 sm:px-5" style={{ minHeight: isLoading ? '300px' : 'auto' }}>
          {showLoading && !matches.length ? (
            <LoadingScreen compact />
          ) : matches.length > 0 ? (
            <>
              {/* Desktop */}
              <div className="hidden md:block">
                {/* Header de tabla */}
                <div className="grid grid-cols-[44px_80px_1fr_64px_64px_60px_70px] gap-4 py-2.5 border-b border-[rgba(0,0,0,0.05)]">
                  <span className="text-[10px] font-bold uppercase text-foreground/30 tracking-wider text-center">{tMatches("result")}</span>
                  <span className="text-[10px] font-bold uppercase text-foreground/30 tracking-wider">{tMatches("map")}</span>
                  <span className="text-[10px] font-bold uppercase text-foreground/30 tracking-wider">{tMatches("server")}</span>
                  <span className="text-[10px] font-bold uppercase text-foreground/30 tracking-wider text-center">{tMatches("mode")}</span>
                  <span className="text-[10px] font-bold uppercase text-foreground/30 tracking-wider text-center">K/D</span>
                  <span className="text-[10px] font-bold uppercase text-foreground/30 tracking-wider text-center">{tMatches("elo")}</span>
                  <span className="text-[10px] font-bold uppercase text-foreground/30 tracking-wider text-center">{tMatches("date")}</span>
                </div>

                {/* Filas */}
                {matches.map((game, index) => (
                  <div key={index}>
                    {/* Anuncio cada 50 partidas */}
                    {index > 0 && index % 50 === 0 && (
                      <div className="py-3 border-b border-[rgba(0,0,0,0.05)]">
                      </div>
                    )}
                    <Link
                      href={`/match/${game.matchId}`}
                      className="group grid grid-cols-[44px_80px_1fr_64px_64px_60px_70px] gap-4 items-center py-2.5 border-b border-[rgba(0,0,0,0.03)] hover:bg-[rgba(0,0,0,0.02)] transition-all"
                    >
                      {/* Resultado */}
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <span className={`text-sm font-bold font-tiktok ${game.result === "win" ? "text-green-600" : "text-red-500"}`}>
                            {game.result === "win" ? "W" : "L"}
                          </span>
                          {isUnrated(game) && (
                            <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* Mapa levelshot */}
                      <div className="relative h-[30px] w-[80px] rounded overflow-hidden bg-black/5">
                        <Image
                          src={`/levelshots/${game.map.toLowerCase()}.jpg`}
                          alt={game.map}
                          fill
                          className="object-cover"
                          unoptimized
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.src = "/levelshots/default.jpg"
                          }}
                        />
                      </div>

                      {/* Servidor + oponente */}
                      <div className="min-w-0">
                        <p className="text-xs text-foreground/70 truncate group-hover:text-foreground transition-colors">
                          {game.server}
                        </p>
                        {game.opponent && (
                          <p className="text-[10px] text-foreground truncate mt-0.5">vs {game.opponent}</p>
                        )}
                      </div>

                      {/* Modo */}
                      <div className="text-center">
                        <span className="text-[10px] font-bold text-foreground/50 uppercase font-tiktok">{game.gameType}</span>
                      </div>

                      {/* K/D */}
                      <div className="text-center">
                        <span className="text-xs text-foreground/60">
                          {game.kills ?? 0}/{game.deaths ?? 0}
                        </span>
                      </div>

                      {/* ELO delta */}
                      <div className="text-center text-xs">
                        {formatEloChange(game.eloChange)}
                      </div>

                      {/* Fecha */}
                      <div className="text-center">
                        <span className="text-[10px] text-foreground/40">
                          {new Date(game.timestamp).toLocaleDateString("es-CL", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>

              <div className="md:hidden">
                {matches.map((game, index) => (
                  <div key={index}>
                    {/* Anuncio cada 50 partidas */}
                    {index > 0 && index % 50 === 0 && (
                      <div className="py-3 border-b border-[rgba(0,0,0,0.05)]">
                      </div>
                    )}
                    <Link
                      href={`/match/${game.matchId}`}
                      className="flex items-center gap-3 py-2.5 border-b border-[rgba(0,0,0,0.03)] active:bg-[rgba(0,0,0,0.02)] transition-colors"
                    >
                      {/* W/L */}
                      <div className="w-7 flex-shrink-0 text-center">
                        <span className={`text-sm font-bold font-tiktok ${game.result === "win" ? "text-green-600" : "text-red-500"}`}>
                          {game.result === "win" ? "W" : "L"}
                        </span>
                      </div>

                      {/* Mapa levelshot */}
                      <div className="relative h-[28px] w-[50px] rounded overflow-hidden bg-black/5 flex-shrink-0">
                        <Image
                          src={`/levelshots/${game.map.toLowerCase()}.jpg`}
                          alt={game.map}
                          fill
                          className="object-cover"
                          unoptimized
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.src = "/levelshots/default.jpg"
                          }}
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-foreground/70 truncate">{game.server}</span>
                          <span className="text-[10px] font-bold text-foreground/30 uppercase font-tiktok flex-shrink-0">{game.gameType}</span>
                        </div>
                        {game.opponent && (
                          <p className="text-[10px] text-foreground truncate">vs {game.opponent}</p>
                        )}
                      </div>

                      {/* ELO + Fecha */}
                      <div className="flex-shrink-0 text-right">
                        <div className="text-xs">{formatEloChange(game.eloChange)}</div>
                        <span className="text-[9px] text-foreground/30">
                          {new Date(game.timestamp).toLocaleDateString("es-CL", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="font-tiktok text-sm text-gray-500 uppercase tracking-wider">
                {selectedGameMode === "todo"
                  ? t("noMatchesRecorded")
                  : t("noMatchesInMode", { mode: gameModes.find((m) => m.id === selectedGameMode)?.name || selectedGameMode.toUpperCase() })}
              </p>
            </div>
          )}

          {/* Anuncio al final */}
          {matches.length > 0 && (
            <div className="py-4 mt-4 border-t border-[rgba(0,0,0,0.05)]">
            </div>
          )}

          {/* Spacer al final */}
          {matches.length > 0 && <div className="h-3" />}
        </div>
      </div>
    </div>
  )
}
