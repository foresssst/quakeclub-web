"use client"

import Image from "next/image"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useState, useRef, useCallback } from "react"
import { useTranslations } from "next-intl"
import { parseQuakeColors } from "@/lib/quake-colors"
import { PlayerAvatar } from "@/components/player-avatar"
import { useQuery } from "@tanstack/react-query"
import { FlagClan } from "@/components/flag-clan"
import { IdentityBadges } from "@/components/identity-badges"
import { LoadingScreen } from "@/components/loading-screen"
import { RankValue } from "@/components/rank-value"
import { TierBadgeInline } from "@/components/tier-badge"
const YouTubeFacade = dynamic(() => import("@/components/youtube-facade").then(m => m.YouTubeFacade), { ssr: false })
const WeaponGods = dynamic(() => import("@/components/weapon-gods").then(m => m.WeaponGods), { ssr: false })
const LiveServers = dynamic(() => import("@/components/live-servers").then(m => m.LiveServers), { ssr: false })
const ServerActivityBanner = dynamic(() => import("@/components/server-activity-banner").then(m => m.ServerActivityBanner), { ssr: false })

interface RankingPlayer {
  playerId: string
  steamId: string
  username: string
  totalKills: number
  totalDeaths: number
  avgKD: number
  totalGames: number
  rank: number
  countryCode?: string
  rating?: number
  clanTag?: string
  clanSlug?: string
  clanAvatarUrl?: string
}

interface ClanRanking {
  tag: string
  slug: string
  name: string
  members: number
  avgElo: number
  rank: number
  avatarUrl?: string
  avgKd: number
}

interface NewsItem {
  id: string
  title: string
  excerpt: string
  date: string
  imageUrl?: string
  slug: string
}

interface RecentMatch {
  id: string
  matchId: string
  gameType: string
  map: string
  timestamp: string
  player1?: { name: string; steamId: string; score: number }
  player2?: { name: string; steamId: string; score: number }
  team1?: { name: string; steamId: string }[]
  team2?: { name: string; steamId: string }[]
  score: string
}

interface MatchPlayer { name: string; steamId: string; score: number; eloDelta?: number | null }

interface HistoryMatch {
  id: string
  matchId: string
  gameType: string
  map: string
  timestamp: string
  player1?: MatchPlayer
  player2?: MatchPlayer
  team1?: MatchPlayer[]
  team2?: MatchPlayer[]
  score: string
}

interface CommunityStats {
  members: number
  matchesWeek: number
  clans: number
  tournaments: number
}

interface SocialStats {
  serversOnline: number
  discordMembers: number
  youtubeFollowers: number
  twitchFollowers: number
  matchesToday: number
  activePlayers: number
}

interface ActivityData {
  svgPoints: string
  peakPoint: { x: number; y: number }
  peakHours: string
  hourlyData?: { [hour: number]: number }
}

