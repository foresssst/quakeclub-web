"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Upload, Download, Trash2, X, ImageIcon, Search, Image as ImageIconLucide, SortAsc, SortDesc } from "lucide-react"
import { useState, useRef, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { LoadingScreen } from "@/components/loading-screen"
import { PlayerAvatar } from "@/components/player-avatar"
import { usePlayerAvatars } from "@/hooks/use-player-avatars"

interface ConfigFile {
  name: string
  username: string
  userId: string
  size: string
  uploadDate: string
  downloads: number
  author: string
  description?: string
  previewImage?: string
}

type SortOption = "recent" | "downloads" | "name"

export function ConfigManager() {
  const t = useTranslations("configs")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<SortOption>("recent")
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; fileName: string }>({
    show: false,
    fileName: "",
  })
  const [uploadModal, setUploadModal] = useState(false)
  const [uploadData, setUploadData] = useState({
    description: "",
  })
  const [previewImage, setPreviewImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>("")
  const [imageModal, setImageModal] = useState<{ show: boolean; config: ConfigFile | null }>({
    show: false,
    config: null,
  })
  const [updatePreviewModal, setUpdatePreviewModal] = useState<{ show: boolean; configName: string }>({
    show: false,
    configName: "",
  })
  const [updatePreviewImage, setUpdatePreviewImage] = useState<File | null>(null)
  const [updatePreviewUrl, setUpdatePreviewUrl] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const updateImageInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const queryClient = useQueryClient()

  // Handle Escape key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setImageModal({ show: false, config: null })
        setUploadModal(false)
        setDeleteModal({ show: false, fileName: "" })
        setUpdatePreviewModal({ show: false, configName: "" })
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Fetch current user with React Query
  const { data: userData } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const res = await fetch("/api/auth/me")
      if (!res.ok) return { user: null }
      return res.json()
    },
    staleTime: 10 * 60 * 1000,
    refetchOnMount: false,
  })

  const user = userData?.user || null

  // Fetch config files with React Query
  const { data: filesData, isLoading } = useQuery({
    queryKey: ['config-files'],
    queryFn: async () => {
      const res = await fetch("/api/list-configs")
      if (!res.ok) return { files: [] }
      return res.json()
    },
    staleTime: 2 * 60 * 1000,
    refetchOnMount: false,
  })

  const files = filesData?.files || []

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/upload-config", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) {
        const contentType = res.headers.get("content-type")
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json()
          throw new Error(data.error || "Error al subir el config")
        }
        throw new Error(`Error del servidor (${res.status})`)
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-files'] })
      setUploadModal(false)
      setUploadData({ description: "" })
      setPreviewImage(null)
      setPreviewUrl("")
    },
    onError: (error: Error) => {
      alert(error.message)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (fileName: string) => {
      const res = await fetch(`/api/delete-config?name=${encodeURIComponent(fileName)}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Error al eliminar el archivo")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-files'] })
    },
    onError: (error: Error) => {
      alert(error.message)
    },
  })

  // Update preview mutation
  const updatePreviewMutation = useMutation({
    mutationFn: async ({ configName, preview }: { configName: string; preview: File }) => {
      const formData = new FormData()
      formData.append("configName", configName)
      formData.append("preview", preview)

      const res = await fetch("/api/update-config-preview", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Error al actualizar el preview")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-files'] })
      setUpdatePreviewModal({ show: false, configName: "" })
      setUpdatePreviewImage(null)
      setUpdatePreviewUrl("")
    },
    onError: (error: Error) => {
      alert(error.message)
    },
  })

  const filteredAndSortedFiles = useMemo(() => {
    let result = [...files]

    // Filter
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (file: ConfigFile) =>
          file.name.toLowerCase().includes(query) ||
          file.author.toLowerCase().includes(query) ||
          file.description?.toLowerCase().includes(query),
      )
    }

    // Sort
    switch (sortBy) {
      case "downloads":
        result.sort((a, b) => b.downloads - a.downloads)
        break
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name))
        break
      case "recent":
      default:
        // Assuming files are already sorted by date from API
        break
    }

    return result
  }, [searchQuery, files, sortBy])

  const steamIds = useMemo(() => {
    return files.map((f: ConfigFile) => f.userId.replace('steam_', '')).filter(Boolean)
  }, [files])

  usePlayerAvatars(steamIds, { enabled: steamIds.length > 0 })

  const handleUploadClick = () => {
    if (!user) {
      router.push("/login")
      return
    }
    setUploadModal(true)
    setUploadData({ description: "" })
    setPreviewImage(null)
    setPreviewUrl("")
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && (file.type.startsWith("image/png") || file.type.startsWith("image/jpeg") || file.type.startsWith("image/jpg"))) {
      setPreviewImage(file)
      setPreviewUrl(URL.createObjectURL(file))
    } else {
      alert(t("selectValidImage"))
    }
  }

  const handleFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
      fileInputRef.current.click()
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.name.endsWith(".cfg")) {
      if (!previewImage) {
        alert(t("selectPreviewFirst"))
        return
      }

      const formData = new FormData()
      formData.append("file", file)
      formData.append("preview", previewImage)
      formData.append("author", user?.username || "")
      formData.append("description", uploadData.description)

      try {
        await uploadMutation.mutateAsync(formData)
      } catch (err) {
        // Error handled by mutation
      }
    } else {
      alert(t("selectValidCfg"))
    }
  }

  const closeUploadModal = () => {
    setUploadModal(false)
    setUploadData({ description: "" })
    setPreviewImage(null)
    setPreviewUrl("")
  }

  const handleDelete = async (fileName: string) => {
    setDeleteModal({ show: true, fileName })
  }

  const closeModal = () => {
    setDeleteModal({ show: false, fileName: "" })
  }

  const confirmDelete = async () => {
    const fileName = deleteModal.fileName
    closeModal()
    try {
      await deleteMutation.mutateAsync(fileName)
    } catch (err) {
      // Error handled by mutation
    }
  }

  const handleUpdatePreview = (configName: string) => {
    setUpdatePreviewModal({ show: true, configName })
    setUpdatePreviewImage(null)
    setUpdatePreviewUrl("")
  }

  const handleUpdateImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && (file.type.startsWith("image/png") || file.type.startsWith("image/jpeg") || file.type.startsWith("image/jpg"))) {
      setUpdatePreviewImage(file)
      setUpdatePreviewUrl(URL.createObjectURL(file))
    } else {
      alert(t("selectValidImage"))
    }
  }

  const confirmUpdatePreview = async () => {
    if (!updatePreviewImage) {
      alert(t("selectPreviewFirst"))
      return
    }
    try {
      await updatePreviewMutation.mutateAsync({
        configName: updatePreviewModal.configName,
        preview: updatePreviewImage,
      })
    } catch (err) {
      // Error handled by mutation
    }
  }

  const formatRelativeDate = (isoDate: string): string => {
    const date = new Date(isoDate)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return "ahora"
    if (minutes < 60) return `hace ${minutes}m`
    if (hours < 24) return `hace ${hours}h`
    if (days < 7) return `hace ${days}d`
    if (days < 30) return `hace ${Math.floor(days / 7)}sem`
    return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="space-y-4">
      {/* Upload Modal */}
      {uploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg glass-card-elevated rounded-lg p-5 sm:p-6 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <button
              onClick={closeUploadModal}
              className="absolute right-3 top-3 w-7 h-7 rounded-lg bg-foreground/[0.04] flex items-center justify-center text-foreground/40 hover:bg-foreground/[0.08] hover:text-foreground transition-all duration-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <h3 className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground/50">
              <span className="w-1 h-3 bg-foreground/20 rounded-full" />
              {t("uploadConfig")}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-foreground/30 tracking-wider mb-2">{t("preview")} *</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  ref={imageInputRef}
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-foreground/[0.12] bg-foreground/[0.02] px-4 py-6 text-xs text-foreground/30 transition-all duration-200 hover:border-foreground/[0.22] hover:bg-foreground/[0.04]"
                >
                  <ImageIcon className="h-5 w-5 text-foreground/20" />
                  <span className="text-[10px] uppercase tracking-wider font-bold">{previewImage ? t("changeImage") : t("selectPreview")}</span>
                </button>
                {previewUrl && (
                  <div className="mt-3 rounded-lg border border-foreground/[0.06] overflow-hidden">
                    <div className="relative w-full aspect-video">
                      <Image
                        src={previewUrl}
                        alt="Preview"
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-foreground/30 tracking-wider mb-2">
                  {t("descriptionOptional")}
                </label>
                <textarea
                  value={uploadData.description}
                  onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
                  className="w-full rounded-lg border border-foreground/[0.06] bg-foreground/[0.03] px-3 py-2.5 text-xs text-foreground placeholder:text-foreground/25 focus:border-foreground/[0.18] focus:outline-none resize-none transition-colors duration-200"
                  placeholder={t("describePlaceholder")}
                  rows={3}
                />
              </div>

              <div>
                <input type="file" accept=".cfg" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                <button
                  onClick={handleFileSelect}
                  disabled={uploadMutation.isPending || !previewImage}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-background transition-colors duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploadMutation.isPending ? t("uploading") : t("selectFile")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm glass-card-elevated rounded-lg p-5 animate-in zoom-in-95 duration-200">
            <button onClick={closeModal} className="absolute right-3 top-3 w-7 h-7 rounded-lg bg-foreground/[0.04] flex items-center justify-center text-foreground/40 hover:bg-foreground/[0.08] hover:text-foreground transition-all duration-200">
              <X className="h-3.5 w-3.5" />
            </button>
            <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground/50">
              <span className="w-1 h-3 bg-red-500/30 rounded-full" />
              {t("deleteFile")}
            </h3>
            <p className="mb-5 text-xs text-foreground/40">
              ¿Eliminar <span className="text-foreground font-bold">{deleteModal.fileName}</span>?
            </p>
            <div className="flex gap-2">
              <button onClick={closeModal} className="flex-1 rounded-lg border border-foreground/[0.06] bg-foreground/[0.02] px-4 py-2 text-[11px] font-bold text-foreground/40 hover:bg-foreground/[0.05] uppercase tracking-wider transition-colors duration-200">
                {t("cancel")}
              </button>
              <button onClick={confirmDelete} className="flex-1 rounded-lg bg-red-500 hover:bg-red-600 px-4 py-2 text-[11px] font-bold text-white uppercase tracking-wider transition-colors duration-200">
                {t("confirmDelete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Preview Modal */}
      {updatePreviewModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg glass-card-elevated rounded-lg p-5 sm:p-6 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setUpdatePreviewModal({ show: false, configName: "" })
                setUpdatePreviewImage(null)
                setUpdatePreviewUrl("")
              }}
              className="absolute right-3 top-3 w-7 h-7 rounded-lg bg-foreground/[0.04] flex items-center justify-center text-foreground/40 hover:bg-foreground/[0.08] hover:text-foreground transition-all duration-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <h3 className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground/50">
              <span className="w-1 h-3 bg-foreground/20 rounded-full" />
              {t("updatePreview")}
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-foreground/40 mb-3">
                  Nueva imagen para <span className="text-foreground font-bold">{updatePreviewModal.configName}</span>
                </p>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  ref={updateImageInputRef}
                  onChange={handleUpdateImageSelect}
                  className="hidden"
                />
                <button
                  onClick={() => updateImageInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-foreground/[0.12] bg-foreground/[0.02] px-4 py-6 text-xs text-foreground/30 transition-all duration-200 hover:border-foreground/[0.22] hover:bg-foreground/[0.04]"
                >
                  <ImageIcon className="h-5 w-5 text-foreground/20" />
                  <span className="text-[10px] uppercase tracking-wider font-bold">{updatePreviewImage ? t("changeImage") : t("selectNewImage")}</span>
                </button>
                {updatePreviewUrl && (
                  <div className="mt-3 rounded-lg border border-foreground/[0.06] overflow-hidden">
                    <div className="relative w-full aspect-video">
                      <Image src={updatePreviewUrl} alt="Preview" fill className="object-contain" unoptimized />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setUpdatePreviewModal({ show: false, configName: "" })
                    setUpdatePreviewImage(null)
                    setUpdatePreviewUrl("")
                  }}
                  className="flex-1 rounded-lg border border-foreground/[0.06] bg-foreground/[0.02] px-4 py-2 text-[11px] font-bold text-foreground/40 hover:bg-foreground/[0.05] uppercase tracking-wider transition-colors duration-200"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={confirmUpdatePreview}
                  disabled={!updatePreviewImage || updatePreviewMutation.isPending}
                  className="flex-1 rounded-lg bg-foreground px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-background transition-colors duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {updatePreviewMutation.isPending ? t("updating") : t("update")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {imageModal.show && imageModal.config && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 sm:p-8 animate-in fade-in duration-200"
          onClick={() => setImageModal({ show: false, config: null })}
        >
          <div
            className="relative w-full max-w-5xl flex flex-col max-h-[90vh] rounded-lg overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.3)] animate-in zoom-in-95 fade-in duration-300 ease-out"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setImageModal({ show: false, config: null })}
              className="absolute top-3 right-3 z-[60] w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center text-white/70 hover:bg-black/60 hover:text-white transition-all duration-200"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Image area */}
            <div className="relative min-h-0 bg-[#0c0c0e] flex items-center justify-center overflow-hidden">
              <img
                src={imageModal.config.previewImage || "/branding/logo.png"}
                alt={imageModal.config.name}
                className="w-auto h-auto max-w-full max-h-[calc(90vh-80px)] object-contain"
              />
            </div>

            {/* Info bar — QC light style */}
            <div className="flex-shrink-0 bg-card border-t border-foreground/[0.06] px-4 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <PlayerAvatar steamId={imageModal.config.userId.replace('steam_', '')} playerName={imageModal.config.username} size="sm" />
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wide truncate">
                    {imageModal.config.name}
                  </h3>
                  <div className="flex items-center gap-2.5 text-[10px] text-foreground/40 mt-0.5">
                    <span>{imageModal.config.username}</span>
                    <span className="flex items-center gap-1 tabular-nums">
                      <Download className="h-2.5 w-2.5" />
                      {imageModal.config.downloads}
                    </span>
                    <span>{formatRelativeDate(imageModal.config.uploadDate)}</span>
                  </div>
                  {imageModal.config.description && (
                    <p className="text-[10px] text-foreground/30 mt-1 truncate max-w-md">{imageModal.config.description}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  const link = document.createElement("a")
                  link.href = `/api/get-config?name=${encodeURIComponent(imageModal.config!.name)}`
                  link.download = imageModal.config!.name
                  document.body.appendChild(link)
                  link.click()
                  document.body.removeChild(link)
                }}
                className="flex flex-shrink-0 items-center gap-2 rounded-lg bg-foreground px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-background transition-colors duration-200 hover:opacity-90"
              >
                <Download className="h-3.5 w-3.5" />
                Descargar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search and Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder") || "Buscar..."}
            className="w-full rounded-lg border border-foreground/[0.06] bg-foreground/[0.03] pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-foreground/25 focus:border-foreground/[0.18] focus:outline-none transition-all duration-200"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-foreground/[0.02] rounded-lg border border-foreground/[0.04]">
            {[
              { key: "recent", label: "Recientes" },
              { key: "downloads", label: "Descargas" },
              { key: "name", label: "Nombre" },
            ].map((option) => (
              <button
                key={option.key}
                onClick={() => setSortBy(option.key as SortOption)}
                className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 border-b-2 -mb-px ${
                  sortBy === option.key
                    ? "text-foreground border-foreground"
                    : "text-foreground/30 border-transparent hover:text-foreground/50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {user && (
            <Button
              onClick={handleUploadClick}
              disabled={uploadMutation.isPending}
              className="rounded-lg bg-foreground px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-background whitespace-nowrap transition-colors duration-200 hover:opacity-90"
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              {t("upload")}
            </Button>
          )}
        </div>
      </div>

      {/* Counter */}
      <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-foreground/25">
        {isLoading ? "..." : `${filteredAndSortedFiles.length} configs`}
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingScreen compact />
      ) : filteredAndSortedFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 stat-card">
          <p className="text-xs text-foreground/30 uppercase tracking-wider">
            {searchQuery ? t("notFound") : t("noAvailable")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-3">
          {filteredAndSortedFiles.map((file, index) => (
            <div
              key={file.name}
              className="group stat-card overflow-hidden cursor-pointer animate-in fade-in slide-in-from-bottom-1 duration-400"
              style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'backwards' }}
              onClick={() => setImageModal({ show: true, config: file })}
            >
              {/* Preview Image */}
              <div className="relative w-full aspect-video overflow-hidden bg-foreground/[0.04]">
                {file.previewImage ? (
                  <Image
                    src={file.previewImage}
                    alt={file.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    unoptimized
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-foreground/12" />
                  </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        const link = document.createElement("a")
                        link.href = `/api/get-config?name=${encodeURIComponent(file.name)}`
                        link.download = file.name
                        document.body.appendChild(link)
                        link.click()
                        document.body.removeChild(link)
                      }}
                      className="rounded-lg bg-foreground px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-background transition-colors duration-200 hover:opacity-90"
                    >
                      {t("download")}
                    </button>
                    {user && (file.userId === `steam_${user.steamId}` || user.isAdmin) && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleUpdatePreview(file.name)
                          }}
                          className="rounded-lg bg-foreground px-2 py-1.5 text-background transition-colors duration-200 hover:opacity-90"
                        >
                          <ImageIconLucide className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(file.name)
                          }}
                          className="bg-red-500/80 hover:bg-red-600 text-white px-2 py-1.5 rounded-lg transition-colors duration-200"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Info row */}
              <div className="px-3 py-2.5 flex items-center gap-2.5 border-t border-foreground/[0.04]">
                <PlayerAvatar steamId={file.userId.replace('steam_', '')} playerName={file.username} size="xs" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-[11px] font-bold uppercase tracking-wide text-foreground truncate transition-colors duration-200 group-hover:text-foreground/75">
                    {file.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] text-foreground/30 mt-0.5">
                    <span className="truncate">{file.username}</span>
                    <span>·</span>
                    <span className="flex items-center gap-0.5 tabular-nums">
                      <Download className="h-2.5 w-2.5" />
                      {file.downloads}
                    </span>
                    <span>·</span>
                    <span>{formatRelativeDate(file.uploadDate)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
