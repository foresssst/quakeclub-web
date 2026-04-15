"use client"

import { useState, useCallback } from "react"
import Cropper from "react-easy-crop"

interface Point {
    x: number
    y: number
}

interface Area {
    x: number
    y: number
    width: number
    height: number
}

interface BannerEditorProps {
    imageUrl: string
    onSave: (croppedImage: string, position: { x: number; y: number }) => void
    onCancel: () => void
    aspectRatio?: number
}

export function BannerEditor({
    imageUrl,
    onSave,
    onCancel,
    aspectRatio = 2000 / 500, // 4:1 ratio por defecto
}: BannerEditorProps) {
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels)
    }, [])

    const createCroppedImage = async (): Promise<string> => {
        if (!croppedAreaPixels) {
            throw new Error("No crop area defined")
        }

        return new Promise((resolve, reject) => {
            const image = new Image()
            image.src = imageUrl

            image.onload = () => {
                const canvas = document.createElement("canvas")
                const ctx = canvas.getContext("2d")

                if (!ctx) {
                    reject(new Error("Failed to get canvas context"))
                    return
                }

                // Set canvas size to the cropped area
                canvas.width = croppedAreaPixels.width
                canvas.height = croppedAreaPixels.height

                // Draw the cropped image
                ctx.drawImage(
                    image,
                    croppedAreaPixels.x,
                    croppedAreaPixels.y,
                    croppedAreaPixels.width,
                    croppedAreaPixels.height,
                    0,
                    0,
                    croppedAreaPixels.width,
                    croppedAreaPixels.height
                )

                // Convert to base64
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error("Failed to create blob"))
                            return
                        }
                        const reader = new FileReader()
                        reader.onloadend = () => {
                            resolve(reader.result as string)
                        }
                        reader.onerror = reject
                        reader.readAsDataURL(blob)
                    },
                    "image/jpeg",
                    0.95
                )
            }

            image.onerror = () => {
                reject(new Error("Failed to load image"))
            }
        })
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const croppedImage = await createCroppedImage()
            onSave(croppedImage, { x: crop.x, y: crop.y })
        } catch (error) {
            console.error("Error cropping image:", error)
            alert("Error al procesar la imagen")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-[var(--qc-bg-pure)] flex flex-col">
            {/* Header */}
            <div className="bg-[var(--qc-bg-pure)] border-b border-foreground/[0.06] px-6 py-4 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-foreground uppercase tracking-wider">Editar Banner</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Ajusta el recorte y posición de tu banner
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isSaving}
                        className="px-6 py-2 text-sm font-bold text-foreground bg-foreground/[0.06] hover:bg-black/[0.1] border border-foreground/[0.06] rounded-lg transition-all uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-2 text-sm font-bold text-foreground bg-green-600 hover:bg-green-500 rounded-lg transition-all uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                    >
                        {isSaving ? "Guardando..." : "Guardar"}
                    </button>
                </div>
            </div>

            {/* Cropper Area */}
            <div className="flex-1 relative bg-[var(--qc-bg-pure)]">
                <Cropper
                    image={imageUrl}
                    crop={crop}
                    zoom={zoom}
                    aspect={aspectRatio}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                    style={{
                        containerStyle: {
                            backgroundColor: "#000",
                        },
                        cropAreaStyle: {
                            border: "2px solid #22c55e",
                            boxShadow: "0 0 20px rgba(34, 197, 94, 0.3)",
                        },
                    }}
                />
            </div>

            {/* Controls */}
            <div className="bg-[var(--qc-bg-pure)] border-t border-foreground/[0.06] px-6 py-6">
                <div className="max-w-2xl mx-auto">
                    {/* Zoom Control */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-bold text-foreground/60 uppercase tracking-wider">
                                Zoom
                            </label>
                            <span className="text-sm font-mono text-green-600">
                                {zoom.toFixed(1)}x
                            </span>
                        </div>
                        <div className="relative">
                            <input
                                type="range"
                                min={1}
                                max={3}
                                step={0.1}
                                value={zoom}
                                onChange={(e) => setZoom(Number(e.target.value))}
                                className="w-full h-1 bg-card rounded-full appearance-none cursor-pointer zoom-slider"
                                style={{
                                    background: `linear-gradient(to right, #22c55e 0%, #22c55e ${((zoom - 1) / 2) * 100}%, #1a1a1a ${((zoom - 1) / 2) * 100}%, #1a1a1a 100%)`
                                }}
                            />
                            <div className="flex justify-between text-xs text-gray-600 mt-2 font-mono">
                                <span>1.0x</span>
                                <span>2.0x</span>
                                <span>3.0x</span>
                            </div>
                        </div>
                    </div>

                    {/* Instructions */}
                    <div className="bg-card border border-foreground/[0.06] rounded-lg p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-500">
                            <div className="flex items-start gap-2">
                                <div className="flex-shrink-0 w-5 h-5 rounded-lg bg-black/5 flex items-center justify-center mt-0.5">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-400 mb-1">Arrastrar</p>
                                    <p>Mueve la imagen para ajustar el encuadre</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="flex-shrink-0 w-5 h-5 rounded-lg bg-black/5 flex items-center justify-center mt-0.5">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-400 mb-1">Zoom</p>
                                    <p>Usa el slider o la rueda del mouse</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="flex-shrink-0 w-5 h-5 rounded-lg bg-black/5 flex items-center justify-center mt-0.5">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-400 mb-1">Área Verde</p>
                                    <p>Representa el banner final (2000x500px)</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
        .zoom-slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          background: #22c55e;
          cursor: pointer;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
          transition: all 0.2s;
        }

        .zoom-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
          box-shadow: 0 0 15px rgba(34, 197, 94, 0.7);
        }

        .zoom-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: #22c55e;
          cursor: pointer;
          border-radius: 50%;
          border: none;
          box-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
          transition: all 0.2s;
        }

        .zoom-slider::-moz-range-thumb:hover {
          transform: scale(1.2);
          box-shadow: 0 0 15px rgba(34, 197, 94, 0.7);
        }
      `}</style>
        </div>
    )
}
