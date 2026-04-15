"use client"

/**
 * LenisProvider - Scroll Suave Global
 * 
 * Implementa scroll inercial suave usando Lenis.
 * Similar al efecto de Antigravity donde el scroll tiene inercia natural.
 */
import { useEffect, useRef, ReactNode } from 'react'
import Lenis from 'lenis'

interface LenisProviderProps {
    children: ReactNode
}

export function LenisProvider({ children }: LenisProviderProps) {
    const lenisRef = useRef<Lenis | null>(null)

    useEffect(() => {
        // Crear instancia de Lenis
        lenisRef.current = new Lenis({
            duration: 1.2,           // Duración de la animación (más alto = más suave)
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Easing exponencial
            smoothWheel: true,       // Suavizar scroll de rueda
            touchMultiplier: 2,      // Multiplicador para touch
        })

        // Loop de animación
        function raf(time: number) {
            lenisRef.current?.raf(time)
            requestAnimationFrame(raf)
        }
        requestAnimationFrame(raf)

        // Exponer lenis globalmente para debug
        if (typeof window !== 'undefined') {
            (window as typeof window & { lenis?: Lenis }).lenis = lenisRef.current
        }

        return () => {
            lenisRef.current?.destroy()
            lenisRef.current = null
        }
    }, [])

    return <>{children}</>
}
