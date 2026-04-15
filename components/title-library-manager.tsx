"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, ExternalLink, Edit2, Trash2 } from "lucide-react"
import { systemConfirm } from "@/lib/system-modal"

interface Title {
  id: string
  name: string
  titleUrl?: string | null
  titleColor?: string | null
  createdAt: string
  _count: {
    playerTitles: number
  }
}

export function TitleLibraryManager() {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingTitle, setEditingTitle] = useState<Title | null>(null)
  const [name, setName] = useState("")
  const [titleUrl, setTitleUrl] = useState("")
  const [titleColor, setTitleColor] = useState("#1a1a1e")

  const queryClient = useQueryClient()

  // Cargar títulos globales
  const { data: titlesData, isLoading } = useQuery({
    queryKey: ['titles-library'],
    queryFn: async () => {
      const response = await fetch('/api/admin/titles/library')
      if (!response.ok) throw new Error('Error al cargar títulos')
      return response.json()
    },
  })

  // Crear título global
  const createTitleMutation = useMutation({
    mutationFn: async (titleData: any) => {
      const response = await fetch('/api/admin/titles/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(titleData),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al crear título')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['titles-library'] })
      setShowCreateForm(false)
      resetForm()
    },
  })

  // Actualizar título global
  const updateTitleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetch(`/api/admin/titles/library/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al actualizar título')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['titles-library'] })
      setEditingTitle(null)
      resetForm()
      alert('Título actualizado exitosamente')
    },
  })

  // Eliminar título global
  const deleteTitleMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/titles/library/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Error al eliminar título')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['titles-library'] })
      alert('Título eliminado exitosamente')
    },
  })

  const handleCreateTitle = () => {
    if (!name) {
      alert('El nombre del título es requerido')
      return
    }

    if (editingTitle) {
      // Actualizar título existente
      updateTitleMutation.mutate({
        id: editingTitle.id,
        data: {
          name,
          titleUrl: titleUrl || null,
          titleColor: titleColor || null,
        },
      })
    } else {
      // Crear nuevo título
      createTitleMutation.mutate({
        name,
        titleUrl: titleUrl || null,
        titleColor: titleColor || null,
      })
    }
  }

  const handleEditTitle = (title: Title) => {
    setEditingTitle(title)
    setName(title.name)
    setTitleUrl(title.titleUrl || "")
    setTitleColor(title.titleColor || "#1a1a1e")
    setShowCreateForm(true)
  }

  const handleDeleteTitle = async (titleId: string, titleName: string) => {
    if (await systemConfirm(`¿Estás seguro de eliminar el título "${titleName}"?`, 'Eliminar Título')) {
      deleteTitleMutation.mutate(titleId)
    }
  }

  const resetForm = () => {
    setEditingTitle(null)
    setName("")
    setTitleUrl("")
    setTitleColor("#1a1a1e")
  }

  const titles: Title[] = titlesData?.titles || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground font-tiktok">BIBLIOTECA DE TÍTULOS</h2>
          <p className="text-sm text-foreground/60 font-tiktok">Gestiona los títulos disponibles</p>
        </div>
        <button
          onClick={() => {
            if (showCreateForm) {
              setShowCreateForm(false)
              resetForm()
            } else {
              setEditingTitle(null)
              resetForm()
              setShowCreateForm(true)
            }
          }}
          className="flex items-center gap-2 border-2 border-foreground bg-foreground/10 px-4 py-2 text-sm font-bold text-foreground transition-all hover:bg-foreground/20 font-tiktok uppercase"
        >
          <Plus className="h-4 w-4" />
          {showCreateForm ? 'Cancelar' : 'Nuevo Título'}
        </button>
      </div>

      {/* Formulario de creación */}
      {showCreateForm && (
        <div className="border-2 border-foreground/30 bg-card p-6 space-y-4">
          <h3 className="text-lg font-bold text-foreground font-tiktok">
            {editingTitle ? 'EDITAR TÍTULO' : 'CREAR TÍTULO'}
          </h3>

          {/* Nombre */}
          <div>
            <label className="block text-sm font-semibold text-black/90 mb-2 font-tiktok">
              Nombre del Título *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-black/20 bg-foreground/[0.04] py-2 px-4 text-foreground placeholder-black/40 font-tiktok"
              placeholder="Ej: Campeón QuakeClub 2024"
            />
          </div>

          {/* URL opcional */}
          <div>
            <label className="block text-sm font-semibold text-black/90 mb-2 font-tiktok">
              URL (opcional)
            </label>
            <input
              type="url"
              value={titleUrl}
              onChange={(e) => setTitleUrl(e.target.value)}
              className="w-full border border-black/20 bg-foreground/[0.04] py-2 px-4 text-foreground placeholder-black/40 font-tiktok"
              placeholder="https://..."
            />
            <p className="text-xs text-foreground/40 mt-1 font-tiktok">Si se proporciona, el título será clickeable</p>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-semibold text-black/90 mb-2 font-tiktok">
              Color
            </label>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={titleColor}
                onChange={(e) => setTitleColor(e.target.value)}
                className="h-10 w-20 border border-black/20 bg-card cursor-pointer"
              />
              <input
                type="text"
                value={titleColor}
                onChange={(e) => setTitleColor(e.target.value)}
                className="flex-1 border border-black/20 bg-foreground/[0.04] py-2 px-4 text-foreground font-mono text-sm font-tiktok"
                placeholder="#1a1a1e"
              />
            </div>
            <p className="text-xs text-foreground/40 mt-1 font-tiktok">Vista previa:</p>
            <p className="text-sm font-semibold mt-2 font-tiktok" style={{ color: titleColor }}>
              {name || "Ejemplo de título"}
            </p>
          </div>

          <button
            onClick={handleCreateTitle}
            disabled={createTitleMutation.isPending || updateTitleMutation.isPending}
            className="w-full border-2 border-foreground bg-foreground/10 py-3 font-bold text-foreground transition-all hover:bg-foreground/20 disabled:opacity-50 font-tiktok uppercase"
          >
            {createTitleMutation.isPending || updateTitleMutation.isPending
              ? editingTitle ? 'Actualizando...' : 'Creando...'
              : editingTitle ? 'Actualizar Título' : 'Crear Título'}
          </button>
        </div>
      )}

      {/* Lista de títulos - Estilo ranking */}
      <div className="bg-card/40 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-foreground/[0.06]">
        <div className="bg-gradient-to-r from-[#1a1a1e]/10 to-transparent px-6 py-4 border-b border-foreground/[0.06]">
          <h3 className="text-sm font-bold text-foreground/80 uppercase font-tiktok">
            Títulos Disponibles ({titles.length})
          </h3>
        </div>
        <div className="divide-y divide-white/5">
          {isLoading ? (
            <div className="p-8 text-center text-foreground/60 font-tiktok">Cargando...</div>
          ) : titles.length === 0 ? (
            <div className="p-8 text-center text-foreground/60 font-tiktok">No hay títulos creados</div>
          ) : (
            titles.map((title) => (
              <div key={title.id} className="group p-4 transition-all bg-black/5 hover:bg-black/10 cursor-pointer border border-transparent hover:border-foreground/[0.06] rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4
                        className="font-bold text-lg font-tiktok"
                        style={{ color: title.titleColor || '#1a1a1e' }}
                      >
                        {title.name}
                      </h4>
                      {title.titleUrl && (
                        <a
                          href={title.titleUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-foreground hover:text-[#d4af37]"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-foreground/40 mt-1 font-tiktok">
                      Otorgado a {title._count.playerTitles} jugador{title._count.playerTitles !== 1 ? 'es' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 border border-black/20 rounded"
                      style={{ backgroundColor: title.titleColor || '#1a1a1e' }}
                    />
                    <button
                      onClick={() => handleEditTitle(title)}
                      className="text-blue-600 hover:text-blue-300 transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTitle(title.id, title.name)}
                      className="text-red-500 hover:text-red-300 transition-colors"
                      disabled={deleteTitleMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
