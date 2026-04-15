/**
 * Sistema de detección de país — Cloudflare CF-IPCountry
 *
 * El país se detecta via el header CF-IPCountry que Cloudflare inyecta
 * automáticamente en cada request. Se bloquea en el primer login y NO cambia.
 *
 * Prioridad:
 * 1. realCountryCode (override manual de admin)
 * 2. countryCode (bloqueado via CF-IPCountry al primer login)
 * 3. Steam API loccountrycode (fallback si Cloudflare no está activo aún)
 * 4. "CL" (default)
 */

/**
 * Extrae el país del header CF-IPCountry de Cloudflare.
 * Retorna código ISO 2 letras en mayúsculas, o null si no disponible.
 */
export function getCloudflareCountry(request: Request): string | null {
  const cfCountry = request.headers.get("cf-ipcountry")
  if (!cfCountry || cfCountry === "XX" || cfCountry === "T1") {
    // XX = unknown, T1 = Tor exit node
    return null
  }
  return cfCountry.toUpperCase()
}

/**
 * Determina el país a asignar a un jugador nuevo.
 * Prioridad: Cloudflare > Steam > Default
 */
export function detectCountryForNewPlayer(
  request: Request,
  steamCountry?: string
): string {
  const cfCountry = getCloudflareCountry(request)
  if (cfCountry) return cfCountry
  if (steamCountry && steamCountry.length === 2) return steamCountry.toUpperCase()
  return "CL"
}

/**
 * Determina qué país mostrar para un jugador.
 * Prioridad: realCountryCode (admin override) > countryCode > default
 */
export function getDisplayCountry(
  countryCode?: string | null,
  realCountryCode?: string | null
): string {
  if (realCountryCode && realCountryCode.length === 2) return realCountryCode
  if (countryCode && countryCode.length === 2) return countryCode
  return "CL"
}

