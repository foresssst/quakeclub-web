import { useState, useEffect } from 'react'

/**
 * Hook para evitar flash de loading en cargas rápidas.
 * Basado en la estrategia de osu-web: solo muestra loading si tarda más del delay.
 * 
 * @param isLoading - Estado de carga actual
 * @param delay - Milisegundos a esperar antes de mostrar loading (default: 500ms)
 * @returns boolean - True solo si está cargando Y ya pasó el delay
 * 
 * @example
 * const showLoading = useDebouncedLoading(query.isLoading, 500)
 * if (showLoading) return <Spinner />
 */
export function useDebouncedLoading(isLoading: boolean, delay = 500): boolean {
  const [showLoading, setShowLoading] = useState(false)

  useEffect(() => {
    if (isLoading) {
      // Solo mostrar loading si tarda más del delay
      const timer = setTimeout(() => setShowLoading(true), delay)
      return () => clearTimeout(timer)
    } else {
      // Ocultar inmediatamente cuando termina
      setShowLoading(false)
    }
  }, [isLoading, delay])

  return showLoading
}

/**
 * Hook para prevenir layout shifts durante lazy loading.
 * Mantiene un min-height hasta que el contenido carga.
 * 
 * @param isLoading - Estado de carga actual
 * @param minHeight - Altura mínima en pixeles (default: 150px, igual que osu-web)
 * @returns React.CSSProperties - Estilos para aplicar al container
 * 
 * @example
 * const containerStyle = useMinHeightWhileLoading(query.isLoading, 200)
 * return <div style={containerStyle}>...</div>
 */
export function useMinHeightWhileLoading(
  isLoading: boolean,
  minHeight = 150
): React.CSSProperties {
  return isLoading ? { minHeight: `${minHeight}px` } : {}
}
