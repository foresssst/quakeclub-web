"use client"

import { useState, useRef, useCallback } from "react"

interface GifPositionEditorProps {
    imageUrl: string
    onSave: (position: { x: number; y: number }) => void
    onCancel: () => void
}

export function GifPositionEditor({
    imageUrl,
    onSave,
    onCancel,
}: GifPositionEditorProps) {
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const [isSaving, setIsSaving] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        setIsDragging(true)
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    }, [position])

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging) return

        const newX = e.clientX - dragStart.x
        const newY = e.clientY - dragStart.y

        // Limitar el movimiento razonable
        const maxOffset = 200
        setPosition({
            x: Math.max(-maxOffset, Math.min(maxOffset, newX)),
            y: Math.max(-maxOffset, Math.min(maxOffset, newY)),
        })
    }, [isDragging, dragStart])

    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
    }, [])

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0]
        setIsDragging(true)
        setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y })
    }, [position])

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isDragging) return
        const touch = e.touches[0]

        const newX = touch.clientX - dragStart.x
        const newY = touch.clientY - dragStart.y

        const maxOffset = 200
        setPosition({
            x: Math.max(-maxOffset, Math.min(maxOffset, newX)),
            y: Math.max(-maxOffset, Math.min(maxOffset, newY)),
        })
    }, [isDragging, dragStart])

    const handleTouchEnd = useCallback(() => {
        setIsDragging(false)
    }, [])

    const handleSave = async () => {
        setIsSaving(true)
        try {
            onSave(position)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-[var(--qc-bg-pure)] flex flex-col">
            {/* Header */}
            <div className="bg-[var(--qc-bg-pure)] border-b border-foreground/[0.06] px-6 py-4 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-foreground uppercase tracking-wider">Ajustar Posición</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Arrastra el GIF para ajustar qué parte se muestra
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

            {/* Editor Area */}
            <div className="flex-1 flex items-center justify-center p-8 bg-[var(--qc-bg-pure)]">
                <div className="w-full max-w-5xl">
                    {/* Preview Container - simula el banner del perfil */}
                    <div
                        ref={containerRef}
                        className="relative w-full overflow-hidden border-2 border-green-500/50 rounded-lg cursor-move select-none"
                        style={{ aspectRatio: '2000/500' }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        {/* GIF animado - usa objectPosition igual que el perfil */}
                        <img
                            src={imageUrl}
                            alt="GIF Preview"
                            className="w-full h-full object-cover pointer-events-none"
                            style={{
                                objectPosition: `calc(50% + ${position.x}px) calc(50% + ${position.y}px)`,
                            }}
                            draggable={false}
                        />

                        {/* Overlay con guías */}
                        <div className="absolute inset-0 pointer-events-none">
                            {/* Líneas guía centrales */}
                            <div className="absolute top-1/2 left-0 right-0 h-px bg-green-500/20" />
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-green-500/20" />
                        </div>

                        {/* Indicador de arrastre */}
                        {isDragging && (
                            <div className="absolute inset-0 bg-green-500/10 pointer-events-none" />
                        )}
                    </div>

                    {/* Info */}
                    <div className="mt-6 bg-[var(--qc-bg-pure)] border border-foreground/[0.06] rounded-lg p-4">
                        <div className="flex items-center gap-6 text-sm text-gray-400">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-black/5 flex items-center justify-center">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                                    </svg>
                                </div>
                                <span>Arrastra para mover</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-black/5 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <span className="text-green-600">GIF animado preservado</span>
                            </div>
                            <div className="ml-auto font-mono text-xs text-gray-600">
                                Posición: ({position.x.toFixed(0)}, {position.y.toFixed(0)})
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
