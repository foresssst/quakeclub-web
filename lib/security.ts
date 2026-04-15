/**
 * Utilidades de Seguridad de QuakeClub
 * 
 * Este módulo proporciona funciones de seguridad esenciales:
 * - Rate limiting (limitación de tasa de solicitudes)
 * - Sanitización de entrada de usuario
 * - Validación de archivos de configuración
 * - Logging de eventos de seguridad
 * - Generación de tokens seguros
 * 
 * IMPORTANTE: Estas funciones deben usarse en todas las rutas API
 * que acepten entrada de usuario para prevenir ataques.
 */

import * as path from "path"
import { isTrustedIP } from "@/lib/rate-limit"

/**
 * Entrada de rate limit almacenada en memoria
 */
interface RateLimitEntry {
  count: number
  resetTime: number
}

// Almacén en memoria para rate limiting (en producción considerar Redis)
const rateLimitStore = new Map<string, RateLimitEntry>()

/**
 * Verifica si una solicitud excede el límite de tasa
 * 
 * Implementa un algoritmo de "ventana deslizante" para limitar
 * el número de intentos en un período de tiempo.
 * 
 * @param identifier Identificador único (IP, usuario, etc.)
 * @param maxAttempts Número máximo de intentos permitidos
 * @param windowMs Ventana de tiempo en milisegundos
 * @returns true si la solicitud está permitida, false si excede el límite
 * 
 * @example
 * if (!checkRateLimit(`login:${username}`, 5, 15 * 60 * 1000)) {
 *   return error("Demasiados intentos")
 * }
 */
export function checkRateLimit(identifier: string, maxAttempts = 5, windowMs: number = 15 * 60 * 1000): boolean {
  // IPs de confianza (servidores de juego) siempre permitidas
  const ip = identifier.split(':').pop() || identifier
  if (isTrustedIP(ip)) return true

  const now = Date.now()
  const entry = rateLimitStore.get(identifier)

  // Si no existe entrada o la ventana expiró, crear nueva entrada
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    })
    return true
  }

  // Si ya alcanzó el límite, rechazar
  if (entry.count >= maxAttempts) {
    return false
  }

  // Incrementar contador y permitir
  entry.count++
  return true
}

export function sanitizeFilename(filename: string): string {
  // Remover separadores de ruta y caracteres peligrosos
  return filename
    .replace(/[/\\]/g, "") // Remover barras
    .replace(/\.\./g, "") // Remover referencias a directorio padre
    .replace(/[<>:"|?*\x00-\x1f]/g, "") // Remover caracteres inválidos de nombre de archivo
    .replace(/^\.+/, "") // Remover puntos al inicio
    .trim()
    .substring(0, 255) // Limitar longitud
}

export function sanitizeUsername(username: string): string {
  // Permitir solo alfanuméricos, guión bajo y guión
  return username
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .trim()
    .substring(0, 50)
}

export function validateSteamId(steamId: string): boolean {
  // Formato Steam ID64: exactamente 17 dígitos
  // Ejemplo: 76561198012345678
  if (!steamId || typeof steamId !== 'string') {
    return false
  }
  return /^[0-9]{17}$/.test(steamId)
}

export function sanitizeMarkdown(content: string): string {
  // Remover etiquetas HTML y scripts potencialmente peligrosos
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^<]*>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "") // Remover manejadores de eventos
    .trim()
}

export function validateConfigFile(content: string): boolean {
  try {
    // Verificar si el contenido es texto UTF-8 válido
    const buffer = Buffer.from(content, "utf-8")
    const decoded = buffer.toString("utf-8")

    // Verificar null bytes (archivos binarios)
    if (decoded.includes("\0")) {
      return false
    }

    // Limite más estricto: 0.5MB para archivos .cfg
    // Un archivo .cfg típico tiene ~50-200KB
    const MAX_CFG_SIZE = 512 * 1024 // 0.5MB
    if (content.length === 0 || content.length > MAX_CFG_SIZE) {
      return false
    }

    // Validar que el contenido parece un archivo de configuración de Quake
    // Los archivos .cfg contienen comandos como "seta", "bind", etc.
    const lines = content.split("\n").slice(0, 100)
    let hasConfigCommands = false

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.length === 0 || trimmed.startsWith("//")) continue

      // Verificar comandos comunes de Quake
      if (
        trimmed.startsWith("seta ") ||
        trimmed.startsWith("set ") ||
        trimmed.startsWith("bind ") ||
        trimmed.startsWith("unbind ") ||
        trimmed.startsWith("exec ") ||
        trimmed.startsWith("echo ")
      ) {
        hasConfigCommands = true
        break
      }
    }

    // Si el archivo no está vacío pero no tiene comandos de config, podría ser malicioso
    if (content.trim().length > 0 && !hasConfigCommands) {
      logSecurityEvent("SUSPICIOUS_CONFIG_FILE", {
        reason: "no_config_commands_found",
        contentPreview: content.substring(0, 200),
      })
      return false
    }

    // Detectar patrones XSS o código malicioso común
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /onerror=/i,
      /onload=/i,
      /<iframe/i,
      /eval\(/i,
      /base64/i, // Base64 puede usarse para ofuscar
    ]

    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        logSecurityEvent("MALICIOUS_CONTENT_DETECTED", {
          pattern: pattern.toString(),
          contentPreview: content.substring(0, 200),
        })
        return false
      }
    }

    return true
  } catch {
    return false
  }
}

