/**
 * Cache Simple en Memoria para APIs de QuakeClub
 *
 * Implementa un cache con TTL y limite de tamaño para evitar memory leaks.
 * Usa estrategia LRU (Least Recently Used) cuando se alcanza el limite.
 */
interface CacheEntry<T> {
  data: T
  timestamp: number
  lastAccess: number
}

const MAX_CACHE_SIZE = 500 // Limite de entradas para evitar memory leak

class SimpleCache {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private refreshing: Set<string> = new Set()
  private defaultTTL = 5 * 60 * 1000 // 5 minutos por defecto

  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    // Limpiar entradas antiguas si alcanzamos el limite
    if (this.cache.size >= MAX_CACHE_SIZE) {
      this.evictLRU()
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now() + ttl,
      lastAccess: Date.now(),
    })
  }

  // Eliminar la entrada menos recientemente usada
  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestAccess = Infinity

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Verificar si expiró
    if (Date.now() > entry.timestamp) {
      this.cache.delete(key)
      return null
    }

    // Actualizar ultimo acceso para LRU
    entry.lastAccess = Date.now()
    return entry.data as T
  }

  // Limpiar todas las entradas que coincidan con un patron
  clearPattern(pattern: string): number {
    let cleared = 0
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
        cleared++
      }
    }
    return cleared
  }

  // Obtener estadisticas del cache
  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: MAX_CACHE_SIZE,
    }
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    // Verificar si expiró
    if (Date.now() > entry.timestamp) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  clear(key?: string): void {
    if (key) {
      this.cache.delete(key)
    } else {
      this.cache.clear()
    }
  }

  /**
   * Get cached value or compute it. Serves stale data while revalidating in background.
   * If cache is fresh: return cached data.
   * If cache is expired but within staleTTL: return stale data, refresh in background.
   * If no cache: await fetcher and cache result.
   */
  async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttl: number = this.defaultTTL): Promise<T> {
    const entry = this.cache.get(key)
    const now = Date.now()

    if (entry) {
      entry.lastAccess = now

      if (now <= entry.timestamp) {
        // Fresh cache
        return entry.data as T
      }

      // Expired but we have stale data — serve stale and refresh in background
      if (!this.refreshing.has(key)) {
        this.refreshing.add(key)
        fetcher().then(data => {
          this.set(key, data, ttl)
        }).catch(() => {}).finally(() => {
          this.refreshing.delete(key)
        })
      }
      return entry.data as T
    }

    // No cache at all — must await
    const data = await fetcher()
    this.set(key, data, ttl)
    return data
  }

  // Limpiar entradas expiradas
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp) {
        this.cache.delete(key)
      }
    }
  }
}

// Instancia global de caché
export const cache = new SimpleCache()

// Limpieza cada 10 minutos
setInterval(() => cache.cleanup(), 10 * 60 * 1000)
