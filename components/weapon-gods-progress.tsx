"use client"

import Image from "next/image"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { LoadingScreen } from "@/components/loading-screen"
import { parseQuakeColors } from "@/lib/quake-colors"
import { PlayerAvatar } from "@/components/player-avatar"

interface WeaponGodsProgressProps {
  steamId: string
  gameType?: string
}

interface CurrentGod {
  username: string
  accuracy: number
  steamId: string
  avatar: string | null
}

interface WeaponProgress {
  weapon: string
  weaponKey: string
  weaponIcon: string
  currentKills: number
  requiredKills: number
  currentAccuracy: number
  meetsKillsReq: boolean
  meetsAllReqs: boolean
  currentRank: number | null
  potentialRank: number | null
  currentGod: CurrentGod | null
}

interface ProgressData {
  success: boolean
  requirements: {
    minElo: number
    minGames: number
    playerElo: number
    playerGames: number
    meetsEloReq: boolean
    meetsGamesReq: boolean
  }
  progress: WeaponProgress[]
}

export function WeaponGodsProgress({ steamId, gameType = "ca" }: WeaponGodsProgressProps) {
  const { data, isLoading } = useQuery<ProgressData>({
    queryKey: ["weapon-gods-progress", steamId, gameType],
    queryFn: async () => {
      const res = await fetch(`/api/players/${steamId}/weapon-gods-progress?gameType=${gameType}`)
      if (!res.ok) throw new Error("Failed to fetch")
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return <LoadingScreen compact />
  }

  if (!data?.success || !data.progress) {
    return null
  }

  const { progress } = data

  // Ordenar: primero los que califican, luego por progreso de kills
  const sortedProgress = [...progress].sort((a, b) => {
    if (a.meetsAllReqs && !b.meetsAllReqs) return -1
    if (!a.meetsAllReqs && b.meetsAllReqs) return 1
    return (b.currentKills / b.requiredKills) - (a.currentKills / a.requiredKills)
  })

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="space-y-1">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-foreground/60">
          Precision por arma
        </h3>
        <p className="max-w-2xl text-[10px] leading-relaxed text-foreground/40">
          Compara tu precision con el lider actual de cada arma.
        </p>
      </div>

      {/* Weapons Grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {sortedProgress.map((weapon) => (
          <WeaponCard
            key={weapon.weaponKey}
            weapon={weapon}
          />
        ))}
      </div>
    </div>
  )
}

function WeaponCard({ weapon }: { weapon: WeaponProgress }) {
  const killsProgress = Math.min((weapon.currentKills / weapon.requiredKills) * 100, 100)
  const isGod = weapon.meetsAllReqs && weapon.currentRank === 1
  const isQualified = weapon.meetsAllReqs

  return (
    <div className={`
      relative rounded-xl border p-3 transition-all
      ${isGod
        ? "bg-foreground/8 border-foreground/20"
        : isQualified
          ? "bg-foreground/[0.04] border-foreground/[0.08]"
          : "bg-[var(--qc-bg-pure)] border-foreground/[0.05]"
      }
    `}>
      {isGod && (
        <div className="absolute right-2 top-2 rounded-full bg-foreground px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-background">
          #1
        </div>
      )}

      {/* Weapon Icon */}
      <div className="relative mx-auto mb-2 h-6 w-6">
        <Image
          src={weapon.weaponIcon}
          alt={weapon.weapon}
          fill
          className={`object-contain transition-all ${
            isQualified ? "opacity-100" : "opacity-40 grayscale"
          }`}
          unoptimized
        />
      </div>

      {/* Rank si califica */}
      {isQualified && weapon.currentRank && (
        <div className={`text-center text-[10px] font-bold uppercase tracking-wide mb-2 ${
          weapon.currentRank === 1 ? "text-foreground" : "text-foreground/50"
        }`}>
          Estas en el ranking #{weapon.currentRank}
        </div>
      )}

      {/* No califica - mostrar progreso */}
      {!isQualified && (
        <div className="text-center mb-2">
          <div className={`text-xs font-bold leading-tight text-foreground/68`}>
            {weapon.currentAccuracy}%
          </div>
          <div className="mt-1">
            <div className="h-[3px] bg-foreground/[0.08] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  weapon.meetsKillsReq ? "bg-green-500" : "bg-foreground/20"
                }`}
                style={{ width: `${killsProgress}%` }}
              />
            </div>
            <div className="mt-1 text-[8px] font-bold uppercase tracking-[0.14em] text-foreground/30">
              {weapon.currentKills.toLocaleString()}/{weapon.requiredKills.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Current God - separator + info */}
      {weapon.currentGod && !isGod && (
        <div className="pt-2 border-t border-foreground/[0.06]">
          <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-foreground/28 text-center mb-1.5">
            Top #1 actual
          </div>
          <Link
            href={`/perfil/${weapon.currentGod.steamId}`}
            className="flex items-center gap-2 hover:bg-foreground/[0.04] rounded-lg p-1 -mx-1 transition-colors"
          >
            <PlayerAvatar
              steamId={weapon.currentGod.steamId}
              avatar={weapon.currentGod.avatar}
              username={weapon.currentGod.username}
              size="xs"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-medium text-foreground/70 truncate">
                {parseQuakeColors(weapon.currentGod.username)}
              </div>
              <div className="text-[9px] text-foreground/40">
                {weapon.currentGod.accuracy}%
              </div>
            </div>
          </Link>
        </div>
      )}
    </div>
  )
}
