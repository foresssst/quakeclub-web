import { type NextRequest, NextResponse } from "next/server"
import { getUsersBySteamIds } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { validateSteamId } from "@/lib/security"
import { fetchWithTimeout } from "@/lib/steam"


// Cache de avatares de Steam para evitar múltiples llamadas a la API
const steamAvatarCache = new Map<string, { avatar: string | null, timestamp: number }>()
const CACHE_DURATION = 1000 * 60 * 30 // 30 minutos

export async function POST(request: NextRequest) {
  try {
    // Manejar body vacío o malformado
    let body
    try {
      const text = await request.text()
      if (!text || text.trim() === '') {
        return NextResponse.json({ error: "Empty request body" }, { status: 400 })
      }
      body = JSON.parse(text)
    } catch (parseError) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const { steamIds } = body

    if (!steamIds || !Array.isArray(steamIds)) {
      return NextResponse.json({ error: "steamIds array is required" }, { status: 400 })
    }

    if (steamIds.length > 100) {
      return NextResponse.json({ error: "Maximum 100 steam IDs per request" }, { status: 400 })
    }

    // Validar todos los Steam IDs
    const validSteamIds = steamIds.filter(id => validateSteamId(id))

    if (validSteamIds.length === 0) {
      return NextResponse.json({ players: {} })
    }

    // Obtener todos los jugadores de una vez
    const players = await prisma.player.findMany({
      where: {
        steamId: {
          in: validSteamIds
        }
      },
      select: {
        steamId: true,
        username: true,
        createdAt: true,
      }
    })

    // Crear un mapa para acceso rápido
    const playerMap = new Map(players.map(p => [p.steamId, p]))

    // Obtener usuarios registrados (para avatares custom)
    const userMap = getUsersBySteamIds(validSteamIds) as Map<string, any>

    // Separar IDs que necesitan avatar de Steam
    const steamIdsNeedingAvatar: string[] = []
    const now = Date.now()

    for (const steamId of validSteamIds) {
      const user = userMap.get(steamId)
      if (!user?.avatar) {
        // Verificar si está en cache y aún es válido
        const cached = steamAvatarCache.get(steamId)
        if (!cached || (now - cached.timestamp) > CACHE_DURATION) {
          steamIdsNeedingAvatar.push(steamId)
        }
      }
    }

    // Obtener avatares de Steam en batch (hasta 100 a la vez)
    let steamAvatars = new Map<string, string | null>()

    if (steamIdsNeedingAvatar.length > 0) {
      try {
        const steamApiKey = process.env.STEAM_API_KEY
        if (steamApiKey) {
          // Steam API permite hasta 100 IDs por llamada
          const steamIdsParam = steamIdsNeedingAvatar.join(',')
          const steamResponse = await fetchWithTimeout(
            `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${steamApiKey}&steamids=${steamIdsParam}`,
            5000 // 5 segundos timeout
          )

          if (steamResponse.ok) {
            const steamData = await steamResponse.json()
            const steamProfiles = steamData.response?.players || []

            for (const profile of steamProfiles) {
              const avatar = profile.avatarfull || profile.avatarmedium || null
              steamAvatars.set(profile.steamid, avatar)

              // Actualizar cache
              steamAvatarCache.set(profile.steamid, {
                avatar,
                timestamp: now
              })
            }
          }
        }
      } catch (err) {
        console.error("Error fetching Steam avatars in batch:", err)
      }
    }

    // Construir respuesta
    const result: Record<string, any> = {}

    for (const steamId of validSteamIds) {
      const player = playerMap.get(steamId)
      const user = userMap.get(steamId)

      // Determinar avatar: custom > steam (cache o nuevo) > null
      let avatarUrl = user?.avatar

      if (!avatarUrl) {
        // Verificar nuevo fetch
        if (steamAvatars.has(steamId)) {
          avatarUrl = steamAvatars.get(steamId) || undefined
        } else {
          // Verificar cache
          const cached = steamAvatarCache.get(steamId)
          if (cached && (now - cached.timestamp) <= CACHE_DURATION) {
            avatarUrl = cached.avatar || undefined
          }
        }
      }

      result[steamId] = {
        steamId,
        username: player?.username || `Player_${steamId.slice(-6)}`,
        avatar: avatarUrl,
        createdAt: player?.createdAt?.toISOString(),
        isRegistered: !!user,
      }
    }

    return NextResponse.json({ players: result }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // 5 min cache, 10 min stale
      }
    })
  } catch (error) {
    console.error("Error fetching players batch:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
