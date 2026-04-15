"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Trash2, Search, User } from "lucide-react"

interface PlayerBadge {
  id: string
  playerId: string
  badgeId: string
  awardedAt: string
  player: {
    id: string
    username: string
    steamId: string
  }
  badge: {
    id: string
    name: string
    description?: string | null
    imageUrl: string
    category?: string | null
  }
}

export function ManagePlayerBadges() {
  const [searchQuery, setSearchQuery] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // Cargar todos los badges otorgados
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'badges', 'assigned'],
    queryFn: async () => {
      const response = await fetch('/api/admin/badges')
      if (!response.ok) throw new Error('Error al cargar badges')
      return response.json()
    },
  })

  // Eliminar badge
  const deleteMutation = useMutation({
    mutationFn: async (playerBadgeId: string) => {
      const response = await fetch(`/api/admin/badges/${playerBadgeId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al eliminar badge')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'badges', 'assigned'] })
      setDeletingId(null)
    },
    onError: (error: Error) => {
      alert(error.message)
      setDeletingId(null)
    },
  })

  const handleDelete = (playerBadge: PlayerBadge) => {
    if (confirm(`¿Estás seguro de quitar el badge "${playerBadge.badge.name}" de ${playerBadge.player.username}?`)) {
      setDeletingId(playerBadge.id)
      deleteMutation.mutate(playerBadge.id)
    }
  }

  const playerBadges: PlayerBadge[] = data?.badges || []

  // Filtrar por búsqueda
  const filteredBadges = playerBadges.filter(pb => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      pb.player.username.toLowerCase().includes(query) ||
      pb.player.steamId.includes(query) ||
      pb.badge.name.toLowerCase().includes(query) ||
      (pb.badge.category && pb.badge.category.toLowerCase().includes(query))
    )
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-foreground/60 font-tiktok">Cargando badges...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-500 font-tiktok">Error al cargar badges</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="border-2 border-foreground/30 bg-card p-6 space-y-5">
        <div>
          <h2 className="text-xl font-bold text-foreground font-tiktok mb-2">GESTIONAR BADGES</h2>
          <p className="text-sm text-foreground/60 font-tiktok">
            {playerBadges.length} badge{playerBadges.length !== 1 ? 's' : ''} otorgado{playerBadges.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Buscar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-black/20 bg-foreground/[0.04] py-2 pl-10 pr-4 text-foreground placeholder-black/40 font-tiktok"
            placeholder="Buscar por jugador, badge o categoría..."
          />
        </div>

        {/* Lista de badges */}
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filteredBadges.length === 0 ? (
            <div className="text-center py-8 text-foreground/40 font-tiktok">
              {searchQuery ? 'No se encontraron resultados' : 'No hay badges otorgados'}
            </div>
          ) : (
            filteredBadges.map((pb) => (
              <div
                key={pb.id}
                className="flex items-center justify-between p-4 border border-black/10 bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-black/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-foreground/40" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground font-tiktok">
                      {pb.player.username}
                    </div>
                    <div className="text-xs text-foreground/40 font-tiktok">{pb.player.steamId}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pb.badge.imageUrl}
                      alt={pb.badge.name}
                      width={60}
                      height={28}
                      className="border border-foreground/[0.06] bg-card object-contain"
                    />
                    <div className="text-right">
                      <div className="font-semibold text-sm text-foreground font-tiktok">
                        {pb.badge.name}
                      </div>
                      <div className="text-xs text-foreground/40 font-tiktok">
                        {pb.badge.category && <span>{pb.badge.category} · </span>}
                        {new Date(pb.awardedAt).toLocaleDateString('es-CL')}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(pb)}
                    disabled={deletingId === pb.id}
                    className="p-2 text-red-500/70 hover:text-red-500 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                    title="Quitar badge"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
