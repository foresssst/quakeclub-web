/**
 * Sistema de Rate Limiting de QuakeClub
 * 
 * Implementa un rate limiter en memoria para proteger las APIs contra abuso.
 * 
 * FUNCIONAMIENTO:
 * - Usa algoritmo de "ventana deslizante" (sliding window)
 * - Almacena contadores en memoria (Map)
 * - Limpia entradas expiradas cada 5 minutos
 * - IPs de servidores de juego whitelisted (sin límite)
 * 
 * LIMITACIONES:
 * - En memoria: se pierde en reinicio del servidor
 * - No compartido: cada instancia tiene su propio store
 * - Para producción con múltiples instancias: usar Redis/Upstash
 * 
 * USO TÍPICO:
 * - Login: 5 intentos por 15 minutos
 * - API pública: 100 requests por minuto
 * - Upload: 5 uploads por hora
 * 
 * @example
 * const result = rateLimit(userIp, { limit: 5, window: 60000 })
 * if (!result.success) {
 *   return error("Too many requests")
 * }
 */

/**
 * IPs de confianza que no deben tener rate limit.
 * Servidores de Quake Live con 14 conexiones ZMQ + plugins
 * que requieren acceso ilimitado a la API.
 */
const TRUSTED_IPS: Set<string> = new Set(
  [
    ...(process.env.TRUSTED_SERVER_IPS ?? "").split(",").map((ip) => ip.trim()).filter(Boolean),
    "127.0.0.1",
    "::1",
  ],
)

/**
 * Almacén de contadores de rate limit
 */
interface RateLimitStore {
  [key: string]: {
    count: number // Número de requests realizados
    resetTime: number // Timestamp cuando se resetea el contador
  }
}

// Almacén en memoria (se pierde al reiniciar el servidor)
const store: RateLimitStore = {}

/**
 * Configuración de rate limit
 */
export interface RateLimitConfig {
  limit: number // Número máximo de requests permitidos
  window: number // Ventana de tiempo en milisegundos
}

/**
 * Resultado de verificación de rate limit
 */
export interface RateLimitResult {
  success: boolean // true si la request está permitida
  remaining: number // Número de requests restantes
  reset: number // Timestamp cuando se resetea el límite
}

// Limpia entradas expiradas
function cleanup() {
  const now = Date.now()
  for (const key in store) {
    if (store[key].resetTime < now) {
      delete store[key]
    }
  }
}

setInterval(cleanup, 5 * 60 * 1000)

// Verifica si excedio el limite (trusted IPs bypassed)
export function rateLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
  // IPs de confianza siempre permitidas sin límite
  if (isTrustedIP(identifier)) {
    return {
      success: true,
      remaining: config.limit,
      reset: Date.now() + config.window,
    }
  }

  const now = Date.now()
  const key = identifier

  // Si no existe o expiró, crear nueva entrada
  if (!store[key] || store[key].resetTime < now) {
    store[key] = {
      count: 1,
      resetTime: now + config.window,
    }
    return {
      success: true,
      remaining: config.limit - 1,
      reset: store[key].resetTime,
    }
  }

  // Incrementar contador
  store[key].count++

  // Verificar si excede el límite
  if (store[key].count > config.limit) {
    return {
      success: false,
      remaining: 0,
      reset: store[key].resetTime,
    }
  }

  return {
    success: true,
    remaining: config.limit - store[key].count,
    reset: store[key].resetTime,
  }
}

/**
 * Obtiene un identificador único de la request (IP o user ID)
 */
export function getIdentifier(request: Request): string {
  // Intentar obtener IP real (detrás de proxy)
  const forwarded = request.headers.get("x-forwarded-for")
  const ip = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip") || "unknown"

  return ip
}

/**
 * Verifica si una IP es de confianza (servidores de juego)
 */
export function isTrustedIP(ip: string): boolean {
  return TRUSTED_IPS.has(ip)
}
