/**
 * Utilidades de encriptación para QuakeClub
 * 
 * Usa AES-256-GCM para encriptar datos sensibles en la base de datos
 * (por ejemplo, contraseñas de servidores ZMQ).
 * 
 * La clave de encriptación se deriva de SESSION_SECRET.
 * Los valores encriptados tienen formato: enc:<iv>:<ciphertext>:<authTag>
 */

import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"
const ENCRYPTED_PREFIX = "enc:"

/**
 * Deriva una clave de 32 bytes a partir de SESSION_SECRET
 */
function getDerivedKey(): Buffer {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error("SESSION_SECRET not configured")
  return crypto.createHash("sha256").update(secret).digest()
}

/**
 * Encripta un string. Retorna formato: enc:<iv>:<ciphertext>:<authTag>
 */
export function encrypt(plaintext: string): string {
  const key = getDerivedKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, "utf8", "hex")
  encrypted += cipher.final("hex")
  const authTag = cipher.getAuthTag().toString("hex")

  return `${ENCRYPTED_PREFIX}${iv.toString("hex")}:${encrypted}:${authTag}`
}

/**
 * Desencripta un string con formato enc:<iv>:<ciphertext>:<authTag>
 * Si el string no tiene el prefijo "enc:", lo retorna tal cual (legacy plaintext)
 */
export function decrypt(value: string): string {
  if (!value.startsWith(ENCRYPTED_PREFIX)) {
    return value // Legacy: password sin encriptar
  }

  const parts = value.slice(ENCRYPTED_PREFIX.length).split(":")
  if (parts.length !== 3) return value // Formato inválido, tratar como plaintext

  const [ivHex, ciphertext, authTagHex] = parts

  try {
    const key = getDerivedKey()
    const iv = Buffer.from(ivHex, "hex")
    const authTag = Buffer.from(authTagHex, "hex")
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(ciphertext, "hex", "utf8")
    decrypted += decipher.final("utf8")
    return decrypted
  } catch {
    console.error("[CRYPTO] Error decrypting value, returning as-is")
    return value
  }
}

/**
 * Verifica si un valor ya está encriptado
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX)
}
