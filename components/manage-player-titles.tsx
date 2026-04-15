"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Trash2, Search, User } from "lucide-react"

interface PlayerTitle {
  id: string
  playerId: string
  titleId: string
  isActive: boolean
  priority: number
  awardedAt: string
  player: {
    id: string
    username: string
    steamId: string
  }
  title: {
    id: string
    name: string
    titleColor?: string | null
  }
}

export function ManagePlayerTitles() {
  const [searchQuery, setSearchQuery] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // Cargar todos los títulos otorgados
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'titles', 'assigned'],
    queryFn: async () => {
      const response = await fetch('/api/admin/titles')
      if (!response.ok) throw new Error('Error al cargar títulos')
      return response.json()
    },
  })

  // Eliminar título
  const deleteMutation = useMutation({
    mutationFn: async (playerTitleId: string) => {
      const response = await fetch(`/api/admin/titles/${playerTitleId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al eliminar título')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'titles', 'assigned'] })
      setDeletingId(null)
    },
    onError: (error: Error) => {
      alert(error.message)
      setDeletingId(null)
    },
  })

  const handleDelete = (playerTitle: PlayerTitle) => {
    if (confirm(`¿Estás seguro de quitar el título "${playerTitle.title.name}" de ${playerTitle.player.username}?`)) {
      setDeletingId(playerTitle.id)
      deleteMutation.mutate(playerTitle.id)
    }
  }

  const playerTitles: PlayerTitle[] = data?.titles || []

  // Filtrar por búsqueda
  const filteredTitles = playerTitles.filter(pt => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      pt.player.username.toLowerCase().includes(query) ||
      pt.player.steamId.includes(query) ||
      pt.title.name.toLowerCase().includes(query)
    )
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-foreground/60 font-tiktok">Cargando títulos...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-500 font-tiktok">Error al cargar títulos</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="border-2 border-foreground/30 bg-card p-6 space-y-5">
        <div>
          <h2 className="text-xl font-bold text-foreground font-tiktok mb-2">GESTIONAR TÍTULOS</h2>
          <p className="text-sm text-foreground/60 font-tiktok">
            {playerTitles.length} título{playerTitles.length !== 1 ? 's' : ''} otorgado{playerTitles.length !== 1 ? 's' : ''}
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
            placeholder="Buscar por jugador o título..."
          />
        </div>

        {/* Lista de títulos */}
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filteredTitles.length === 0 ? (
            <div className="text-center py-8 text-foreground/40 font-tiktok">
              {searchQuery ? 'No se encontraron resultados' : 'No hay títulos otorgados'}
            </div>
          ) : (
            filteredTitles.map((pt) => (
              <div
                key={pt.id}
                className="flex items-center justify-between p-4 border border-black/10 bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-black/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-foreground/40" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground font-tiktok">
                        {pt.player.username}
                      </span>
                      {pt.isActive && (
                        <span className="px-2 py-0.5 text-[10px] bg-green-500/20 text-green-600 border border-green-500/30 font-tiktok uppercase">
                          Activo
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-foreground/40 font-tiktok">{pt.player.steamId}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div
                      className="font-semibold text-sm font-tiktok"
                      style={{ color: pt.title.titleColor || '#1a1a1e' }}
                    >
                      {pt.title.name}
                    </div>
                    <div className="text-xs text-foreground/40 font-tiktok">
                      {new Date(pt.awardedAt).toLocaleDateString('es-CL')}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(pt)}
                    disabled={deletingId === pt.id}
                    className="p-2 text-red-500/70 hover:text-red-500 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                    title="Quitar título"
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
