"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useQuery } from "@tanstack/react-query"
import { useDebouncedLoading } from "@/hooks/use-debounced-loading"
import { LoadingScreen } from "@/components/loading-screen"
import { ProfileHeader } from "@/components/profile/profile-header"
import { ProfileBioSection } from "@/components/profile/profile-bio-section"
import { ProfileSidebar } from "@/components/profile/profile-sidebar"
import { useTranslations } from "next-intl"

const EloChart = dynamic(() => import("@/components/elo-chart").then(m => m.EloChart), { ssr: false })
const WeaponGodsProgress = dynamic(() => import("@/components/weapon-gods-progress").then(m => m.WeaponGodsProgress), { ssr: false })

interface User {
  id: string
  steamId?: string
  username: string
  isAdmin?: boolean
  avatar?: string
  createdAt?: number
  isRegistered?: boolean
  ratings?: Array<{
    gameType: string
    rating: number | null
    games: number
    wins: number
    losses: number
    draws: number
    lastPlayed: string
    gamesRemaining?: number
    minGames?: number
    isPlacement?: boolean
  }>
}

interface ProfileContentProps {
  user: User
  isOwnProfile?: boolean
  isLoggedIn?: boolean
}

const WEAPON_INFO: Record<string, { name: string; icon: string }> = {
  RG: { name: "Railgun", icon: "/weapons/railgun.png" },
  RL: { name: "Rocket Launcher", icon: "/weapons/rocket.png" },
  PG: { name: "Plasma Gun", icon: "/weapons/plasma.png" },
  SG: { name: "Shotgun", icon: "/weapons/shotgun.png" },
  LG: { name: "Lightning Gun", icon: "/weapons/lightning.png" },
  GL: { name: "Grenade Launcher", icon: "/weapons/grenade.png" },
  MG: { name: "Machine Gun", icon: "/weapons/machinegun.png" },
  HMG: { name: "Heavy Machine Gun", icon: "/weapons/hmg.png" },
  GT: { name: "Gauntlet", icon: "/gauntlet.png" },
}

const MEDAL_INFO: Record<string, { name: string; icon: string }> = {
  accuracy: { name: "Accuracy", icon: "/medals/medal_accuracy.png" },
  assists: { name: "Assist", icon: "/medals/medal_assist.png" },
  captures: { name: "Capture", icon: "/medals/medal_capture.png" },
  combokill: { name: "Combo Kill", icon: "/medals/medal_combokill.png" },
  defends: { name: "Defense", icon: "/medals/medal_defense.png" },
  excellent: { name: "Excellent", icon: "/medals/medal_excellent.png" },
  firstfrag: { name: "First Frag", icon: "/medals/medal_firstfrag.png" },
  headshot: { name: "Headshot", icon: "/medals/medal_headshot.png" },
  humiliation: { name: "Humiliation", icon: "/medals/medal_gauntlet.png" },
  impressive: { name: "Impressive", icon: "/medals/medal_impressive.png" },
  midair: { name: "Midair", icon: "/medals/medal_midair.png" },
  perfect: { name: "Perfect", icon: "/medals/medal_perfect.png" },
  perforated: { name: "Perforated", icon: "/medals/medal_perforated.png" },
  quadgod: { name: "Quad God", icon: "/medals/medal_quadgod.png" },
  rampage: { name: "Rampage", icon: "/medals/medal_rampage.png" },
  revenge: { name: "Revenge", icon: "/medals/medal_revenge.png" },
}


const VALID_GAME_MODES = ["ca", "duel", "ctf", "ffa", "tdm", "ad", "ft", "dom"]

const gameModes = [
  { id: "ca", name: "CA" },
  { id: "duel", name: "Duel" },
  { id: "ctf", name: "CTF" },
  { id: "ffa", name: "FFA" },
  { id: "tdm", name: "TDM" },
  { id: "ad", name: "AD" },
  { id: "ft", name: "FT" },
  { id: "dom", name: "DOM" },
]

