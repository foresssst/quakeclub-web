"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"

interface Server {
  ip: string
  port: number
  name: string
  map: string
  gameType: string
  players: number
  maxplayers: number
}

export function ServerActivityBanner({ userSteamId }: { userSteamId?: string }) {
  const { data: servers = [] } = useQuery<Server[]>({
    queryKey: ["servers-status"],
    queryFn: async () => {
      const res = await fetch("/api/servers-status")
      if (!res.ok) return []
      const data = await res.json()
      return Array.isArray(data) ? data : []
    },
    staleTime: 30000,
    refetchInterval: 60000,
  })

  const serversWithPlayers = servers.filter(s => s.players > 0)
  const totalPlayers = serversWithPlayers.reduce((sum, s) => sum + s.players, 0)

  if (totalPlayers === 0) return null

  // Group by gameType
  const byType: Record<string, { players: number; servers: number }> = {}
  for (const s of serversWithPlayers) {
    const gt = s.gameType
    if (!byType[gt]) byType[gt] = { players: 0, servers: 0 }
    byType[gt].players += s.players
    byType[gt].servers++
  }

  // Get the most populated gametype
  const topType = Object.entries(byType).sort((a, b) => b[1].players - a[1].players)[0]

  return (
    <Link
      href="/browser"
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors"
    >
      <span className="relative flex h-2 w-2 flex-shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
        <span className="font-bold">{totalPlayers}</span> jugando ahora
        {topType && (
          <span className="text-emerald-600/70 dark:text-emerald-400/70">
            {" "}— {topType[1].players} en {topType[0]}
          </span>
        )}
      </span>
    </Link>
  )
}