export function validateNewsContent(
  title: string,
  content: string,
  excerpt: string,
): { valid: boolean; error?: string } {
  // Validar título
  if (!title || title.trim().length === 0) {
    return { valid: false, error: "El título es requerido" }
  }
  if (title.length > 200) {
    return { valid: false, error: "El título es demasiado largo (máximo 200 caracteres)" }
  }

  // Validar contenido
  if (!content || content.trim().length === 0) {
    return { valid: false, error: "El contenido es requerido" }
  }
  if (content.length > 50000) {
    return { valid: false, error: "El contenido es demasiado largo (máximo 50,000 caracteres)" }
  }

  // Validar extracto
  if (!excerpt || excerpt.trim().length === 0) {
    return { valid: false, error: "El extracto es requerido" }
  }
  if (excerpt.length > 500) {
    return { valid: false, error: "El extracto es demasiado largo (máximo 500 caracteres)" }
  }

  return { valid: true }
}

export function logSecurityEvent(event: string, details: any) {
  const timestamp = new Date().toISOString()
  const logEntry = `[${timestamp}] ${event}: ${JSON.stringify(details)}\n`
  
  console.log(`[SECURITY] ${logEntry.trim()}`)

  // Persistir en archivo
  try {
    const fs = require('fs')
    const logsDir = path.join(process.cwd(), 'logs')

    // Crear directorio logs si no existe
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true })
    }
    
    const securityLogFile = path.join(logsDir, 'security.log')
    fs.appendFileSync(securityLogFile, logEntry)
  } catch (err) {
    console.error('[SECURITY] Failed to write security log:', err)
  }
}

export function getSecurityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  }
}

export function generateSecureToken(): string {
  // Generar token aleatorio criptográficamente seguro
  const array = new Uint8Array(32)
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(array)
  } else {
    // Fallback para Node.js
    const nodeCrypto = require("crypto")
    nodeCrypto.randomFillSync(array)
  }
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function isPathSafe(basePath: string, targetPath: string): boolean {
  const resolvedBase = path.resolve(basePath)
  const resolvedTarget = path.resolve(targetPath)
  return resolvedTarget.startsWith(resolvedBase)
}

export function safeJsonParse<T>(jsonString: string, fallback: T): T {
  try {
    if (!jsonString || jsonString.trim().length === 0) {
      return fallback
    }
    return JSON.parse(jsonString)
  } catch (error) {
    logSecurityEvent("JSON_PARSE_ERROR", { error: String(error) })
    return fallback
  }
}

// Limitación de tasa específica para uploads
// Permite X uploads por usuario en Y tiempo
interface UploadRateLimitEntry {
  uploads: number
  resetTime: number
}

const uploadRateLimitStore = new Map<string, UploadRateLimitEntry>()

export function checkUploadRateLimit(
  userId: string,
  maxUploads = 5, // 5 uploads
  windowMs: number = 60 * 60 * 1000, // por hora
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const entry = uploadRateLimitStore.get(userId)

  if (!entry || now > entry.resetTime) {
    const resetTime = now + windowMs
    uploadRateLimitStore.set(userId, {
      uploads: 1,
      resetTime,
    })
    return {
      allowed: true,
      remaining: maxUploads - 1,
      resetTime,
    }
  }

  if (entry.uploads >= maxUploads) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    }
  }

  entry.uploads++
  return {
    allowed: true,
    remaining: maxUploads - entry.uploads,
    resetTime: entry.resetTime,
  }
}
