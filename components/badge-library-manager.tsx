"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Upload, Plus, Trash2, ExternalLink, Edit2 } from "lucide-react"
import { systemConfirm } from "@/lib/system-modal"

interface Badge {
  id: string
  name: string
  description?: string | null
  imageUrl: string
  badgeUrl?: string | null
  category?: string | null
  createdAt: string
  _count: {
    playerBadges: number
  }
}

export function BadgeLibraryManager() {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [badgeUrl, setBadgeUrl] = useState("")
  const [category, setCategory] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const queryClient = useQueryClient()

  // Cargar badges globales
  const { data: badgesData, isLoading } = useQuery({
    queryKey: ['badges-library'],
    queryFn: async () => {
      const response = await fetch('/api/admin/badges/library')
      if (!response.ok) throw new Error('Error al cargar badges')
      return response.json()
    },
  })

  // Crear badge global
  const createBadgeMutation = useMutation({
    mutationFn: async (badgeData: any) => {
      const response = await fetch('/api/admin/badges/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(badgeData),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al crear badge')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badges-library'] })
      setShowCreateForm(false)
      resetForm()
    },
  })

  // Actualizar badge global
  const updateBadgeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetch(`/api/admin/badges/library/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al actualizar badge')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badges-library'] })
      setEditingBadge(null)
      resetForm()
      alert('Badge actualizado exitosamente')
    },
  })

  // Eliminar badge global
  const deleteBadgeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/badges/library/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Error al eliminar badge')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badges-library'] })
      alert('Badge eliminado exitosamente')
    },
  })

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onload = () => setImagePreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleUploadImage = async () => {
    if (!imageFile) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', imageFile)

      const response = await fetch('/api/admin/badges/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('Error al subir imagen')

      const data = await response.json()
      setUploadedImageUrl(data.imageUrl)
      alert('Imagen subida exitosamente!')
    } catch (error) {
      alert('Error al subir imagen')
    } finally {
      setIsUploading(false)
    }
  }

  const handleCreateBadge = () => {
    if (!name || !uploadedImageUrl) {
      alert('Nombre e imagen son requeridos')
      return
    }

    if (editingBadge) {
      // Actualizar badge existente
      updateBadgeMutation.mutate({
        id: editingBadge.id,
        data: {
          name,
          description: description || null,
          imageUrl: uploadedImageUrl,
          badgeUrl: badgeUrl || null,
          category: category || null,
        },
      })
    } else {
      // Crear nuevo badge
      createBadgeMutation.mutate({
        name,
        description: description || null,
        imageUrl: uploadedImageUrl,
        badgeUrl: badgeUrl || null,
        category: category || null,
      })
    }
  }

  const handleEditBadge = (badge: Badge) => {
    setEditingBadge(badge)
    setName(badge.name)
    setDescription(badge.description || "")
    setBadgeUrl(badge.badgeUrl || "")
    setCategory(badge.category || "")
    setUploadedImageUrl(badge.imageUrl)
    setImagePreview(badge.imageUrl)
    setShowCreateForm(true)
  }

  const handleDeleteBadge = async (badgeId: string, badgeName: string) => {
    if (await systemConfirm(`¿Estás seguro de eliminar el badge "${badgeName}"?`, 'Eliminar Badge')) {
      deleteBadgeMutation.mutate(badgeId)
    }
  }

  const resetForm = () => {
    setEditingBadge(null)
    setName("")
    setDescription("")
    setBadgeUrl("")
    setCategory("")
    setImageFile(null)
    setImagePreview(null)
    setUploadedImageUrl(null)
  }

  const badges: Badge[] = badgesData?.badges || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground font-tiktok">BIBLIOTECA DE BADGES</h2>
          <p className="text-sm text-foreground/60 font-tiktok">Gestiona los badges disponibles</p>
        </div>
        <button
          onClick={() => {
            if (showCreateForm) {
              setShowCreateForm(false)
              resetForm()
            } else {
              setEditingBadge(null)
              resetForm()
              setShowCreateForm(true)
            }
          }}
          className="flex items-center gap-2 border-2 border-foreground bg-foreground/10 px-4 py-2 text-sm font-bold text-foreground transition-all hover:bg-foreground/20 font-tiktok uppercase"
        >
          <Plus className="h-4 w-4" />
          {showCreateForm ? 'Cancelar' : 'Nuevo Badge'}
        </button>
      </div>

      {/* Formulario de creación */}
      {showCreateForm && (
        <div className="border-2 border-foreground/30 bg-card p-6 space-y-4">
          <h3 className="text-lg font-bold text-foreground font-tiktok">
            {editingBadge ? 'EDITAR BADGE' : 'CREAR BADGE'}
          </h3>

          {/* Upload de imagen */}
          <div>
            <label className="block text-sm font-semibold text-black/90 mb-2 font-tiktok">
              Imagen del Badge *
            </label>
            <div className="flex gap-4">
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                onChange={handleImageChange}
                className="flex-1 text-sm text-foreground/60 file:mr-4 file:py-2 file:px-4 file:border file:border-black/20 file:bg-black/5 file:text-foreground/80 file:font-semibold hover:file:bg-black/10 font-tiktok"
              />
              {imageFile && (
                <button
                  onClick={handleUploadImage}
                  disabled={isUploading}
                  className="flex items-center gap-2 border border-foreground bg-foreground/10 px-4 py-2 text-sm font-bold text-foreground disabled:opacity-50 font-tiktok"
                >
                  <Upload className="h-4 w-4" />
                  {isUploading ? 'Subiendo...' : 'Subir'}
                </button>
              )}
            </div>
            {imagePreview && (
              <div className="mt-3 border border-foreground/[0.06] bg-black/5 p-4">
                <p className="text-xs text-foreground/60 mb-2 font-tiktok">Vista previa (86x40px, GIFs mantienen animación):</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Preview" width={86} height={40} className="object-contain bg-card" />
              </div>
            )}
            {uploadedImageUrl && (
              <p className="mt-2 text-xs text-green-600 font-tiktok">✓ Imagen subida: {uploadedImageUrl}</p>
            )}
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-sm font-semibold text-black/90 mb-2 font-tiktok">
              Nombre del Badge *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-black/20 bg-foreground/[0.04] py-2 px-4 text-foreground placeholder-black/40 font-tiktok"
              placeholder="Ej: Ganador Torneo CA 2024"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-semibold text-black/90 mb-2 font-tiktok">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-black/20 bg-foreground/[0.04] py-2 px-4 text-foreground placeholder-black/40 font-tiktok"
              placeholder="Descripción del badge"
              rows={3}
            />
          </div>

          {/* URL opcional */}
          <div>
            <label className="block text-sm font-semibold text-black/90 mb-2 font-tiktok">
              URL (opcional)
            </label>
            <input
              type="url"
              value={badgeUrl}
              onChange={(e) => setBadgeUrl(e.target.value)}
              className="w-full border border-black/20 bg-foreground/[0.04] py-2 px-4 text-foreground placeholder-black/40 font-tiktok"
              placeholder="https://..."
            />
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-sm font-semibold text-black/90 mb-2 font-tiktok">
              Categoría
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-black/20 bg-foreground/[0.04] py-2 px-4 text-foreground font-tiktok"
            >
              <option value="">Sin categoría</option>
              <option value="tournament">Torneo</option>
              <option value="achievement">Logro</option>
              <option value="special">Especial</option>
              <option value="event">Evento</option>
            </select>
          </div>

          <button
            onClick={handleCreateBadge}
            disabled={(createBadgeMutation.isPending || updateBadgeMutation.isPending) || !uploadedImageUrl}
            className="w-full border-2 border-foreground bg-foreground/10 py-3 font-bold text-foreground transition-all hover:bg-foreground/20 disabled:opacity-50 font-tiktok uppercase"
          >
            {createBadgeMutation.isPending || updateBadgeMutation.isPending
              ? editingBadge ? 'Actualizando...' : 'Creando...'
              : editingBadge ? 'Actualizar Badge' : 'Crear Badge'}
          </button>
        </div>
      )}

      {/* Lista de badges - Estilo ranking */}
      <div className="bg-card/40 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-foreground/[0.06]">
        <div className="bg-gradient-to-r from-[#1a1a1e]/10 to-transparent px-6 py-4 border-b border-foreground/[0.06]">
          <h3 className="text-sm font-bold text-foreground/80 uppercase font-tiktok">
            Badges Disponibles ({badges.length})
          </h3>
        </div>
        <div className="divide-y divide-white/5">
          {isLoading ? (
            <div className="p-8 text-center text-foreground/60 font-tiktok">Cargando...</div>
          ) : badges.length === 0 ? (
            <div className="p-8 text-center text-foreground/60 font-tiktok">No hay badges creados</div>
          ) : (
            badges.map((badge) => (
              <div key={badge.id} className="group p-4 transition-all bg-black/5 hover:bg-black/10 cursor-pointer border border-transparent hover:border-foreground/[0.06] rounded-lg">
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={badge.imageUrl}
                    alt={badge.name}
                    width={86}
                    height={40}
                    className="border border-foreground/[0.06] bg-card object-contain"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-foreground font-tiktok">{badge.name}</h4>
                      {badge.category && (
                        <span className="text-xs px-2 py-0.5 bg-foreground/20 text-foreground border border-foreground/30 uppercase font-tiktok">
                          {badge.category}
                        </span>
                      )}
                    </div>
                    {badge.description && (
                      <p className="text-sm text-foreground/60 mt-1 font-tiktok">{badge.description}</p>
                    )}
                    <p className="text-xs text-foreground/40 mt-1 font-tiktok">
                      Otorgado a {badge._count.playerBadges} jugador{badge._count.playerBadges !== 1 ? 'es' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {badge.badgeUrl && (
                      <a
                        href={badge.badgeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground hover:text-[#d4af37]"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <button
                      onClick={() => handleEditBadge(badge)}
                      className="text-blue-600 hover:text-blue-300 transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteBadge(badge.id, badge.name)}
                      className="text-red-500 hover:text-red-300 transition-colors"
                      disabled={deleteBadgeMutation.isPending}
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
