import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import openid from "openid"
import { createOrUpdateSteamUser, createSession, SESSION_SHORT_SECONDS, SESSION_LONG_SECONDS } from "@/lib/auth"
import { getSteamUserInfo } from "@/lib/steam-auth"
import { prisma } from "@/lib/prisma"
import { logAuditAsync } from "@/lib/audit"
import { detectCountryForNewPlayer } from "@/lib/country-detection"


export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)

    // Usar la URL del sitio configurada para producción (detrás de proxy)
    const realm = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    const returnUrl = `${realm}/api/auth/steam/callback`

    const relyingParty = new openid.RelyingParty(returnUrl, realm, true, false, [])

    // Construir la URL de verificación con realm en lugar de request.url
    // Esto maneja escenarios de proxy donde request.url podría ser localhost
    const verifyUrl = `${returnUrl}?${url.searchParams.toString()}`

    // Verificar la aserción usando la URL construida
    const result = await new Promise<{ authenticated: boolean; claimedIdentifier?: string }>((resolve, reject) => {
      relyingParty.verifyAssertion(verifyUrl, (error: any, result: any) => {
        if (error) {
          console.error("OpenID verification error:", error)
          reject(error)
          return
        }
        if (!result) {
          resolve({ authenticated: false })
          return
        }
        resolve({
          authenticated: result.authenticated || false,
          claimedIdentifier: result.claimedIdentifier,
        })
      })
    })

    if (!result.authenticated || !result.claimedIdentifier) {
      return NextResponse.redirect(`${realm}/login?error=auth_failed`)
    }

    // Extraer Steam ID del identificador reclamado
    // Formato: https://steamcommunity.com/openid/id/76561198801465771
    const steamIdMatch = result.claimedIdentifier.match(/\/id\/(\d+)/)
    if (!steamIdMatch) {
      return NextResponse.redirect(`${realm}/login?error=invalid_steam_id`)
    }

    const steamId = steamIdMatch[1]

    // Obtener información del usuario de Steam
    const steamUser = await getSteamUserInfo(steamId)
    if (!steamUser) {
      console.error(`[Auth] Failed to get Steam user info for steamId: ${steamId}`)
      return NextResponse.redirect(`${realm}/login?error=steam_api_failed`)
    }

    // Log para debugging del problema de usernames ^7
    console.log(`[Auth] Steam user info received:`, {
      steamId: steamUser.steamId,
      username: steamUser.username,
      usernameLength: steamUser.username?.length,
      usernameCharCodes: steamUser.username?.split('').map(c => c.charCodeAt(0)),
    })

    // Validar que el username no sea vacío o solo códigos de color de Quake
    let validUsername = steamUser.username
    if (!validUsername || validUsername.trim() === '' || validUsername === '^7' || validUsername.match(/^\^[0-9]$/)) {
      console.warn(`[Auth] Invalid username received from Steam API: "${validUsername}" for steamId ${steamId}. Using fallback.`)
      validUsername = `Player_${steamId.slice(-8)}`
    }

    // Crear o actualizar usuario
    const user = createOrUpdateSteamUser(steamId, validUsername, steamUser.avatar, steamUser.countryCode)

    // Crear o actualizar registro de Player en Prisma automáticamente
    try {
      let player = await prisma.player.findUnique({
        where: { steamId }
      });

      if (!player) {
        // NEW PLAYER — detect country via Cloudflare, lock it permanently
        const detectedCountry = detectCountryForNewPlayer(request, steamUser.countryCode)
        const playerId = `player_${steamId}_${Date.now()}`;
        player = await prisma.player.create({
          data: {
            id: playerId,
            steamId,
            username: validUsername,
            avatar: steamUser.avatar,
            countryCode: detectedCountry,
            countryLockedAt: new Date(),
            updatedAt: new Date(),
          },
        });
        console.log(`[Auth] Auto-created Player record for ${validUsername} (${steamId}) country=${detectedCountry}`);
        logAuditAsync({ category: "AUTH", action: "PLAYER_CREATED", actorType: "SYSTEM", actorId: steamId, actorName: validUsername, targetType: "player", targetId: steamId, targetName: validUsername, details: { countryCode: detectedCountry, source: "cloudflare" } }, null, request)
      } else {
        // EXISTING PLAYER — update avatar/username but NEVER overwrite locked country
        const updateData: any = {
          username: validUsername,
          avatar: steamUser.avatar,
        }

        // If country was never locked (legacy player), lock it now via Cloudflare
        if (!player.countryLockedAt) {
          const detectedCountry = detectCountryForNewPlayer(request, steamUser.countryCode)
          updateData.countryCode = detectedCountry
          updateData.countryLockedAt = new Date()
          console.log(`[Auth] Locking country for legacy player ${validUsername}: ${detectedCountry}`)
        }

        await prisma.player.update({
          where: { steamId },
          data: updateData,
        });
        console.log(`[Auth] Updated Player record for ${validUsername} (${steamId})`);
      }
    } catch (error) {
      console.error('[Auth] Error creando/actualizando registro de Player:', error);
      // No fallar el login si falla la creación/actualización del Player
    }

    logAuditAsync({ category: "AUTH", action: "STEAM_LOGIN", actorId: steamId, actorName: validUsername, details: { countryCode: steamUser.countryCode } }, null, request)

    // Configurar cookie
    const cookieStore = await cookies()

    // Leer preferencia "Mantener sesión" desde cookie temporal
    const rememberMe = cookieStore.get('auth_remember_me')?.value !== '0'

    // Crear sesión con duración según preferencia
    const sessionId = createSession(user, rememberMe)

    // En producción, verificar si estamos detrás de un proxy HTTPS
    const isHttps = process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://') || false

    // Extraer dominio base para que la cookie funcione en www. y sin www.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ""
    const cookieDomain = siteUrl.includes("quakeclub.com") ? ".quakeclub.com" : undefined

    cookieStore.set("session", sessionId, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      maxAge: rememberMe ? SESSION_LONG_SECONDS : SESSION_SHORT_SECONDS,
      path: "/",
      domain: cookieDomain,
    })

    // Leer el returnTo desde la cookie temporal
    let returnTo = cookieStore.get('auth_return_to')?.value || '/';

    // Eliminar cookies temporales
    cookieStore.delete('auth_return_to');
    cookieStore.delete('auth_remember_me');

    // SEGURIDAD: Validar returnTo para prevenir Open Redirect y XSS
    // Solo permitir paths locales (empiezan con /) y no URLs externas
    if (!returnTo.startsWith('/') || returnTo.startsWith('//') || returnTo.includes('://')) {
      console.warn(`[Auth] Blocked suspicious returnTo: ${returnTo}`);
      returnTo = '/';
    }

    // Escapar caracteres peligrosos para prevenir XSS en JavaScript
    const safeReturnTo = returnTo
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');

    // Usar redirect del lado del cliente para asegurar que la cookie se envíe
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Redirecting...</title>
      </head>
      <body>
        <script>window.location.href = "${safeReturnTo}";</script>
        <p>Redirecting...</p>
      </body>
      </html>`,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
        },
      }
    )
  } catch (error) {
    console.error("Steam callback error:", error)
    const realm = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    return NextResponse.redirect(`${realm}/login?error=callback_failed`)
  }
}
