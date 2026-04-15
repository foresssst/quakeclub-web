"use client"

import dynamic from "next/dynamic"
import Image from "next/image"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Clock, Info } from "lucide-react"
import { RankValue } from "@/components/rank-value"
import { TierBadge } from "@/components/tier-badge"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"

const EloChart = dynamic(() => import("@/components/elo-chart").then(m => m.EloChart), { ssr: false })

interface ProfileStatsDetailProps {
  steamId: string
  stats: {
    elo: number
    wins: number
    losses: number
    gamesPlayed: number
    kdRatio: string
    favoriteMap: string
  }
  ranking: {
    globalRank: number | null
    totalPlayers: number | null
  } | null
  selectedGameMode: string
  customStats: {
    overallStats?: {
      totalKills: number
      totalDeaths: number
      totalPlayTimeSeconds?: number
    }
  } | null
}

export function ProfileStatsDetail({ steamId, stats, ranking, selectedGameMode, customStats }: ProfileStatsDetailProps) {
  const t = useTranslations("profile")

  const winRate = stats.gamesPlayed > 0
    ? Math.round((stats.wins / stats.gamesPlayed) * 100)
    : 0

  const totalKills = customStats?.overallStats?.totalKills || 0
  const totalDeaths = customStats?.overallStats?.totalDeaths || 0

  // Format play time
  const totalSeconds = customStats?.overallStats?.totalPlayTimeSeconds || 0
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const displayTime = totalSeconds > 0
    ? (hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`)
    : "0m"

  return (
    <div className="bg-[var(--qc-bg-medium)] px-4 sm:px-5 lg:px-6 py-4 sm:py-5">
      {/* Top Row: Tier + ELO | Global Rank */}
      <div className="flex items-center justify-between gap-4 mb-4">
        {/* Left: Tier + ELO */}
        <div className="flex items-center gap-3">
          <span className="icon-shadow">
            <TierBadge elo={stats.elo} gameType={selectedGameMode} size="xl" showTooltip={true} />
          </span>
          <div className="flex flex-col">
            <span className="font-tiktok text-3xl font-bold text-foreground tracking-tight">{stats.elo}</span>
            <span className="text-[10px] text-foreground/40 uppercase tracking-wider">{selectedGameMode} ELO</span>
          </div>
        </div>

        {/* Right: Global Rank */}
        {ranking && ranking.globalRank && (
          <Link
            href={`/rankings?gameType=${selectedGameMode.toLowerCase()}`}
            className="text-right group"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 mb-0.5">
              {t("globalRanking")}
            </p>
            <RankValue
              rank={ranking.globalRank}
              totalPlayers={ranking.totalPlayers || undefined}
              className="text-4xl sm:text-5xl group-hover:scale-105 transition-transform inline-block"
            />
            <p className="text-[10px] text-foreground/30 mt-0.5">
              de {ranking.totalPlayers?.toLocaleString() || "..."} jugadores
            </p>
          </Link>
        )}
      </div>

      {/* ELO Chart (compact) */}
      <div className="mb-4">
        <EloChart steamId={steamId} selectedGameMode={selectedGameMode} dominantHue={43} compact={true} />
      </div>

      {/* Separator */}
      <div className="h-[2px] bg-foreground/[0.06] mb-4" />

      {/* Stats Grid - Row 1: Key Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3">
        {/* Play Time */}
        <div className="bg-foreground/[0.04] rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Clock className="h-3.5 w-3.5 text-foreground/25" />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3 w-3 text-foreground/20 hover:text-foreground/35 transition-colors" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-[11px] max-w-[200px]">{t("hoursPlayedDisclaimer")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="font-tiktok text-lg sm:text-xl font-bold text-foreground">{displayTime}</p>
          <p className="text-[9px] text-foreground/30 uppercase tracking-wider">{t("playTime")}</p>
        </div>

        {/* K/D Ratio */}
        <div className="bg-foreground/[0.04] rounded-lg p-3 text-center">
          <p className="font-tiktok text-lg sm:text-xl font-bold text-foreground mt-3">{stats.kdRatio}</p>
          <p className="text-[9px] text-foreground/30 uppercase tracking-wider">K/D Ratio</p>
          <p className="text-[9px] text-foreground/20 mt-0.5">
            {totalKills.toLocaleString()}k / {totalDeaths.toLocaleString()}d
          </p>
        </div>

        {/* Win Rate */}
        <div className="bg-foreground/[0.04] rounded-lg p-3 text-center">
          <p className="font-tiktok text-lg sm:text-xl font-bold text-foreground mt-3">{winRate}%</p>
          <p className="text-[9px] text-foreground/30 uppercase tracking-wider">{t("winRate")}</p>
        </div>

        {/* Total Games */}
        <div className="bg-foreground/[0.04] rounded-lg p-3 text-center">
          <p className="font-tiktok text-lg sm:text-xl font-bold text-foreground mt-3">{stats.gamesPlayed.toLocaleString()}</p>
          <p className="text-[9px] text-foreground/30 uppercase tracking-wider">{t("totalGames")}</p>
        </div>
      </div>

      {/* Stats Grid - Row 2: W/L + Favorite Map */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
        <div className="bg-foreground/[0.04] rounded-lg p-2.5 text-center">
          <p className="font-tiktok text-lg font-bold text-foreground">{stats.wins}</p>
          <p className="text-[9px] text-foreground/30 uppercase">{t("wins")}</p>
        </div>
        <div className="bg-foreground/[0.04] rounded-lg p-2.5 text-center">
          <p className="font-tiktok text-lg font-bold text-foreground">{stats.losses}</p>
          <p className="text-[9px] text-foreground/30 uppercase">{t("losses")}</p>
        </div>

        {/* Favorite Map */}
        <div className="relative rounded-lg overflow-hidden group cursor-default">
          <Image
            src={`/levelshots/${stats.favoriteMap?.toLowerCase() || 'campgrounds'}.jpg`}
            alt={stats.favoriteMap || 'Map'}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-110"
            unoptimized
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.src = "/levelshots/default.jpg"
            }}
          />
          <div className="absolute inset-0 bg-black/45" />
          <div className="absolute bottom-0 left-0 right-0 p-2 text-center">
            <p className="text-[10px] font-bold text-white capitalize truncate">
              {stats.favoriteMap || "N/A"}
            </p>
            <p className="text-[8px] text-white/50 uppercase">{t("favoriteMap")}</p>
          </div>
        </div>
      </div>

      {/* Win Rate Bar */}
      <div className="space-y-1.5 mb-3">
        <div className="flex justify-between text-[10px]">
          <span className="text-foreground/40">{t("winRate")}</span>
          <span className="font-bold text-foreground">{winRate}%</span>
        </div>
        <div className="h-2 bg-foreground/[0.08] rounded-full overflow-hidden">
          <div
            className="h-full bg-foreground rounded-full transition-all duration-500"
            style={{ width: `${winRate}%` }}
          />
        </div>
      </div>

      {/* View All Matches */}
      <Link
        href={`/perfil/${steamId}/matches`}
        className="flex items-center justify-center gap-2 w-full py-2.5 text-[10px] font-bold uppercase tracking-wider text-foreground/40 hover:text-foreground bg-foreground/[0.04] hover:bg-foreground/[0.08] rounded-lg transition-all"
      >
        {t("viewAllMatches")}
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  )
}
