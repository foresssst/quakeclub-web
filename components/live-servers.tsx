"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { parseQuakeColors } from "@/lib/quake-colors"
import { FlagCountry } from "@/components/flag-country"
import Link from "next/link"
import Image from "next/image"
import { LoadingScreen } from "@/components/loading-screen"

interface Server {
  ip: string
  port: number
  name: string
  map: string
  gameType: string
  players: number
  maxplayers: number
  status: string
}

// Map levelshot component with fallback
function MapLevelshot({ mapName, className }: { mapName: string; className?: string }) {
  const [src, setSrc] = useState(`/levelshots/${mapName?.toLowerCase()}.jpg`)

  return (
    <Image
      src={src || "/branding/logo.png"}
      alt={mapName || "map"}
      fill
      className={`object-cover ${className || ""}`}
      onError={() => setSrc("/levelshots/default.jpg")}
      unoptimized
    />
  )
}

export function LiveServers() {
  const t = useTranslations("home")

  const { data: servers = [], isLoading } = useQuery<Server[]>({
    queryKey: ["servers-status"],
    queryFn: async () => {
      const res = await fetch("/api/servers-status")
      if (!res.ok) throw new Error("Failed to fetch servers")
      const data = await res.json()
      return Array.isArray(data)
        ? [...data].sort((a, b) => b.players - a.players)
        : []
    },
    staleTime: 30000,
    refetchInterval: 60000,
  })

  // Filter to only show servers with players
  const serversWithPlayers = servers.filter(server => server.players > 0)

  if (isLoading) {
    return (
      <div className="px-3 sm:px-6 py-5 border-t border-foreground/[0.06]">
        <LoadingScreen compact />
      </div>
    )
  }

  if (serversWithPlayers.length === 0) {
    return (
      <div className="px-3 sm:px-6 py-5 border-t border-foreground/[0.06]">
        <h3 className="mb-4 text-[10px] font-bold uppercase tracking-wider text-[var(--qc-text-secondary)]">
          {t("liveServers")}
        </h3>
        <p className="py-6 text-center text-xs text-[var(--qc-text-secondary)]">{t("noServers")}</p>
      </div>
    )
  }

  return (
    <div className="px-3 sm:px-6 py-5 border-t border-foreground/[0.06]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--qc-text-secondary)]">
          {t("liveServers")}
        </h3>
        <Link
          href="/browser"
          className="text-[10px] font-bold uppercase tracking-wider text-[var(--qc-text-muted)] hover:text-foreground transition-colors"
        >
          {t("viewAll")}
        </Link>
      </div>
      <div className="space-y-1.5">
        {serversWithPlayers.map((server) => (
          <div
            key={`${server.ip}:${server.port}`}
            className="group flex w-full items-center gap-2.5 rounded-lg bg-foreground/[0.02] p-2.5 transition-colors hover:bg-foreground/[0.04] dark:bg-white/[0.03] dark:hover:bg-white/[0.05] sm:gap-3 sm:p-3"
          >
            <Link
              href={`/browser/${server.ip.replace(/\./g, "-")}-${server.port}`}
              className="flex flex-1 items-center gap-2.5 min-w-0 sm:gap-3"
            >
              {/* Map levelshot */}
              <div className="relative h-8 w-12 flex-shrink-0 overflow-hidden rounded bg-secondary ring-1 ring-foreground/[0.06] dark:ring-white/[0.07] sm:h-10 sm:w-14">
                <MapLevelshot mapName={server.map} />
              </div>

              {/* Server info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <FlagCountry
                    countryCode="CL"
                    countryName="Chile"
                  />
                  <span className="truncate text-xs text-[var(--qc-text-secondary)] transition-colors group-hover:text-foreground">
                    {parseQuakeColors(server.name)}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] text-foreground uppercase font-semibold">
                    {server.map}
                  </span>
                  <span className="text-[10px] uppercase text-[var(--qc-text-muted)]">
                    {server.gameType}
                  </span>
                </div>
              </div>

              {/* Player count */}
              <div className="flex-shrink-0">
                <span className="text-xs font-semibold text-[var(--qc-text-secondary)]">
                  {server.players}/{server.maxplayers}
                </span>
              </div>
            </Link>

            {/* Connect button */}
            <a
              href={`steam://connect/${server.ip}:${server.port}`}
              onClick={(e) => e.stopPropagation()}
              className="flex-shrink-0 px-2.5 py-1 rounded bg-foreground/[0.06] hover:bg-foreground/[0.12] text-[9px] font-bold uppercase tracking-wider text-[var(--qc-text-secondary)] hover:text-foreground transition-colors"
              title="Conectar vía Steam"
            >
              Jugar
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