export default function Home() {
  const t = useTranslations("home")
  const [selectedGameType, setSelectedGameType] = useState<string>("ca")
  const [videoVisible, setVideoVisible] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [matchesMode, setMatchesMode] = useState<"global" | "mine">("global")
  const videoRef = useRef<HTMLVideoElement>(null)

  const handleBannerMouseEnter = useCallback(() => {
    setVideoVisible(true)
    videoRef.current?.play()
  }, [])

  const handleBannerMouseLeave = useCallback(() => {
    setVideoVisible(false)
    setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause()
      }
    }, 500)
  }, [])

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted
      setIsMuted(videoRef.current.muted)
    }
  }, [])

  const { data: homepageStats } = useQuery({
    queryKey: ["homepage-stats"],
    queryFn: async () => {
      const res = await fetch("/api/stats/homepage")
      if (!res.ok) return { activePlayers: 0 }
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: newsData, isFetched: newsFetched } = useQuery({
    queryKey: ["latest-news"],
    queryFn: async () => {
      const res = await fetch("/api/news?limit=3")
      if (!res.ok) return { news: [] }
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: playersData, isFetched: playersFetched } = useQuery({
    queryKey: ["rankings-players", selectedGameType],
    queryFn: async () => {
      const res = await fetch(`/api/rankings/quakeclub?gameType=${selectedGameType}&limit=10`)
      if (!res.ok) return { players: [] }
      return res.json()
    },
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  })

  const { data: clansData, isFetched: clansFetched } = useQuery({
    queryKey: ["rankings-clans", selectedGameType],
    queryFn: async () => {
      const res = await fetch(`/api/rankings/clans?gameType=${selectedGameType}&limit=10`)
      if (!res.ok) return { clans: [] }
      return res.json()
    },
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  })

  const { data: communityStats, isFetched: communityFetched } = useQuery<CommunityStats>({
    queryKey: ["community-stats"],
    queryFn: async () => {
      const res = await fetch("/api/stats/community")
      if (!res.ok) return { members: 0, matchesWeek: 0, clans: 0, tournaments: 0 }
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: socialStats, isFetched: socialFetched } = useQuery<SocialStats>({
    queryKey: ["social-stats"],
    queryFn: async () => {
      const res = await fetch("/api/stats/social")
      if (!res.ok)
        return {
          serversOnline: 0,
          discordMembers: 0,
          youtubeFollowers: 0,
          twitchFollowers: 0,
          matchesToday: 0,
          activePlayers: 0,
        }
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: activityData, isFetched: activityFetched } = useQuery<ActivityData>({
    queryKey: ["activity-stats"],
    queryFn: async () => {
      const res = await fetch("/api/stats/activity")
      if (!res.ok)
        return {
          svgPoints: "0,40 28,38 57,35 85,30 114,20 142,15 171,18 200,25",
          peakPoint: { x: 142, y: 15 },
          peakHours: "20:00 - 00:00",
        }
      return res.json()
    },
    staleTime: 10 * 60 * 1000,
  })

  const { data: sessionData } = useQuery<{ user: { steamId?: string; username?: string } | null }>({
    queryKey: ["session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session")
      if (!res.ok) return { user: null }
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  const currentSteamId = sessionData?.user?.steamId

  const { data: recentMatchesData, isFetched: matchesFetched } = useQuery<{ matches: HistoryMatch[] }>({
    queryKey: ["recent-matches-sidebar"],
    queryFn: async () => {
      const res = await fetch("/api/matches/history?limit=5")
      if (!res.ok) return { matches: [] }
      return res.json()
    },
    staleTime: 30 * 1000,
  })

  const { data: myMatchesData } = useQuery<{ matches: HistoryMatch[] }>({
    queryKey: ["my-matches-sidebar", currentSteamId],
    queryFn: async () => {
      const res = await fetch(`/api/matches/history?limit=5&steamId=${currentSteamId}`)
      if (!res.ok) return { matches: [] }
      return res.json()
    },
    staleTime: 30 * 1000,
    enabled: !!currentSteamId,
  })

  const topPlayers = playersData?.players || []
  const topClans = clansData?.clans || []
  const latestNews: NewsItem[] = newsData?.news || []
  const activePlayers = homepageStats?.activePlayers || 0
  const recentMatches = (matchesMode === "mine" && currentSteamId ? myMatchesData?.matches : recentMatchesData?.matches) || []

  return (
      <main className="container mx-auto px-2 sm:px-4 max-w-[1080px] pb-16 pt-4 sm:pt-8 relative z-10 animate-fade-up">
      <header className="sr-only">
        <h1>QuakeClub Chile</h1>
        <p>
          Rankings ELO en tiempo real, clanes, torneos, noticias, historial de partidas y servidores activos para la
          escena de Quake Live en Chile.
        </p>
      </header>

      <div className="glass-card-elevated rounded-[18px] sm:rounded-[22px] overflow-hidden animate-scale-fade border border-foreground/[0.06]">
        {/* BANNER - Full width */}
        <div
          className="relative w-full aspect-[3/1] sm:aspect-[3/1] overflow-hidden bg-card cursor-pointer"
          onMouseEnter={handleBannerMouseEnter}
          onMouseLeave={handleBannerMouseLeave}
        >
          <Image
            src="/headers/cabecera_CA.jpg"
            alt="QuakeClub Banner"
            fill
            className="object-contain object-center"
            priority
          />
          <video
            ref={videoRef}
            src="/videos/COPA_CA_OPENNING.mp4"
            muted
            loop
            playsInline
            preload="none"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${videoVisible ? "opacity-100" : "opacity-0"}`}
          />
          {/* Mute/Unmute button */}
          <button
            onClick={toggleMute}
            className={`absolute bottom-3 right-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white transition-all duration-300 ${videoVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            title={isMuted ? "Activar sonido" : "Silenciar"}
          >
            {isMuted ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            )}
          </button>
        </div>

        {/* FEATURED ROW - Videos + Recent Matches */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border-b border-foreground/[0.06]">
          {/* Latest Streams */}
          <div className="p-4 sm:p-5 lg:border-r border-foreground/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--qc-text-secondary)]">{t("latestStreams")}</h3>
              <a
                href="https://www.youtube.com/@QuakeClubCL"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-[var(--qc-text-muted)] hover:text-foreground transition-colors"
              >
                {t("viewChannel")} →
              </a>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: "2jL05bdp_-A", title: "LIGA DPR | Gran Final T4 vs ZP" },
                { id: "rL-XnQD6FDU", title: "LIGA DPR | Semifinal T4 vs GetNaked" },
                { id: "OuKCN4K1QwQ", title: "Quake Club COPA DUEL 2024 | Finales" },
                { id: "C4cIEUs9DSA", title: "Quake Club COPA CA 2025 | Playoffs: PRC VS PBS" },
              ].map((video) => (
                <a
                  key={video.id}
                  href={`https://www.youtube.com/watch?v=${video.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group"
                >
                  <div className="aspect-video rounded-[14px] overflow-hidden border border-foreground/[0.06] bg-[var(--qc-bg-page)] shadow-[0_8px_18px_-16px_rgba(0,0,0,0.28)] dark:shadow-[0_12px_20px_-18px_rgba(0,0,0,0.5)]">
                    <img
                      src={`https://img.youtube.com/vi/${video.id}/mqdefault.jpg`}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  </div>
                  <p className="mt-1.5 line-clamp-1 text-[10px] text-[var(--qc-text-muted)] transition-colors group-hover:text-foreground">
                    {video.title}
                  </p>
                </a>
              ))}
            </div>
          </div>

          {/* Recent Matches */}
          <div className="p-4 sm:p-5 border-t lg:border-t-0 border-foreground/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--qc-text-secondary)]">{t("lastMatches")}</h3>
                {currentSteamId && (
                  <div className="flex gap-0.5 rounded-md border border-foreground/[0.06] bg-foreground/[0.05] p-0.5 dark:border-white/[0.07] dark:bg-white/[0.05]">
                    <button
                      onClick={() => setMatchesMode("global")}
                      className={`px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded transition-all ${
                        matchesMode === "global"
                          ? "bg-foreground text-background"
                          : "text-[var(--qc-text-muted)] hover:text-foreground"
                      }`}
                    >
                      {t("global") || "Global"}
                    </button>
                    <button
                      onClick={() => setMatchesMode("mine")}
                      className={`px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded transition-all ${
                        matchesMode === "mine"
                          ? "bg-foreground text-background"
                          : "text-[var(--qc-text-muted)] hover:text-foreground"
                      }`}
                    >
                      {t("myMatches") || "Mías"}
                    </button>
                  </div>
                )}
              </div>
              <Link href="/historial" className="text-[10px] text-[var(--qc-text-muted)] hover:text-foreground transition-colors">
                {t("viewHistory")} →
              </Link>
            </div>
            <div className="space-y-1.5">
              {recentMatches.length > 0 ? (
                recentMatches.map((match) => {
                  const isTeamMatch = match.team1 && match.team2
                  const [s1, s2] = match.score.split("-").map(Number)
                  const redWon = s1 > s2
                  const blueWon = s2 > s1

                  // Determine W/L and ELO change for the current user
                  let userResult: "W" | "L" | "D" | null = null
                  let userEloDelta: number | null = null
                  if (currentSteamId) {
                    if (isTeamMatch) {
                      const inTeam1 = match.team1?.find(p => p.steamId === currentSteamId)
                      const inTeam2 = match.team2?.find(p => p.steamId === currentSteamId)
                      if (inTeam1) {
                        userResult = s1 > s2 ? "W" : s1 < s2 ? "L" : "D"
                        userEloDelta = inTeam1.eloDelta ?? null
                      } else if (inTeam2) {
                        userResult = s2 > s1 ? "W" : s2 < s1 ? "L" : "D"
                        userEloDelta = inTeam2.eloDelta ?? null
                      }
                    } else {
                      if (match.player1?.steamId === currentSteamId) {
                        userResult = (match.player1.score > (match.player2?.score || 0)) ? "W" : (match.player1.score < (match.player2?.score || 0)) ? "L" : "D"
                        userEloDelta = match.player1.eloDelta ?? null
                      } else if (match.player2?.steamId === currentSteamId) {
                        userResult = (match.player2.score > (match.player1?.score || 0)) ? "W" : (match.player2.score < (match.player1?.score || 0)) ? "L" : "D"
                        userEloDelta = match.player2.eloDelta ?? null
                      }
                    }
                  }

                  return (
                    <Link
                      key={match.id}
                      href={`/match/${match.matchId}`}
                      className="group flex items-center gap-2.5 rounded-lg border-b border-foreground/[0.06] px-1 py-2 transition-all hover:bg-foreground/[0.02] dark:hover:bg-white/[0.03]"
                    >
                      {/* Levelshot */}
                      <div className="h-[30px] w-[50px] flex-shrink-0 overflow-hidden rounded bg-[var(--qc-bg-page)] ring-1 ring-foreground/[0.06] dark:ring-white/[0.07]">
                        <img
                          src={`/levelshots/${match.map.toLowerCase()}.jpg`}
                          alt={match.map}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/levelshots/default.jpg"
                          }}
                        />
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-sm bg-foreground px-1.5 py-0.5 text-[8px] font-bold uppercase text-background">
                            {match.gameType}
                          </span>
                          <span className="truncate text-[9px] uppercase text-[var(--qc-text-secondary)]">{match.map}</span>
                        </div>
                        <div className="flex items-center text-[10px] gap-1.5 mt-0.5">
                          {isTeamMatch ? (
                            <>
                              <span className="text-[8px] font-bold text-[var(--qc-text-secondary)]">RED</span>
                              <span className="max-w-[45px] truncate text-[var(--qc-text-secondary)]">
                                {parseQuakeColors(match.team1?.[0]?.name?.slice(0, 6) || "?")}
                              </span>
                              <span className="font-bold tabular-nums text-[11px]">
                                <span className={redWon ? "text-foreground dark:text-[#ffe3ad]" : "text-[var(--qc-text-secondary)]"}>{s1}</span>
                                <span className="text-[var(--qc-text-secondary)]">-</span>
                                <span className={blueWon ? "text-foreground dark:text-[#ffe3ad]" : "text-[var(--qc-text-secondary)]"}>{s2}</span>
                              </span>
                              <span className="max-w-[45px] truncate text-[var(--qc-text-secondary)]">
                                {parseQuakeColors(match.team2?.[0]?.name?.slice(0, 6) || "?")}
                              </span>
                              <span className="text-[8px] font-bold text-[var(--qc-text-secondary)]">BLUE</span>
                            </>
                          ) : (
                            <>
                              <span className="max-w-[50px] truncate text-[var(--qc-text-secondary)]">
                                {parseQuakeColors(match.player1?.name?.slice(0, 6) || "?")}
                              </span>
                              <span className="font-bold tabular-nums text-[11px]">
                                <span className={match.player1 && match.player1.score > (match.player2?.score || 0) ? "text-foreground dark:text-[#ffe3ad]" : "text-[var(--qc-text-secondary)]"}>
                                  {match.player1?.score || 0}
                                </span>
                                <span className="text-[var(--qc-text-secondary)]">-</span>
                                <span className={match.player2 && match.player2.score > (match.player1?.score || 0) ? "text-foreground dark:text-[#ffe3ad]" : "text-[var(--qc-text-secondary)]"}>
                                  {match.player2?.score || 0}
                                </span>
                              </span>
                              <span className="max-w-[50px] truncate text-[var(--qc-text-secondary)]">
                                {parseQuakeColors(match.player2?.name?.slice(0, 6) || "?")}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {/* W/L + ELO + Time (right side) */}
                      <div className="flex-shrink-0 text-right flex flex-col items-end">
                        {userResult ? (
                          <>
                            <span className={`text-xs font-bold font-tiktok ${
                              userResult === "W" ? "text-green-600" : userResult === "L" ? "text-red-500" : "text-[var(--qc-text-muted)]"
                            }`}>
                              {userResult}
                            </span>
                            {userEloDelta !== null && (
                              <span className={`text-[9px] font-bold tabular-nums ${
                                userEloDelta > 0 ? "text-green-600" : userEloDelta < 0 ? "text-red-500" : "text-foreground/30"
                              }`}>
                                {userEloDelta > 0 ? "+" : ""}{userEloDelta}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[8px] text-foreground/30 tabular-nums">
                            {new Date(match.timestamp).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                        {userResult && (
                          <span className="text-[8px] text-foreground/30 tabular-nums">
                            {new Date(match.timestamp).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                    </Link>
                  )
                })
              ) : (
                <p className="py-3 text-center text-[10px] text-[var(--qc-text-secondary)]">
                  {matchesMode === "mine" ? (t("noMyMatches") || "No tienes partidas recientes") : t("noRecentMatches")}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* MAIN CONTENT + SIDEBAR */}
        <div className="flex flex-col lg:flex-row">
          <div className="flex-1 min-w-0">
            <div className="p-3 sm:p-6 lg:p-8">
              {/* Game Mode Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-5 pb-3">
                <div className="sm:ml-auto flex items-center gap-0.5 overflow-x-auto scrollbar-thin rounded-lg border border-foreground/[0.06] bg-foreground/[0.04] p-0.5 pb-1 dark:border-white/[0.07] dark:bg-white/[0.05] sm:pb-0">
                  {["ca", "duel", "tdm", "ctf", "ffa"].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setSelectedGameType(mode)}
                      className={`flex-shrink-0 rounded-md px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                        selectedGameType === mode
                          ? "bg-foreground text-background shadow-sm"
                          : "text-[var(--qc-text-muted)] hover:text-foreground"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Top Players header */}
              <div className="flex items-center justify-between mb-3 px-3">
                <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--qc-text-secondary)]">
                  <span className="h-3 w-0.5 rounded-full bg-foreground/25 dark:bg-white/[0.24]" />
                  {t("topPlayers")}
                </h2>
                <div className="flex items-center text-[9px] font-bold uppercase tracking-wider text-[var(--qc-text-muted)]">
                  <span className="w-10 text-center">TIER</span>
                  <span className="w-12 text-center">ELO</span>
                  <span className="w-12 text-right">{t("kd")}</span>
                </div>
              </div>

              {/* Top Players list */}
              <PlayersList
                players={topPlayers}
                emptyText={t("noRankings")}
                loading={!playersFetched}
                gameType={selectedGameType}
              />

              <div className="mt-5 text-center">
                <Link
                  href="/rankings"
                  className="inline-flex items-center gap-2 rounded-lg border border-foreground/[0.06] bg-[var(--qc-bg-pure)] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--qc-text-secondary)] transition-all hover:border-foreground/[0.12] hover:text-foreground"
                  style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }}
                >
                  {t("viewFullRanking")}
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="opacity-50"><path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </Link>
              </div>

              {/* Top Clans header */}
              <div className="flex items-center justify-between mb-3 mt-6 px-3">
                <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--qc-text-secondary)]">
                  <span className="h-3 w-0.5 rounded-full bg-foreground/25 dark:bg-white/[0.24]" />
                  {t("topClans")}
                </h2>
                <div className="flex items-center text-[9px] font-bold uppercase tracking-wider text-[var(--qc-text-muted)]">
                  <span className="w-10 text-center">TIER</span>
                  <span className="w-12 text-center">ELO</span>
                  <span className="w-12 text-right">{t("mbr")}</span>
                </div>
              </div>

              {/* Top Clans list */}
              <ClansList clans={topClans} emptyText={t("noClansAvailable")} loading={!clansFetched} gameType={selectedGameType} />

              <div className="mt-5 text-center">
                <Link
                  href="/clanes/rankings"
                  className="inline-flex items-center gap-2 rounded-lg border border-foreground/[0.06] bg-[var(--qc-bg-pure)] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--qc-text-secondary)] transition-all hover:border-foreground/[0.12] hover:text-foreground"
                  style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }}
                >
                  {t("viewAllClans")}
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="opacity-50"><path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </Link>
              </div>

              {/* Anuncio In-Feed */}
              <div className="mt-6 pt-6 border-t border-foreground/[0.06]">
              </div>
            </div>

            {/* Sección de Weapon Gods - después de Top Clans */}
            <WeaponGods />

            <div className="px-3 sm:px-6 lg:px-8 py-5 section-divider">
              <div className="flex items-center justify-between mb-4">
                <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--qc-text-secondary)]">
                  <span className="h-3 w-0.5 rounded-full bg-foreground/25 dark:bg-white/[0.24]" />
                  {t("community")}
                </h3>
                <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-[var(--qc-text-muted)]">
                  <span className="w-1.5 h-1.5 bg-foreground/20 rounded-full animate-pulse" />
                  {t("updating")}
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-5 gap-2">
                <div className="stat-card text-center p-2.5 sm:p-4">
                  <p className="text-lg sm:text-2xl font-bold text-foreground tabular-nums">{socialStats?.serversOnline || 0}</p>
                  <p className="mt-1.5 text-[9px] uppercase tracking-wider text-[var(--qc-text-secondary)] sm:text-[10px] leading-tight">{t("serversOnline")}</p>
                </div>
                <div className="stat-card text-center p-2.5 sm:p-4">
                  <p className="text-lg sm:text-2xl font-bold text-[var(--qc-text-secondary)] tabular-nums">
                    {socialStats?.discordMembers || communityStats?.members || 0}
                  </p>
                  <p className="mt-1.5 text-[9px] uppercase tracking-wider text-[var(--qc-text-secondary)] sm:text-[10px] leading-tight">{t("discordMembers")}</p>
                </div>
                <div className="stat-card text-center p-2.5 sm:p-4">
                  <p className="text-lg sm:text-2xl font-bold text-[var(--qc-text-secondary)] tabular-nums">{socialStats?.youtubeFollowers || 0}</p>
                  <p className="mt-1.5 text-[9px] uppercase tracking-wider text-[var(--qc-text-secondary)] sm:text-[10px] leading-tight">{t("youtubeFollowers")}</p>
                </div>
                <div className="stat-card text-center p-2.5 sm:p-4">
                  <p className="text-lg sm:text-2xl font-bold text-[var(--qc-text-secondary)] tabular-nums">{socialStats?.twitchFollowers || 0}</p>
                  <p className="mt-1.5 text-[9px] uppercase tracking-wider text-[var(--qc-text-secondary)] sm:text-[10px] leading-tight">{t("twitchFollowers")}</p>
                </div>
                <div className="stat-card text-center p-2.5 sm:p-4">
                  <p className="text-lg sm:text-2xl font-bold text-[var(--qc-text-secondary)] tabular-nums">{socialStats?.matchesToday || 0}</p>
                  <p className="mt-1.5 text-[9px] uppercase tracking-wider text-[var(--qc-text-secondary)] sm:text-[10px] leading-tight">{t("matchesToday")}</p>
                </div>

              </div>
            </div>


            {/* Banner de actividad */}
            <div className="px-3 sm:px-6 pt-4">
              <ServerActivityBanner />
            </div>

            {/* Sección de servidores en vivo */}
            <LiveServers />


          </div>

          {/* RIGHT SIDEBAR */}
          <div className="lg:w-[260px] border-t lg:border-t-0 lg:border-l border-foreground/[0.06] bg-[var(--qc-bg-pure)]">
            {/* News section */}
            {latestNews.length > 0 && (
              <div className="p-4 sm:p-5 border-b border-foreground/[0.06]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--qc-text-secondary)]">{t("news")}</h3>
                  <Link
                    href="/noticias"
                    className="text-[10px] text-[var(--qc-text-muted)] hover:text-foreground transition-colors"
                  >
                    {t("viewAllNews")} →
                  </Link>
                </div>
                <div className="space-y-2">
                  {latestNews.slice(0, 3).map((news) => (
                    <Link
                      key={news.id}
                      href={`/noticias/${news.slug}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-foreground/[0.03] transition-all group"
                    >
                      {news.imageUrl && (
                        <div className="h-11 w-16 flex-shrink-0 overflow-hidden rounded bg-[var(--qc-bg-page)] ring-1 ring-foreground/[0.06] dark:ring-white/[0.07]">
                          <Image
                            src={news.imageUrl || "/branding/logo.png"}
                            alt={news.title}
                            width={64}
                            height={44}
                            className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="line-clamp-2 text-[11px] leading-snug text-[var(--qc-text-secondary)] transition-colors group-hover:text-foreground">
                          {news.title}
                        </p>
                        <p className="mt-1 text-[9px] text-[var(--qc-text-muted)]">{news.date}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Weekly Activity */}
            <div className="p-4 sm:p-5 border-b border-foreground/[0.06]">
              <h3 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--qc-text-secondary)]">
                {t("weeklyActivity")}
              </h3>
              <p className="mb-3 text-[9px] text-[var(--qc-text-muted)]">{t("playersByTimeBlock")}</p>

              {(() => {
                const hourlyData = activityData?.hourlyData || {}
                const timeBlocks = [
                  { label: "00 - 03", hours: [0, 1, 2] },
                  { label: "03 - 06", hours: [3, 4, 5] },
                  { label: "06 - 09", hours: [6, 7, 8] },
                  { label: "09 - 12", hours: [9, 10, 11] },
                  { label: "12 - 15", hours: [12, 13, 14] },
                  { label: "15 - 18", hours: [15, 16, 17] },
                  { label: "18 - 21", hours: [18, 19, 20] },
                  { label: "21 - 00", hours: [21, 22, 23] },
                ]
                const blockValues = timeBlocks.map(block =>
                  block.hours.reduce((sum, h) => sum + (hourlyData[h] || 0), 0)
                )
                const maxBlockValue = Math.max(...blockValues, 1)
                const peakIndex = blockValues.indexOf(maxBlockValue)

                return (
                  <div className="space-y-4">
                    {/* Barras horizontales */}
                    <div className="space-y-1.5">
                      {timeBlocks.map((block, index) => {
                        const value = blockValues[index]
                        const percentage = (value / maxBlockValue) * 100
                        const isPeak = index === peakIndex && value > 0

                        return (
                          <div key={block.label} className="flex items-center gap-2">
                            <span className="w-14 text-right text-[10px] text-[var(--qc-text-secondary)]">{block.label}h</span>
                            <div className="h-4 flex-1 overflow-hidden rounded-sm bg-foreground/[0.04] dark:bg-white/[0.06]">
                              <div
                                className={`h-full rounded-sm ${isPeak ? "bg-foreground" : "bg-foreground/15 dark:bg-white/[0.12]"}`}
                                style={{ width: `${Math.max(percentage, 2)}%` }}
                              />
                            </div>
                            <span className={`w-8 text-right text-[11px] ${isPeak ? "font-bold text-foreground" : "text-[var(--qc-text-secondary)]"}`}>
                              {value}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Leyenda */}
                    <div className="flex items-center justify-center gap-3 pt-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-foreground rounded-sm" />
                        <span className="text-[10px] text-[var(--qc-text-secondary)]">{t("peak")}</span>
                      </div>
                    </div>

                    <p className="text-center text-[9px] text-[var(--qc-text-secondary)]">
                      {t("chileTimezone")}
                    </p>
                  </div>
                )
              })()}
            </div>

            {/* Anuncio Display en sidebar */}
            <div className="p-4 flex-1 w-full">
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function StatPill({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-[var(--qc-text-secondary)]">{label}</span>
      <span className={`text-sm font-bold ${highlight ? "text-foreground dark:text-[#ffe3ad]" : "text-[var(--qc-text-secondary)]"}`}>{value}</span>
    </div>
  )
}


function PlayersList({ players, emptyText, loading = false, gameType = "ca" }: { players: RankingPlayer[]; emptyText: string; loading?: boolean; gameType?: string }) {
  if (loading) {
    return <LoadingScreen compact />
  }

  if (players.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-[var(--qc-text-secondary)]">{emptyText}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0">
      {players.map((player, index) => (
        <Link
          key={player.playerId}
          href={"/perfil/" + player.steamId}
          className={`flex items-center gap-2.5 py-2 px-3 transition-all hover:bg-foreground/[0.02] dark:hover:bg-white/[0.03] group rounded-lg ${index < players.length - 1 ? "border-b border-foreground/[0.06]" : ""
            }`}
        >
          <RankValue rank={player.rank} totalPlayers={10} className="w-6 text-center text-xs" showHash={true} />
          <div className="qc-identity-inline flex-1 min-w-0 gap-2.5">
            <span className="qc-identity-inline__avatar">
              <PlayerAvatar steamId={player.steamId} playerName={player.username} size="xs" />
            </span>
            <IdentityBadges
              className="qc-identity-inline__badges"
              countryCode={player.countryCode}
              countryName={player.countryCode}
              clanTag={player.clanTag}
              clanName={player.clanTag}
              clanAvatar={player.clanAvatarUrl}
              size="xs"
              showTooltips={false}
            />
            <span className="qc-identity-inline__name truncate text-sm text-[var(--qc-text-secondary)] transition-colors group-hover:text-foreground">
              {parseQuakeColors(player.username)}
            </span>
          </div>
          <div className="flex items-center flex-shrink-0">
            <div className="w-10 justify-center flex icon-shadow">
              <TierBadgeInline elo={player.rating !== undefined ? Math.round(player.rating) : 900} gameType={gameType} size="sm" />
            </div>
            <span className="w-12 text-center text-sm font-medium text-[var(--qc-text-secondary)]">
              {player.rating !== undefined ? Math.round(player.rating) : 900}
            </span>
            <span className="w-12 text-right text-[11px] font-medium text-[var(--qc-text-secondary)]">
              {player.avgKD !== undefined ? player.avgKD.toFixed(2) : "-"}
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}

function ClansList({ clans, emptyText, loading = false, gameType = "ca" }: { clans: ClanRanking[]; emptyText: string; loading?: boolean; gameType?: string }) {
  if (loading) {
    return <LoadingScreen compact />
  }

  if (clans.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-[var(--qc-text-secondary)]">{emptyText}</p>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {clans.map((clan, index) => (
        <Link
          key={clan.slug}
          href={`/clanes/${clan.slug}`}
          className={`flex items-center gap-3 py-3.5 px-3 transition-all hover:bg-foreground/[0.02] dark:hover:bg-white/[0.03] group ${index !== clans.length - 1 ? "border-b border-foreground/[0.06]" : ""
            }`}
        >
          <RankValue rank={clan.rank} totalPlayers={10} className="w-7 text-center text-sm" showHash={true} />
          <FlagClan clanTag={clan.tag} clanName={clan.name} clanAvatar={clan.avatarUrl} />
          <span className="flex-1 truncate text-base text-[var(--qc-text-secondary)] transition-colors group-hover:text-foreground">
            {clan.name}
          </span>
          <div className="flex items-center">
            <div className="w-10 justify-center flex icon-shadow">
              <TierBadgeInline elo={Math.round(clan.avgElo)} gameType={gameType} size="sm" />
            </div>
            <span className="w-12 text-center text-sm font-medium text-[var(--qc-text-secondary)]">{Math.round(clan.avgElo)}</span>
            <span className="w-12 text-right text-sm text-[var(--qc-text-secondary)]">{clan.members}</span>
          </div>
        </Link>
      ))}
    </div>
  )
}
