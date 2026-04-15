"use client"

import Image from "next/image"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { RankValue } from "@/components/rank-value"
import { TierBadge } from "@/components/tier-badge"

interface ProfileSidebarProps {
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
    gamesRemaining?: number
    minGames?: number
    totalGames?: number
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

export function ProfileSidebar({ steamId, stats, ranking, selectedGameMode, customStats }: ProfileSidebarProps) {
  const t = useTranslations("profile")

  const isPlacement = ranking ? !ranking.globalRank && (ranking.gamesRemaining ?? 0) > 0 : false

  const winRate = stats.gamesPlayed > 0
    ? Math.round((stats.wins / stats.gamesPlayed) * 100)
    : 0

  const totalKills = customStats?.overallStats?.totalKills || 0
  const totalDeaths = customStats?.overallStats?.totalDeaths || 0

  return (
    <div className="lg:w-72 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-foreground/[0.06] bg-[var(--qc-bg-pure)]">
      <div className="p-4 sm:p-5 space-y-4 sm:space-y-5">
        {/* Tier Section */}
        <div className="space-y-2">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30">
            Tier
          </h3>
          <div className="flex items-center gap-3">
            {isPlacement ? (
              <>
                <span className="icon-shadow"><TierBadge elo={0} gameType={selectedGameMode} size="xl" showTooltip={false} /></span>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-foreground">????</span>
                  <span className="text-[10px] text-foreground/40 uppercase">{selectedGameMode} ELO</span>
                </div>
              </>
            ) : (
              <>
                <span className="icon-shadow"><TierBadge elo={stats.elo} gameType={selectedGameMode} size="xl" showTooltip={true} /></span>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-foreground">{stats.elo}</span>
                  <span className="text-[10px] text-foreground/40 uppercase">{selectedGameMode} ELO</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Global Ranking Section */}
        {ranking && ranking.globalRank && (
          <Link
            href={`/rankings?gameType=${selectedGameMode.toLowerCase()}`}
            className="block space-y-2 group cursor-pointer hover:bg-foreground/[0.03] -mx-2 px-2 py-2 rounded-lg transition-colors pt-4 border-t border-foreground/[0.06]"
          >
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30">
              {t("globalRanking")}
            </h3>
            <div className="flex items-baseline gap-2">
              <RankValue
                rank={ranking.globalRank}
                totalPlayers={ranking.totalPlayers || undefined}
                className="text-3xl group-hover:scale-105 transition-transform"
              />
              <span className="text-xs text-foreground/40 uppercase">{selectedGameMode}</span>
            </div>
            <p className="text-[10px] text-foreground/30">
              de {ranking.totalPlayers?.toLocaleString() || "..."} jugadores
            </p>
          </Link>
        )}

        {ranking && !ranking.globalRank && ranking.gamesRemaining > 0 && (
          <div className="space-y-2 pt-4 border-t border-foreground/[0.06]">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30">
              {t("globalRanking")}
            </h3>
            <p className="text-sm text-foreground/50">
              Faltan <span className="font-bold text-foreground">{ranking.gamesRemaining}</span> partidas para el ranking de <span className="uppercase">{selectedGameMode}</span>
            </p>
            <div className="h-1.5 bg-foreground/[0.08] rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, ((ranking.totalGames || 0) / (ranking.minGames || 1)) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-foreground/30">
              {ranking.totalGames || 0} / {ranking.minGames || 0} partidas jugadas
            </p>
          </div>
        )}

        {/* Match Record Section */}
        <div className="space-y-3 pt-4 border-t border-foreground/[0.06]">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30">
            {t("matchRecord")}
          </h3>

          {/* Win Rate Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-foreground/50">{t("winRate")}</span>
              <span className="font-bold text-foreground">{winRate}%</span>
            </div>
            <div className="h-2 bg-foreground/[0.08] rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground rounded-full transition-all duration-500"
                style={{ width: `${winRate}%` }}
              />
            </div>
          </div>

          {/* W/L Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{stats.wins}</p>
              <p className="text-[9px] text-foreground/30 uppercase">{t("wins")}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{stats.losses}</p>
              <p className="text-[9px] text-foreground/30 uppercase">{t("losses")}</p>
            </div>
          </div>

          <p className="text-[10px] text-[var(--qc-text-muted)] text-center">
            {stats.gamesPlayed} {t("totalGames")}
          </p>
        </div>

        {/* Combat Stats Section */}
        <div className="space-y-3 pt-4 border-t border-foreground/[0.06]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-foreground/50">K/D Ratio</span>
            <span className="text-xl font-bold text-foreground">{stats.kdRatio}</span>
          </div>
          <div className="flex justify-between text-[10px] text-foreground/30">
            <span>{totalKills.toLocaleString()} kills</span>
            <span>{totalDeaths.toLocaleString()} deaths</span>
          </div>
        </div>


        {/* Favorite Map Section */}
        <div className="space-y-3 pt-4 border-t border-foreground/[0.06]">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30">
            {t("favoriteMap")}
          </h3>

          <div className="relative h-24 overflow-hidden group">
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
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <p className="text-sm font-bold text-white uppercase tracking-wider">
                {stats.favoriteMap || "N/A"}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
