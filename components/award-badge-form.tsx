"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Search } from "lucide-react"

interface Player {
  id: string
  username: string
  steamId: string
}

interface Badge {
  id: string
  name: string
  description?: string | null
  imageUrl: string
  category?: string | null
}

export function AwardBadgeForm() {
  const [playerQuery, setPlayerQuery] = useState("")
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [selectedBadge, setSelectedBadge] = useState("")

  const queryClient = useQueryClient()

  // Buscar jugadores
  const { data: playersData, isLoading: searchingPlayers } = useQuery({
    queryKey: ['players-search', playerQuery],
    queryFn: async () => {
      if (!playerQuery || playerQuery.length < 2) return { players: [] }
      const response = await fetch(`/api/players/search?q=${encodeURIComponent(playerQuery)}`)
      if (!response.ok) throw new Error('Error al buscar jugadores')
      return response.json()
    },
    enabled: playerQuery.length >= 2,
  })

  // Cargar badges disponibles
  const { data: badgesData } = useQuery({
    queryKey: ['badges-library'],
    queryFn: async () => {
      const response = await fetch('/api/admin/badges/library')
      if (!response.ok) throw new Error('Error al cargar badges')
      return response.json()
    },
  })

  // Otorgar badge
  const awardBadgeMutation = useMutation({
    mutationFn: async (data: { playerId: string; badgeId: string }) => {
      const response = await fetch('/api/admin/badges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al otorgar badge')
      }
      return response.json()
    },
    onSuccess: () => {
      alert('Badge otorgado exitosamente!')
      setSelectedPlayer(null)
      setSelectedBadge("")
      setPlayerQuery("")
      queryClient.invalidateQueries({ queryKey: ['admin', 'badges'] })
    },
    onError: (error: Error) => {
      alert(error.message)
    },
  })

  const handleAwardBadge = () => {
    if (!selectedPlayer || !selectedBadge) {
      alert('Debes seleccionar un jugador y un badge')
      return
    }

    awardBadgeMutation.mutate({
      playerId: selectedPlayer.id,
      badgeId: selectedBadge,
    })
  }

  const players: Player[] = playersData?.players || []
  const badges: Badge[] = badgesData?.badges || []

  return (
    <div className="space-y-6">
      <div className="border-2 border-foreground/30 bg-card p-6 space-y-5">
        <div>
          <h2 className="text-xl font-bold text-foreground font-tiktok mb-2">OTORGAR BADGE</h2>
          <p className="text-sm text-foreground/60 font-tiktok">Asigna un badge de la biblioteca a un jugador</p>
        </div>

        {/* Buscar jugador */}
        <div>
          <label className="block text-sm font-semibold text-black/90 mb-2 font-tiktok">
            Buscar Jugador *
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
            <input
              type="text"
              value={playerQuery}
              onChange={(e) => {
                setPlayerQuery(e.target.value)
                setSelectedPlayer(null)
              }}
              className="w-full border border-black/20 bg-foreground/[0.04] py-2 pl-10 pr-4 text-foreground placeholder-black/40 font-tiktok"
              placeholder="Buscar por nombre o Steam ID..."
            />
          </div>

          {/* Resultados de búsqueda */}
          {playerQuery.length >= 2 && !selectedPlayer && (
            <div className="mt-2 border border-black/20 bg-card max-h-60 overflow-y-auto">
              {searchingPlayers ? (
                <div className="py-4 text-center text-sm text-foreground/40">Buscando...</div>
              ) : players.length === 0 ? (
                <div className="py-4 text-center text-sm text-foreground/40">No se encontraron jugadores</div>
              ) : null}
              {players.map((player) => (
                <button
                  key={player.id}
                  onClick={() => {
                    setSelectedPlayer(player)
                    setPlayerQuery(player.username)
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-black/5 transition-colors border-b border-foreground/[0.06] last:border-0"
                >
                  <div className="font-semibold text-foreground text-sm font-tiktok">{player.username}</div>
                  <div className="text-xs text-foreground/40 font-tiktok">{player.steamId}</div>
                </button>
              ))}
            </div>
          )}

          {selectedPlayer && (
            <div className="mt-2 border border-foreground/30 bg-foreground/10 px-4 py-2">
              <div className="font-semibold text-foreground text-sm font-tiktok">{selectedPlayer.username}</div>
              <div className="text-xs text-[#333] font-tiktok">{selectedPlayer.steamId}</div>
            </div>
          )}
        </div>

        {/* Seleccionar badge */}
        <div>
          <label className="block text-sm font-semibold text-black/90 mb-2 font-tiktok">
            Badge *
          </label>
          <select
            value={selectedBadge}
            onChange={(e) => setSelectedBadge(e.target.value)}
            className="w-full border border-black/20 bg-foreground/[0.04] py-2 px-4 text-foreground font-tiktok"
          >
            <option value="">Selecciona un badge...</option>
            {badges.map((badge) => (
              <option key={badge.id} value={badge.id}>
                {badge.name} {badge.category && `(${badge.category})`}
              </option>
            ))}
          </select>

          {selectedBadge && badges.find(b => b.id === selectedBadge) && (
            <div className="mt-2 p-3 border border-foreground/[0.06] bg-black/5">
              <p className="text-xs text-foreground/60 mb-2 font-tiktok">Vista previa:</p>
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={badges.find(b => b.id === selectedBadge)!.imageUrl}
                  alt="Badge preview"
                  width={86}
                  height={40}
                  className="border border-foreground/[0.06] bg-card object-contain"
                />
                <div className="flex-1">
                  <p className="font-semibold text-foreground text-sm font-tiktok">
                    {badges.find(b => b.id === selectedBadge)!.name}
                  </p>
                  {badges.find(b => b.id === selectedBadge)!.description && (
                    <p className="text-xs text-foreground/60 mt-1 font-tiktok">
                      {badges.find(b => b.id === selectedBadge)!.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Botón */}
        <button
          onClick={handleAwardBadge}
          disabled={awardBadgeMutation.isPending || !selectedPlayer || !selectedBadge}
          className="w-full border-2 border-foreground bg-foreground/10 py-3 font-bold text-foreground transition-all hover:bg-foreground/20 disabled:opacity-50 disabled:cursor-not-allowed font-tiktok uppercase"
        >
          {awardBadgeMutation.isPending ? 'Otorgando...' : 'Otorgar Badge'}
        </button>
      </div>
    </div>
  )
}
