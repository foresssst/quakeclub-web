"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Search } from "lucide-react"

interface Player {
  id: string
  username: string
  steamId: string
}

interface Title {
  id: string
  name: string
  titleColor?: string | null
}

export function AwardTitleForm() {
  const [playerQuery, setPlayerQuery] = useState("")
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [selectedTitle, setSelectedTitle] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [priority, setPriority] = useState(0)

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

  // Cargar títulos disponibles
  const { data: titlesData } = useQuery({
    queryKey: ['titles-library'],
    queryFn: async () => {
      const response = await fetch('/api/admin/titles/library')
      if (!response.ok) throw new Error('Error al cargar títulos')
      return response.json()
    },
  })

  // Otorgar título
  const awardTitleMutation = useMutation({
    mutationFn: async (data: { playerId: string; titleId: string; isActive: boolean; priority: number }) => {
      const response = await fetch('/api/admin/titles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al otorgar título')
      }
      return response.json()
    },
    onSuccess: () => {
      alert('Título otorgado exitosamente!')
      setSelectedPlayer(null)
      setSelectedTitle("")
      setPlayerQuery("")
      setIsActive(true)
      setPriority(0)
      queryClient.invalidateQueries({ queryKey: ['admin', 'titles'] })
    },
    onError: (error: Error) => {
      alert(error.message)
    },
  })

  const handleAwardTitle = () => {
    if (!selectedPlayer || !selectedTitle) {
      alert('Debes seleccionar un jugador y un título')
      return
    }

    awardTitleMutation.mutate({
      playerId: selectedPlayer.id,
      titleId: selectedTitle,
      isActive,
      priority,
    })
  }

  const players: Player[] = playersData?.players || []
  const titles: Title[] = titlesData?.titles || []

  return (
    <div className="space-y-6">
      <div className="border-2 border-foreground/30 bg-card p-6 space-y-5">
        <div>
          <h2 className="text-xl font-bold text-foreground font-tiktok mb-2">OTORGAR TÍTULO</h2>
          <p className="text-sm text-foreground/60 font-tiktok">Asigna un título de la biblioteca a un jugador</p>
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

        {/* Seleccionar título */}
        <div>
          <label className="block text-sm font-semibold text-black/90 mb-2 font-tiktok">
            Título *
          </label>
          <select
            value={selectedTitle}
            onChange={(e) => setSelectedTitle(e.target.value)}
            className="w-full border border-black/20 bg-foreground/[0.04] py-2 px-4 text-foreground font-tiktok"
          >
            <option value="">Selecciona un título...</option>
            {titles.map((title) => (
              <option key={title.id} value={title.id}>
                {title.name}
              </option>
            ))}
          </select>

          {selectedTitle && titles.find(t => t.id === selectedTitle) && (
            <div className="mt-2 p-3 border border-foreground/[0.06] bg-black/5">
              <p className="text-xs text-foreground/60 mb-1 font-tiktok">Vista previa:</p>
              <p
                className="text-sm font-semibold font-tiktok"
                style={{ color: titles.find(t => t.id === selectedTitle)?.titleColor || '#1a1a1e' }}
              >
                {titles.find(t => t.id === selectedTitle)?.name}
              </p>
            </div>
          )}
        </div>

        {/* Prioridad */}
        <div>
          <label className="block text-sm font-semibold text-black/90 mb-2 font-tiktok">
            Prioridad
          </label>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            min="0"
            className="w-full border border-black/20 bg-foreground/[0.04] py-2 px-4 text-foreground font-tiktok"
          />
          <p className="text-xs text-foreground/40 mt-1 font-tiktok">0 = mayor prioridad</p>
        </div>

        {/* Activo */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4"
          />
          <label htmlFor="isActive" className="text-sm text-black/90 font-tiktok">
            Activar título (desactivará otros títulos del jugador)
          </label>
        </div>

        {/* Botón */}
        <button
          onClick={handleAwardTitle}
          disabled={awardTitleMutation.isPending || !selectedPlayer || !selectedTitle}
          className="w-full border-2 border-foreground bg-foreground/10 py-3 font-bold text-foreground transition-all hover:bg-foreground/20 disabled:opacity-50 disabled:cursor-not-allowed font-tiktok uppercase"
        >
          {awardTitleMutation.isPending ? 'Otorgando...' : 'Otorgar Título'}
        </button>
      </div>
    </div>
  )
}
