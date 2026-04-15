"use client"

import { useState, useEffect, useCallback } from 'react'

interface PlayerData {
  steamId: string
  username: string
  avatar?: string
  isRegistered?: boolean
}

interface CachedPlayerData extends PlayerData {
  cachedAt: number
}

// Cache global en memoria para compartir entre componentes
const avatarCache = new Map<string, PlayerData>()
const pendingRequests = new Map<string, Promise<Record<string, PlayerData>>>()

// Cache persistente en localStorage
const AVATAR_CACHE_PREFIX = 'qc_avatar_v3_' // v3: cachea con y sin avatar
const AVATAR_CACHE_TTL = 12 * 60 * 60 * 1000 // 12 horas - balance entre frescura y uso de API
const AVATAR_NO_AVATAR_TTL = 6 * 60 * 60 * 1000 // 6 horas para jugadores sin avatar

// Limpiar cache antiguo (v1 y v2) al cargar el módulo
if (typeof window !== 'undefined') {
  try {
    const oldPrefixes = ['qc_avatar_', 'qc_avatar_v2_']
    const keys = Object.keys(localStorage)
    let cleaned = 0
    for (const key of keys) {
      for (const oldPrefix of oldPrefixes) {
        if (key.startsWith(oldPrefix) && !key.startsWith(AVATAR_CACHE_PREFIX)) {
          localStorage.removeItem(key)
          cleaned++
          break
        }
      }
    }
    if (cleaned > 0) {
      console.log(`[usePlayerAvatars] Limpiado ${cleaned} avatares de cache antiguo`)
    }
  } catch (err) {
    console.error('[usePlayerAvatars] Error limpiando cache antiguo:', err)
  }
}

function loadFromLocalStorage(steamId: string): PlayerData | null {
  if (typeof window === 'undefined') return null

  try {
    const cached = localStorage.getItem(`${AVATAR_CACHE_PREFIX}${steamId}`)
    if (!cached) return null

    const data: CachedPlayerData = JSON.parse(cached)

    // Usar TTL diferente según si tiene avatar o no
    const ttl = data.avatar ? AVATAR_CACHE_TTL : AVATAR_NO_AVATAR_TTL

    // Verificar si expiró
    if (Date.now() - data.cachedAt > ttl) {
      localStorage.removeItem(`${AVATAR_CACHE_PREFIX}${steamId}`)
      return null
    }

    return {
      steamId: data.steamId,
      username: data.username,
      avatar: data.avatar,
      isRegistered: data.isRegistered,
    }
  } catch {
    return null
  }
}

function saveToLocalStorage(steamId: string, data: PlayerData) {
  if (typeof window === 'undefined') return

  try {
    const cached: CachedPlayerData = {
      ...data,
      cachedAt: Date.now(),
    }
    localStorage.setItem(`${AVATAR_CACHE_PREFIX}${steamId}`, JSON.stringify(cached))
  } catch (err) {
    // Si localStorage está lleno, limpiar cache antiguo
    if (err instanceof Error && err.name === 'QuotaExceededError') {
      clearOldAvatarCache()
    }
  }
}

function clearOldAvatarCache() {
  if (typeof window === 'undefined') return

  try {
    const now = Date.now()
    const keys = Object.keys(localStorage)

    for (const key of keys) {
      if (!key.startsWith(AVATAR_CACHE_PREFIX)) continue

      try {
        const cached = localStorage.getItem(key)
        if (!cached) continue

        const data: CachedPlayerData = JSON.parse(cached)
        if (now - data.cachedAt > AVATAR_CACHE_TTL) {
          localStorage.removeItem(key)
        }
      } catch {
        localStorage.removeItem(key)
      }
    }
  } catch {
    // Ignorar errores
  }
}

