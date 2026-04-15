"use client"

import { useState } from "react"
import { BannerEditor } from "./banner-editor"
import { GifPositionEditor } from "./gif-position-editor"

interface CoverSelectorProps {
  currentCover: string
  onSelect: (file: File, position?: { x: number; y: number }) => Promise<void>
  onClose: () => void
  isRegistered: boolean
}

export function CoverSelector({
  currentCover,
  onSelect,
  onClose,
  isRegistered,
}: CoverSelectorProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [showGifEditor, setShowGifEditor] = useState(false)
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null)
  const [pendingGifFile, setPendingGifFile] = useState<File | null>(null)

  const handleFileUpload = async (file: File) => {
    if (!isRegistered) {
      alert("Solo los usuarios registrados pueden subir banners personalizados")
      return
    }

    if (!file.type.startsWith("image/")) {
      alert("Por favor selecciona un archivo de imagen válido")
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("El archivo es demasiado grande. Máximo 10MB")
      return
    }

    // Para GIFs, mostrar editor de posición antes de subir
    if (file.type === "image/gif") {
      const reader = new FileReader()
      reader.onloadend = () => {
        const imageUrl = reader.result as string
        setOriginalImageUrl(imageUrl)
        setPendingGifFile(file)
        setShowGifEditor(true)
      }
      reader.readAsDataURL(file)
      return
    }

    // Para otros formatos, abrir editor de recorte
    const reader = new FileReader()
    reader.onloadend = () => {
      const imageUrl = reader.result as string
      setOriginalImageUrl(imageUrl)
      setShowEditor(true)
    }
    reader.readAsDataURL(file)
  }


  const handleEditorSave = async (croppedImage: string, position: { x: number; y: number }) => {
    setShowEditor(false)
    setPreviewUrl(croppedImage)
    setIsUploading(true)

    try {
      // Detectar el tipo de imagen desde el base64
      const mimeMatch = croppedImage.match(/^data:(image\/[a-zA-Z]+);base64,/)
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg'
      const ext = mimeType.split('/')[1]

      // Convertir base64 a Blob preservando el formato original
      const base64Data = croppedImage.split(',')[1]
      const byteCharacters = atob(base64Data)
      const byteNumbers = new Array(byteCharacters.length)

      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }

      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: mimeType })
      const file = new File([blob], `banner.${ext}`, { type: mimeType })

      await onSelect(file)
      // onClose se llamará desde el handler después de que se complete la subida
    } catch (error) {
      console.error("Error uploading cover:", error)
      alert("Error al subir el banner")
      setPreviewUrl(null)
    } finally {
      setIsUploading(false)
    }
  }

  const handleEditorCancel = () => {
    setShowEditor(false)
    setOriginalImageUrl(null)
  }

  const handleGifEditorSave = async (position: { x: number; y: number }) => {
    if (!pendingGifFile) return

    setShowGifEditor(false)
    setPreviewUrl(originalImageUrl)
    setIsUploading(true)

    try {
      await onSelect(pendingGifFile, position)
    } catch (error) {
      console.error("Error uploading GIF:", error)
      alert("Error al subir el banner")
      setPreviewUrl(null)
    } finally {
      setIsUploading(false)
      setPendingGifFile(null)
      setOriginalImageUrl(null)
    }
  }

  const handleGifEditorCancel = () => {
    setShowGifEditor(false)
    setPendingGifFile(null)
    setOriginalImageUrl(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith("image/")) {
      handleFileUpload(file)
    } else {
      alert("Por favor arrastra un archivo de imagen válido")
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  return (
    <div className="space-y-6">
      {/* Current Cover Preview */}
      {currentCover && !previewUrl && (
        <div>
          <h3 className="text-sm font-bold text-foreground/60 mb-3 uppercase tracking-wider">
            Banner Actual
          </h3>
          <div className="relative aspect-[2000/500] overflow-hidden border-2 border-foreground/[0.06] rounded-lg">
            <img
              src={currentCover}
              alt="Current cover"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      {/* Preview of new upload */}
      {previewUrl && (
        <div>
          <h3 className="text-sm font-bold text-green-600 mb-3 uppercase tracking-wider">
            {isUploading ? "Subiendo..." : "Vista Previa"}
          </h3>
          <div className="relative aspect-[2000/500] overflow-hidden border-2 border-green-500 rounded-lg">
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-full object-cover"
            />
            {isUploading && (
              <div className="absolute inset-0 bg-[var(--qc-bg-pure)]/70 flex items-center justify-center backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
                  <p className="text-foreground font-bold">Subiendo banner...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom Upload Area */}
      <div>
        <h3 className="text-sm font-bold text-foreground/60 mb-3 uppercase tracking-wider">
          {currentCover ? "Cambiar Banner" : "Subir Banner Personalizado"}
        </h3>
        {isRegistered ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative border-2 border-dashed rounded-lg p-12 transition-all duration-200 ${isDragging
              ? "border-green-500 bg-green-500/10 scale-[1.02]"
              : "border-black/[0.1] hover:border-black/20 hover:bg-foreground/[0.02]"
              }`}
          >
            <input
              id="cover-upload"
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploading}
            />
            <label
              htmlFor="cover-upload"
              className={`flex flex-col items-center gap-4 ${isUploading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            >
              <div className="text-center">
                <p className="text-base font-semibold text-foreground/60 mb-2">
                  {isUploading
                    ? "Procesando imagen..."
                    : isDragging
                      ? "Suelta la imagen aquí"
                      : "Arrastra una imagen o haz clic para seleccionar"}
                </p>
                <p className="text-sm text-gray-500">
                  Recomendado: 2000x500px • Máximo: 10MB
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Formatos: JPG, PNG, WEBP, GIF
                </p>
              </div>
            </label>
          </div>
        ) : (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <span className="text-yellow-600 font-bold">!</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-yellow-600 mb-1">
                  Función Restringida
                </p>
                <p className="text-sm text-yellow-600/80">
                  Solo los usuarios registrados pueden subir banners personalizados.
                  Por favor, inicia sesión con Steam para acceder a esta función.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Banner Editor Modal */}
      {showEditor && originalImageUrl && (
        <BannerEditor
          imageUrl={originalImageUrl}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
        />
      )}

      {/* GIF Position Editor Modal */}
      {showGifEditor && originalImageUrl && (
        <GifPositionEditor
          imageUrl={originalImageUrl}
          onSave={handleGifEditorSave}
          onCancel={handleGifEditorCancel}
        />
      )}
    </div>
  )
}
