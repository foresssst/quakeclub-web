"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { PlayerAvatar } from "@/components/player-avatar"
import { IdentityBadges } from "@/components/identity-badges"
import { parseQuakeColors } from "@/lib/quake-colors"
import { LoadingScreen } from "@/components/loading-screen"

interface WeaponGod {
  title: string
  weapon: string
  weaponIcon: string
  player: {
    steamId: string
    username: string
    avatar: string | null
    clan?: {
      tag: string
      name: string
      avatarUrl: string | null
    } | null
  }
  stat: number
  statLabel: string
}

const GAME_MODES = [
  { id: "ca", label: "CA" },
  { id: "duel", label: "Duel" },
  { id: "ctf", label: "CTF" },
  { id: "tdm", label: "TDM" },
  { id: "ffa", label: "FFA" },
]

export function WeaponGods() {
  const t = useTranslations("home")
  const [selectedMode, setSelectedMode] = useState("ca")

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["weapon-gods", selectedMode],
    queryFn: async () => {
      const res = await fetch(`/api/stats/weapon-gods?gameType=${selectedMode}`)
      if (!res.ok) return { gods: [] }
      return res.json()
    },
    staleTime: 10 * 60 * 1000,
  })

  const gods: WeaponGod[] = data?.gods || []

  return (
    <div className="px-6 py-5 border-t border-foreground/[0.06]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--qc-text-secondary)]">
            {t("weaponGods")}
          </h3>
          <div className="group relative">
            <svg className="w-3.5 h-3.5 cursor-help text-[var(--qc-text-muted)] transition-colors hover:text-foreground" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="absolute left-0 top-full mt-1 w-64 p-3 bg-card border border-foreground/[0.08] rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.14)" }}>
              <p className="text-[10px] font-bold uppercase text-foreground mb-2">{t("weaponGodsRequirements")}</p>
              <ul className="space-y-1 text-[10px] text-[var(--qc-text-secondary)]">
                <li>• {t("weaponGodsReqElo")}</li>
                <li>• {t("weaponGodsReqGames")}</li>
                <li>• {t("weaponGodsReqKillsPrimary")}</li>
                <li>• {t("weaponGodsReqKillsSecondary")}</li>
              </ul>
              <p className="mt-2 text-[9px] italic text-[var(--qc-text-muted)]">{t("weaponGodsNote")}</p>
            </div>
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-1">
          {GAME_MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setSelectedMode(mode.id)}
              className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-all rounded ${selectedMode === mode.id
                ? "bg-foreground text-background shadow-sm"
                : "bg-background text-[var(--qc-text-secondary)] hover:text-foreground hover:bg-card"
                }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingScreen compact />
      ) : gods.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-xs text-[var(--qc-text-secondary)]">{t("noWeaponGods")}</p>
        </div>
      ) : (
        <div className={`flex flex-col gap-0 ${isFetching ? "opacity-50" : ""}`}>
          {gods.map((god, index) => (
            <Link
              key={god.title}
              href={`/perfil/${god.player.steamId}`}
              className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 transition-all hover:bg-foreground/[0.02] dark:hover:bg-white/[0.03] ${index < gods.length - 1 ? "border-b border-foreground/[0.06]" : ""
                }`}
            >
              {/* Weapon icon */}
              <div className="relative w-6 h-6 flex-shrink-0 icon-shadow">
                <Image
                  src={god.weaponIcon || "/branding/logo.png"}
                  alt={god.weapon}
                  fill
                  className="object-contain opacity-60 group-hover:opacity-100 transition-opacity"
                  unoptimized
                />
              </div>
              {/* Weapon title */}
              <span className="w-20 flex-shrink-0 truncate text-[10px] font-bold uppercase tracking-wider text-[var(--qc-text-secondary)]">
                {t(god.title)}
              </span>
              {/* Player avatar */}
              <div className="qc-identity-inline flex-1 min-w-0 gap-2">
                <span className="qc-identity-inline__avatar">
                  <PlayerAvatar
                    steamId={god.player.steamId}
                    playerName={god.player.username}
                    size="xs"
                  />
                </span>
                <IdentityBadges
                  className="qc-identity-inline__badges"
                  clanTag={god.player.clan?.tag}
                  clanName={god.player.clan?.name}
                  clanAvatar={god.player.clan?.avatarUrl}
                  size="xs"
                  showTooltips={false}
                />
                {/* Player name */}
                <span className="qc-identity-inline__name truncate text-sm text-[var(--qc-text-secondary)] transition-colors group-hover:text-foreground">
                  {parseQuakeColors(god.player.username)}
                </span>
              </div>
              {/* Stat */}
              <div className="flex items-center flex-shrink-0">
                <span className="text-sm font-bold text-foreground tabular-nums">
                  {god.stat}%
                </span>
                <span className="ml-1 w-16 text-right text-[9px] uppercase text-[var(--qc-text-secondary)]">
                  {t(god.statLabel)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