export function usePlayerAvatars(steamIds: string[], options: { enabled?: boolean } = {}) {
  const { enabled = true } = options
  const [players, setPlayers] = useState<Record<string, PlayerData>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchBatch = useCallback(async (idsToFetch: string[]) => {
    if (idsToFetch.length === 0) return {}

    // Generar clave única para este batch
    const batchKey = idsToFetch.sort().join(',')

    // Si ya hay una petición pendiente para estos IDs, reutilizarla
    if (pendingRequests.has(batchKey)) {
      return pendingRequests.get(batchKey)!
    }

    // Crear nueva petición
    const request = fetch('/api/players/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ steamIds: idsToFetch }),
    })
      .then(res => res.json())
      .then(data => {
        const players = data.players || {}

        // Actualizar cache en memoria y localStorage (con y sin avatar)
        Object.entries(players).forEach(([steamId, playerData]) => {
          const data = playerData as PlayerData
          avatarCache.set(steamId, data)
          saveToLocalStorage(steamId, data)
        })

        // Limpiar petición pendiente
        pendingRequests.delete(batchKey)

        return players
      })
      .catch(err => {
        pendingRequests.delete(batchKey)
        throw err
      })

    pendingRequests.set(batchKey, request)
    return request
  }, [])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    const loadPlayers = async () => {
      // Separar IDs en caché vs IDs que necesitan fetch
      const cachedPlayers: Record<string, PlayerData> = {}
      const idsToFetch: string[] = []

      try {
        steamIds.forEach(steamId => {
          // Primero revisar cache en memoria
          const memoryCache = avatarCache.get(steamId)

          // Si está en memoria, usarlo (con o sin avatar)
          if (memoryCache) {
            cachedPlayers[steamId] = memoryCache
          } else {
            // Si no está en memoria, revisar localStorage
            const fromStorage = loadFromLocalStorage(steamId)
            if (fromStorage) {
              cachedPlayers[steamId] = fromStorage
              // Actualizar cache en memoria
              avatarCache.set(steamId, fromStorage)
            } else {
              // Si no está en ningún caché, forzar fetch
              idsToFetch.push(steamId)
            }
          }
        })

        // Si todo está en caché, establecer y terminar
        if (idsToFetch.length === 0) {
          setPlayers(cachedPlayers)
          setLoading(false)
          return
        }

        // Si hay datos en cache, mostrarlos inmediatamente (sin parpadeo)
        if (Object.keys(cachedPlayers).length > 0) {
          setPlayers(cachedPlayers)
          setLoading(false) // No mostrar loading si ya tenemos algo
        } else {
          // Solo mostrar loading si no tenemos nada en cache
          setLoading(true)
        }

        // Fetch de IDs faltantes en background
        const fetchedPlayers = await fetchBatch(idsToFetch)

        // Log para debugging
        if (idsToFetch.length > 0) {
          console.log('[usePlayerAvatars] Fetched:', idsToFetch.length, 'players, received:', Object.keys(fetchedPlayers).length)
        }

        // Combinar caché + nuevos datos en una sola actualización
        setPlayers(prev => ({ ...cachedPlayers, ...prev, ...fetchedPlayers }))
        setError(null)
      } catch (err) {
        setError(err as Error)
        console.error('Error loading player avatars:', err)

        // Si hay error pero tenemos datos en caché, mantenerlos
        // Si no hay nada en caché, crear placeholders
        if (Object.keys(cachedPlayers).length === 0) {
          const placeholders: Record<string, PlayerData> = {}
          steamIds.forEach(steamId => {
            placeholders[steamId] = {
              steamId,
              username: `Player_${steamId.slice(-6)}`,
              avatar: undefined,
              isRegistered: false,
            }
          })
          setPlayers(placeholders)
        }
      } finally {
        setLoading(false)
      }
    }

    if (steamIds.length > 0) {
      loadPlayers()
    } else {
      setLoading(false)
    }
  }, [steamIds.join(','), fetchBatch, enabled])

  return { players, loading, error }
}

// Hook para un solo jugador (wrapper del batch)
export function usePlayerAvatar(steamId: string, options: { enabled?: boolean } = {}) {
  const { players, loading, error } = usePlayerAvatars([steamId], options)

  return {
    player: players[steamId] || null,
    loading,
    error,
  }
}
