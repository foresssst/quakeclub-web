/**
 * Autenticación con Steam para QuakeClub
 *
 * Implementa el flujo OAuth de Steam usando OpenID 2.0.
 * Los usuarios inician sesión con su cuenta de Steam y se
 * obtienen sus datos de perfil desde Steam API.
 *
 * FLUJO:
 * 1. Usuario hace clic en "Login con Steam"
 * 2. Se redirige a steamcommunity.com/openid
 * 3. Steam autentica y redirige de vuelta
 * 4. Se extrae el Steam ID del identificador OpenID
 * 5. Se obtiene perfil del usuario desde Steam API
 *
 * REQUIERE:
 * - STEAM_API_KEY en variables de entorno
 */

import openid from "openid"

const STEAM_OPENID_URL = "https://steamcommunity.com/openid"
const STEAM_API_URL = "https://api.steampowered.com"

interface SteamUser {
  steamId: string
  username: string
  avatar: string
  profileUrl: string
  countryCode?: string
}

// Extraer Steam ID del identificador OpenID
export function extractSteamId(identifier: string): string | null {
  const match = identifier.match(/\/id\/(\d+)/)
  return match ? match[1] : null
}

// Obtener información de usuario de Steam desde Steam API
export async function getSteamUserInfo(steamId: string): Promise<SteamUser | null> {
  const apiKey = process.env.STEAM_API_KEY
  if (!apiKey) {
    throw new Error("STEAM_API_KEY not configured")
  }

  try {
    // Usar v2 en lugar de v0002 (ambos son válidos pero v2 es más común)
    const url = `${STEAM_API_URL}/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 segundos timeout

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error(`[Steam API] HTTP ${response.status} for steamId ${steamId}`)
      return null
    }

    const data = await response.json()

    if (!data.response || !data.response.players || data.response.players.length === 0) {
      console.warn(`[Steam API] No player data returned for steamId: ${steamId}`)
      return null
    }

    const player = data.response.players[0]

    // Log completo de lo que retorna Steam API para debugging
    console.log(`[Steam API] Player data received for ${steamId}:`, {
      steamid: player.steamid,
      personaname: player.personaname,
      personanameLength: player.personaname?.length,
      avatarfull: player.avatarfull?.substring(0, 50),
      loccountrycode: player.loccountrycode,
    })

    return {
      steamId: player.steamid,
      username: player.personaname,
      avatar: player.avatarfull || player.avatarmedium || player.avatar,
      profileUrl: player.profileurl,
      countryCode: player.loccountrycode || "CL", // Por defecto Chile si no está disponible
    }
  } catch (error) {
    console.error(`[Steam API] Error fetching Steam user info for ${steamId}:`, error)
    return null
  }
}

// Crear RelyingParty para Steam OpenID
export function createRelyingParty(returnUrl: string) {
  const relyingParty = new openid.RelyingParty(
    returnUrl, // URL de verificación (callback)
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000", // Dominio base
    true, // Verificación sin estado habilitada
    false, // Modo estricto deshabilitado
    [],
  )

  return relyingParty
}

// Verificar aserción OpenID
export function verifyAssertion(request: Request): Promise<{ authenticated: boolean; claimedIdentifier?: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(request.url)
    const returnUrl = `${url.origin}${url.pathname}`
    const relyingParty = createRelyingParty(returnUrl)

    // Convertir parámetros de búsqueda de URL a objeto
    const params: Record<string, string> = {}
    url.searchParams.forEach((value, key) => {
      params[key] = value
    })

    relyingParty.verifyAssertion(params, (error, result) => {
      if (error) {
        reject(error)
        return
      }

      if (!result || !result.authenticated) {
        resolve({ authenticated: false })
        return
      }

      resolve({
        authenticated: true,
        claimedIdentifier: result.claimedIdentifier,
      })
    })
  })
}