export function ProfileContent({ user: initialUser, isOwnProfile = false, isLoggedIn = false }: ProfileContentProps) {
  const t = useTranslations("profile")
  const dominantHue = 43 // Gold hue for QuakeClub

  const [selectedGameMode, setSelectedGameMode] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.slice(1).toLowerCase()
      if (VALID_GAME_MODES.includes(hash)) {
        return hash
      }
    }
    return "ca"
  })

  const [activeStatsTab, setActiveStatsTab] = useState<"matches" | "performance" | "weapons" | "medals">("matches")

  // Sync URL hash with selected game mode
  useEffect(() => {
    const newHash = `#${selectedGameMode}`
    if (window.location.hash !== newHash) {
      window.history.replaceState(null, '', newHash)
    }
  }, [selectedGameMode])

  // Listen for browser back/forward navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1).toLowerCase()
      if (VALID_GAME_MODES.includes(hash) && hash !== selectedGameMode) {
        setSelectedGameMode(hash)
      }
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [selectedGameMode])

  // Load player data
  const { data: playerData, isFetched: playerFetched } = useQuery({
    queryKey: ['player-data', initialUser.steamId],
    queryFn: async () => {
      const response = await fetch(`/api/player/${initialUser.steamId}`)
      if (!response.ok) throw new Error('Failed to fetch player data')
      return response.json()
    },
    enabled: !!initialUser.steamId,
    staleTime: 30 * 1000,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  })

  // Load ranking data
  const { data: rankingData } = useQuery({
    queryKey: ["player-ranking", initialUser.steamId, selectedGameMode],
    queryFn: async () => {
      if (selectedGameMode === "overall") {
        const response = await fetch(`/api/player/${initialUser.steamId}/rank`)
        if (!response.ok) throw new Error("Failed to fetch player ranking")
        return response.json()
      } else {
        const response = await fetch(`/api/rankings/player/${initialUser.steamId}?gameType=${selectedGameMode}`)
        if (!response.ok) throw new Error("Failed to fetch player ranking")
        const data = await response.json()
        return { globalRank: data.rank, totalPlayers: data.totalPlayers, minGames: data.minGames, gamesRemaining: data.gamesRemaining, totalGames: data.totalGames, message: data.message }
      }
    },
    enabled: !!initialUser.steamId,
    staleTime: 30 * 1000,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  })

  // Derive user from playerData or initialUser
  const user = playerData ? {
    ...initialUser,
    username: playerData.username || initialUser.username,
    avatar: playerData.avatar || initialUser.avatar,
    ratings: playerData.ratings,
    isRegistered: playerData.isRegistered,
    createdAt: playerData.createdAt || initialUser.createdAt,
    roles: playerData.roles || [],
  } : initialUser

  // Load matches data
  const { data: matchesData, isLoading: loadingStats, isFetched: matchesFetched } = useQuery({
    queryKey: ['player-matches', initialUser.steamId, selectedGameMode],
    queryFn: async () => {
      const gameTypeParam = selectedGameMode !== "overall" ? `gameType=${selectedGameMode}` : ""
      const response = await fetch(`/api/players/${initialUser.steamId}/matches?${gameTypeParam}`)
      if (!response.ok) throw new Error('Failed to fetch recent matches')
      const data = await response.json()
      if (data.success && data.matches) {
        return {
          totalMatches: data.total || data.matches.length,
          qlStats: {
            stats: {
              games: 0, wins: 0, losses: 0, kills: 0, deaths: 0,
              kd: 0, favoriteMap: "", playTime: 0, elo: 0, rankName: "", winRate: 0,
            },
            recentGames: data.matches.map((match: any) => ({
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
            })),
          }
        }
      }
      return { totalMatches: 0, qlStats: null }
    },
    enabled: !!initialUser.steamId,
    staleTime: 2 * 60 * 1000,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  })

  const totalMatches = matchesData?.totalMatches || 0
  const qlStats = matchesData?.qlStats || null
  const showLoadingStats = useDebouncedLoading(loadingStats, 600)

  // Load custom stats
  const { data: customStats, isFetched: customStatsFetched } = useQuery({
    queryKey: ['custom-stats', initialUser.steamId, selectedGameMode],
    queryFn: async () => {
      const gameTypeParam = selectedGameMode === "overall" ? "overall" : selectedGameMode
      const response = await fetch(`/api/stats/${initialUser.steamId}?gameType=${gameTypeParam}`)
      if (!response.ok) throw new Error('Failed to fetch custom stats')
      const data = await response.json()
      return data.success ? data : null
    },
    enabled: !!initialUser.steamId,
    staleTime: 30 * 1000,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  })

  // Load overall stats (always total, independent of selected game mode) for hours bar
  const { data: overallStats } = useQuery({
    queryKey: ['custom-stats-overall', initialUser.steamId],
    queryFn: async () => {
      const response = await fetch(`/api/stats/${initialUser.steamId}?gameType=overall`)
      if (!response.ok) return null
      const data = await response.json()
      return data.success ? data : null
    },
    enabled: !!initialUser.steamId,
    staleTime: 60 * 1000,
    refetchOnMount: false,
  })

  // Load Steam playtime (real Quake Live hours from Steam)
  const { data: steamPlaytime } = useQuery({
    queryKey: ['steam-playtime', initialUser.steamId],
    queryFn: async () => {
      const response = await fetch(`/api/players/${initialUser.steamId}/steam-playtime`)
      if (!response.ok) return null
      return response.json()
    },
    enabled: !!initialUser.steamId,
    staleTime: 60 * 60 * 1000, // 1 hour client-side cache
    refetchOnMount: false,
  })

  // Load linked accounts (confirmed multi-account groups)
  const { data: linkedAccountsData } = useQuery({
    queryKey: ['linked-accounts', initialUser.steamId],
    queryFn: async () => {
      const response = await fetch(`/api/players/linked-accounts?steamId=${initialUser.steamId}`)
      if (!response.ok) return null
      return response.json()
    },
    enabled: !!initialUser.steamId,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
  })

  // Show skeleton until all data is loaded
  const allDataLoaded = playerFetched && matchesFetched && customStatsFetched
  const showProfileSkeleton = !allDataLoaded

  // Get current mode rating
  const getCurrentModeRating = () => {
    if (!user.ratings || user.ratings.length === 0) return null

    if (selectedGameMode === "overall") {
      const visibleRatings = user.ratings.filter((rating) => typeof rating.rating === "number")
      const totalGames = user.ratings.reduce((sum, r) => sum + r.games, 0)
      const totalWins = user.ratings.reduce((sum, r) => sum + r.wins, 0)
      const totalLosses = user.ratings.reduce((sum, r) => sum + r.losses, 0)
      const avgRating = visibleRatings.length > 0
        ? Math.round(visibleRatings.reduce((sum, r) => sum + (r.rating || 0), 0) / visibleRatings.length)
        : null

      return {
        rating: avgRating,
        games: totalGames,
        wins: totalWins,
        losses: totalLosses,
      }
    }

    return user.ratings.find((r) => r.gameType.toLowerCase() === selectedGameMode)
  }

  const currentRating = getCurrentModeRating()

  const calculatedGames = currentRating
    ? (currentRating.games || (currentRating.wins || 0) + (currentRating.losses || 0) + (currentRating.draws || 0))
    : 0

  const stats = currentRating
    ? {
      gamesPlayed: calculatedGames,
      wins: currentRating.wins,
      losses: currentRating.losses,
      kdRatio:
        customStats?.overallStats?.totalKills
          ? (customStats.overallStats.totalKills / Math.max(customStats.overallStats.totalDeaths || 0, 1)).toFixed(2)
          : "0.00",
      favoriteMap: customStats?.player?.favoriteMap || "N/A",
      joinDate: user.createdAt
        ? new Date(user.createdAt).toLocaleDateString("es-ES", { month: "long", year: "numeric" })
        : "Desconocido",
      rank: "legacy-removed",
      elo: currentRating.rating ?? 0,
    }
    : {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      kdRatio: "0.00",
      favoriteMap: "N/A",
      joinDate: user.createdAt
        ? new Date(user.createdAt).toLocaleDateString("es-ES", { month: "long", year: "numeric" })
        : "Desconocido",
      rank: "Sin Clasificar",
      elo: 0,
    }

  if (showProfileSkeleton) {
    return <LoadingScreen />
  }

  return (
    <div className="mx-auto max-w-[1080px] animate-fade-up space-y-4">
      {/* Top Ad - In-Feed */}

      {/* Main Container */}
      <div className="glass-card-elevated rounded-[20px] sm:rounded-[24px] overflow-hidden animate-scale-fade [animation-delay:100ms]">
        {/* Suspension/Ban Banner */}
        {(playerData?.isBanned || playerData?.isSuspended) && (
          <div className={`px-6 py-4 border-b ${playerData?.isBanned ? "bg-red-100 border-red-300/40" : "bg-yellow-100 border-yellow-300/40"}`}>
            <p className={`text-sm font-bold uppercase tracking-wider ${playerData?.isBanned ? "text-red-600" : "text-yellow-600"}`}>
              {playerData?.isBanned ? "Cuenta Baneada" : "Cuenta Suspendida"}
            </p>
            {(playerData?.banReason || playerData?.suspendReason) && (
              <p className="text-xs text-foreground/50 mt-1">{playerData?.banReason || playerData?.suspendReason}</p>
            )}
          </div>
        )}

        {/* Quit Warning Banner */}
        {playerData?.activeQuits >= 3 && (
          <div className={`px-6 py-3 border-b ${playerData.activeQuits >= 5 ? "bg-red-500/10 border-red-500/20" : "bg-orange-500/10 border-orange-500/20"}`}>
            <p className={`text-xs font-bold uppercase tracking-wider ${playerData.activeQuits >= 5 ? "text-red-500" : "text-orange-400"}`}>
              {playerData.activeQuits >= 5 ? "Penalizado por quits" : "Advertencia de quits"}
            </p>
            <p className="text-[10px] text-foreground/40">
              {playerData.activeQuits}/5 quits en los últimos 7 días{playerData.activeQuits >= 5 ? " (-150 ELO aplicado)" : ""}
            </p>
          </div>
        )}

        {/* Two Column Layout */}
        <div className="flex flex-col lg:flex-row">
          {/* Main Column (Header + Content) */}
          <div className="flex-1 min-w-0">
            {/* Header Section */}
            <ProfileHeader
              user={user}
              playerData={playerData}
              isOwnProfile={isOwnProfile}
              joinDate={stats.joinDate}
            />

            <ProfileBioSection
              steamId={initialUser.steamId}
              profileExtras={playerData?.profileExtras}
              isOwnProfile={isOwnProfile}
            />

            {/* Hours Played Bar */}
            {(() => {
              const totalSeconds = overallStats?.overallStats?.totalPlayTimeSeconds || customStats?.overallStats?.totalPlayTimeSeconds || 0
              const hasSteam = steamPlaytime?.playtimeMinutes && steamPlaytime.playtimeMinutes > 0
              if (totalSeconds === 0 && !hasSteam) return null
              const hours = Math.floor(totalSeconds / 3600)
              const minutes = Math.floor((totalSeconds % 3600) / 60)
              const displayTime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
              return (
                <div className="px-4 sm:px-5 lg:px-6 py-2.5 border-t border-foreground/[0.06] bg-[var(--qc-bg-pure)] flex items-center gap-3 flex-wrap">
                  {totalSeconds > 0 && (
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-tiktok text-base font-bold text-foreground tracking-wide">{displayTime}</span>
                      <span className="text-[9px] text-[var(--qc-text-muted)] uppercase tracking-wider">{t("hoursPlayed")}</span>
                    </div>
                  )}
                  {hasSteam && totalSeconds > 0 && (
                    <span className="text-foreground/15 text-[10px]">|</span>
                  )}
                  {hasSteam && (
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-tiktok text-base font-bold text-foreground/55 tracking-wide">{steamPlaytime.playtimeHours}</span>
                      <span className="text-[9px] text-[var(--qc-text-muted)] uppercase tracking-wider">Quake Live (Steam)</span>
                    </div>
                  )}
                  <span className="text-[9px] text-foreground/28 uppercase tracking-wider">
                    {hasSteam ? t("hoursPlayedSteamDisclaimer") : t("hoursPlayedDisclaimer")}
                  </span>
                </div>
              )
            })()}

            {/* Linked Accounts (aka) */}
            {linkedAccountsData?.linked && linkedAccountsData.linked.length > 0 && (
              <div className="px-4 sm:px-5 lg:px-6 py-2.5 border-t border-foreground/[0.06] bg-[var(--qc-bg-pure)]/70 dark:bg-[var(--qc-bg-medium)]/60 flex items-center gap-2 flex-wrap">
                {linkedAccountsData.isPrimary ? (
                  <span className="text-[9px] text-foreground/45 uppercase tracking-wider font-bold">aka</span>
                ) : (
                  <span className="text-[9px] text-foreground/45 uppercase tracking-wider font-bold">Cuenta alternativa de</span>
                )}
                {linkedAccountsData.linked.map((la: { steamId: string; isPrimary: boolean; player: { steamId: string; username: string; avatar: string | null } | null }) => (
                  <Link
                    key={la.steamId}
                    href={`/perfil/${la.steamId}`}
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium transition-colors ${
                      la.isPrimary
                        ? "bg-foreground/[0.10] hover:bg-foreground/[0.16] text-foreground"
                        : "bg-foreground/[0.06] hover:bg-foreground/[0.10] text-foreground/80"
                    }`}
                  >
                    {la.player?.avatar && (
                      <Image src={la.player.avatar} alt="" width={14} height={14} className="rounded-full" />
                    )}
                    {la.player?.username || la.steamId}
                  </Link>
                ))}
              </div>
            )}

            {/* Content Area */}
            <div className="bg-[var(--qc-bg-page)] p-3 sm:p-4 lg:p-5">
              {/* Game Mode Tabs */}
              <div className="flex items-center gap-0.5 mb-3 pb-2 border-b border-foreground/[0.06] overflow-x-auto">
                {gameModes.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setSelectedGameMode(mode.id)}
                    className={`px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all rounded-lg flex-shrink-0 ${selectedGameMode === mode.id
                      ? "bg-foreground text-background"
                      : "text-[var(--qc-text-muted)] hover:text-foreground/60"
                      }`}
                  >
                    {mode.name}
                  </button>
                ))}
              </div>

              {/* Stats Section Tabs */}
              <div className="flex items-center gap-1 mb-3 overflow-x-auto scrollbar-thin pb-1 sm:pb-0">
                {[
                  { id: "matches", label: t("recentActivity") },
                  { id: "performance", label: t("historicPerformance") },
                  { id: "weapons", label: t("weaponStats") },
                  { id: "medals", label: t("medals") },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveStatsTab(tab.id as typeof activeStatsTab)}
                    className={`px-3 sm:px-4 py-2 sm:py-2.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all rounded-lg flex-shrink-0 ${
                      activeStatsTab === tab.id
                        ? "text-foreground"
                        : "text-foreground/30 hover:text-foreground/50"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content - Performance (ELO Chart) */}
              {activeStatsTab === "performance" && initialUser.steamId && (
                <div className="space-y-4">
                  <div className="bg-foreground/[0.02] rounded-lg p-4">
                    <EloChart steamId={initialUser.steamId} selectedGameMode={selectedGameMode} dominantHue={dominantHue} />
                  </div>
                </div>
              )}

              {/* Tab Content - Weapons */}
              {activeStatsTab === "weapons" && (
                <div className="bg-foreground/[0.02] rounded-lg p-4">
                  {customStats && customStats.weaponStats && Object.keys(customStats.weaponStats).length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
                      {Object.entries(customStats.weaponStats)
                        .filter(([weaponKey]) => weaponKey !== "GT")
                        .map(([weaponKey, weaponStats]: [string, any]) => {
                          const weaponInfo = WEAPON_INFO[weaponKey] || { name: weaponKey, icon: null }
                          return (
                            <div
                              key={weaponKey}
                              className="bg-foreground/[0.03] hover:bg-foreground/[0.06] p-2.5 sm:p-3 flex flex-col items-center gap-1.5 sm:gap-2 transition-all rounded-lg cursor-pointer group"
                            >
                              {weaponInfo.icon && (
                                <div className="w-10 h-10 relative group-hover:scale-110 transition-transform">
                                  <Image
                                    src={weaponInfo.icon || "/branding/logo.png"}
                                    alt={weaponInfo.name}
                                    width={40}
                                    height={40}
                                    className="w-full h-full object-contain"
                                    unoptimized
                                  />
                                </div>
                              )}
                              <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 group-hover:text-foreground/50 transition-colors">
                                {weaponKey}
                              </p>
                              <p className="text-sm font-bold text-foreground">{weaponStats.accuracy}%</p>
                            </div>
                          )
                        })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <p className="text-xs text-foreground/40">
                        {selectedGameMode === "overall"
                          ? t("noWeaponStats")
                          : t("noWeaponStatsMode", { mode: gameModes.find((m) => m.id === selectedGameMode)?.name || selectedGameMode.toUpperCase() })}
                      </p>
                      <p className="mt-1 text-[10px] text-foreground/25">{t("playToTrackStats")}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content - Medals */}
              {activeStatsTab === "medals" && (
                <div className="bg-foreground/[0.02] rounded-lg p-4">
                  {customStats && customStats.medals && Object.values(customStats.medals).some((count: any) => count > 0) ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
                      {Object.entries(customStats.medals)
                        .filter(([_, count]) => count > 0)
                        .sort(([_, a], [__, b]) => (b as number) - (a as number))
                        .map(([medalKey, count]: [string, any]) => {
                          const medalInfo = MEDAL_INFO[medalKey] || { name: medalKey, icon: null }
                          return (
                            <div key={medalKey} className="bg-foreground/[0.03] hover:bg-foreground/[0.06] p-2.5 sm:p-3 flex flex-col items-center gap-1.5 sm:gap-2 transition-all rounded-lg cursor-pointer group">
                              {medalInfo.icon && (
                                <div className="w-10 h-10 relative group-hover:scale-110 transition-transform">
                                  <Image
                                    src={medalInfo.icon || "/branding/logo.png"}
                                    alt={medalInfo.name}
                                    width={40}
                                    height={40}
                                    className="w-full h-full object-contain"
                                    unoptimized
                                  />
                                </div>
                              )}
                              <p className="text-sm font-bold text-foreground">{count}</p>
                              <p className="text-[10px] font-bold uppercase tracking-wide text-foreground/30 leading-tight text-center">
                                {medalInfo.name}
                              </p>
                            </div>
                          )
                        })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <p className="text-xs text-foreground/40">
                        {selectedGameMode === "overall"
                          ? t("noMedals")
                          : t("noMedalsMode", { mode: gameModes.find((m) => m.id === selectedGameMode)?.name || selectedGameMode.toUpperCase() })}
                      </p>
                      <p className="mt-1 text-[10px] text-foreground/25">{t("playToEarnMedals")}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content - Recent Matches */}
              {activeStatsTab === "matches" && (
                <div className="bg-foreground/[0.02] rounded-lg p-4" style={{ minHeight: loadingStats ? '300px' : 'auto' }}>
                  {showLoadingStats && (!qlStats || !qlStats.recentGames) ? (
                    <LoadingScreen compact />
                  ) : qlStats && qlStats.recentGames && qlStats.recentGames.length > 0 ? (
                    <div className="space-y-2">
                      {qlStats.recentGames.slice(0, 5).map((game, index) => (
                        <Link
                          key={index}
                          href={`/match/${game.matchId}`}
                          className="flex items-center gap-3 p-3 bg-foreground/[0.02] hover:bg-foreground/[0.05] rounded-lg transition-all group"
                        >
                          <div className="h-12 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-foreground/[0.08]">
                            <Image
                              src={`/levelshots/${game.map}.jpg`}
                              alt={game.map}
                              width={64}
                              height={48}
                              className="h-full w-full object-cover"
                              unoptimized
                              onError={(e) => { const target = e.target as HTMLImageElement; target.src = "/levelshots/default.jpg" }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="rounded bg-foreground/[0.08] px-1.5 py-0.5 text-[8px] font-bold uppercase text-foreground/60">{game.gameType}</span>
                              <span className="text-[10px] text-foreground/40 uppercase">{game.map}</span>
                            </div>
                            <p className="text-xs text-foreground/50 truncate">{game.server || "QuakeClub Server"}</p>
                            {game.opponent && <p className="text-[10px] text-foreground/60">vs {game.opponent}</p>}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className={`font-tiktok text-sm font-bold ${game.result === "win" ? "text-green-600" : "text-red-500"}`}>
                              {game.result === "win" ? "W" : "L"}
                            </span>
                            {game.eloChange !== undefined && (
                              <span className={`text-[10px] font-bold ${game.eloChange > 0 ? "text-green-600" : game.eloChange < 0 ? "text-red-500" : "text-foreground/25"}`}>
                                {game.eloChange > 0 ? `+${game.eloChange}` : game.eloChange < 0 ? game.eloChange : "-"}
                              </span>
                            )}
                            <span className="text-[9px] text-foreground/25">
                              {new Date(game.timestamp).toLocaleDateString("es-CL", { month: "short", day: "numeric" })}
                            </span>
                          </div>
                        </Link>
                      ))}
                      {qlStats.recentGames.length > 5 && (
                        <Link
                          href={`/perfil/${initialUser.steamId}/matches`}
                          className="block text-center py-3 text-xs font-bold uppercase tracking-wider text-foreground/40 hover:text-foreground transition-colors"
                        >
                          {t("viewAllMatches")} ({stats.gamesPlayed})
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <p className="text-xs text-foreground/40">
                        {selectedGameMode === "overall"
                          ? t("noMatchesYet")
                          : t("noRecentMatchesMode", { mode: gameModes.find((m) => m.id === selectedGameMode)?.name || selectedGameMode.toUpperCase() })}
                      </p>
                      <p className="mt-1 text-[10px] text-foreground/25">
                        {selectedGameMode === "overall" ? t("playToTrack") : t("lastMatchesNotInclude")}
                      </p>
                    </div>
                  )}

                  {/* Weapon Gods Progress */}
                  {customStats?.player?.totalMatches > 0 && (
                    <div className="mt-4">
                      <WeaponGodsProgress steamId={initialUser.steamId || ""} gameType={selectedGameMode} />
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

          {/* Sidebar */}
          <ProfileSidebar
            steamId={initialUser.steamId || ""}
            stats={stats}
            ranking={rankingData}
            selectedGameMode={selectedGameMode}
            customStats={customStats}
          />
        </div>
      </div>

      {/* Bottom Ad - Display */}
    </div>
  )
}
