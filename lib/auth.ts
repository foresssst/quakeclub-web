/**
 * Sistema de Autenticación de QuakeClub
 * 
 * Maneja la autenticación de usuarios, gestión de sesiones y permisos.
 * Soporta usuarios locales (con contraseña) y usuarios de Steam (OAuth).
 * 
 * SEGURIDAD:
 * - Las contraseñas se hashean con bcrypt (10 rondas)
 * - Las sesiones tienen expiración configurable (7 días o 365 días con "Mantener sesión")
 * - Los datos se persisten en archivos JSON (data/users.json, data/sessions.json)
 * - Se implementa rate limiting en los endpoints de login
 */

import { cookies } from "next/headers"
import bcrypt from "bcryptjs"
import fs from "fs"
import path from "path"
import { generateSecureToken, safeJsonParse, logSecurityEvent } from "./security"
import type { NextRequest } from "next/server"

export interface User {
  id: string
  steamId?: string // ID64 de Steam para usuarios de inicio de sesión con Steam
  username: string
  isAdmin?: boolean
  avatar?: string
  banner?: string
  bannerOffsetX?: number // Offset horizontal del banner en píxeles
  bannerOffsetY?: number // Offset vertical del banner en píxeles
  createdAt?: number
  countryCode?: string
}

export interface Session {
  user: User
  expiresAt: number
  maxAge: number // Duración original en ms, para renovación proporcional
}

const DATA_DIR = path.join(process.cwd(), "data")
const USERS_FILE = path.join(DATA_DIR, "users.json")
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json")

// Asegura que el directorio de datos existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// Carga usuarios desde archivo
function loadUsers(): Map<
  string,
  {
    username: string
    passwordHash?: string
    steamId?: string
    id: string
    isAdmin?: boolean
    avatar?: string
    banner?: string
    bannerOffsetX?: number
    bannerOffsetY?: number
    createdAt?: number
    countryCode?: string
  }
> {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, "utf-8")
      const usersArray = safeJsonParse<Array<[string, any]>>(data, [])
      return new Map(usersArray)
    }
  } catch (error) {
    logSecurityEvent("USERS_LOAD_ERROR", { error: String(error) })
    console.error("Error loading users:", error)
  }
  return new Map()
}

// Guarda usuarios en archivo
function saveUsers(
  users: Map<
    string,
    {
      username: string
      passwordHash?: string
      steamId?: string
      id: string
      isAdmin?: boolean
      avatar?: string
      banner?: string
      bannerOffsetX?: number
      bannerOffsetY?: number
      createdAt?: number
      countryCode?: string
    }
  >,
) {
  try {
    const usersArray = Array.from(users.entries())
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersArray, null, 2))
  } catch (error) {
    console.error("Error saving users:", error)
  }
}

// Carga sesiones desde archivo
function loadSessions(): Map<string, Session> {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = fs.readFileSync(SESSIONS_FILE, "utf-8")
      const sessionsArray = safeJsonParse<Array<[string, Session]>>(data, [])
      const now = Date.now()
      const validSessions = sessionsArray.filter(([_, session]) => session.expiresAt > now)
      return new Map(validSessions)
    }
  } catch (error) {
    logSecurityEvent("SESSIONS_LOAD_ERROR", { error: String(error) })
    console.error("Error loading sessions:", error)
  }
  return new Map()
}

// Guarda sesiones en archivo
function saveSessions(sessions: Map<string, Session>) {
  try {
    const sessionsArray = Array.from(sessions.entries())
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessionsArray, null, 2))
  } catch (error) {
    console.error("Error saving sessions:", error)
  }
}

const users = loadUsers()
const sessions = loadSessions()

// Inicializa usuario demo si no existe
// if (!users.has("demo")) {
//   const demoPasswordHash = bcrypt.hashSync("demo123", 10)
//   users.set("demo", { username: "demo", passwordHash: demoPasswordHash, id: "1", isAdmin: false })
//   saveUsers(users)
// }

// Inicializar usuario administrador desde variable de entorno
// IMPORTANTE: ADMIN_PASSWORD debe estar definida en .env
if (!users.has("operador")) {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    console.error("ERROR CRITICO: ADMIN_PASSWORD no definida en variables de entorno")
    throw new Error("ADMIN_PASSWORD es requerida para inicializar el sistema")
  }
  const adminPasswordHash = bcrypt.hashSync(adminPassword, 10)
  users.set("operador", { username: "operador", passwordHash: adminPasswordHash, id: "admin-1", isAdmin: true })
  saveUsers(users)
}

export async function createUser(username: string, password: string): Promise<User | null> {
  if (users.has(username)) {
    return null // Usuario ya existe
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const id = Date.now().toString()
  users.set(username, { username, passwordHash, id, isAdmin: false })
  saveUsers(users) // Guarda en archivo después de crear usuario
  return { id, username, isAdmin: false }
}

/**
 * Verifica las credenciales de un usuario
 * @param username Nombre de usuario
 * @param password Contraseña en texto plano
 * @returns Usuario si las credenciales son válidas, null en caso contrario
 */
export async function verifyUser(username: string, password: string): Promise<User | null> {
  const user = users.get(username)
  if (!user || !user.passwordHash) {
    return null
  }

  const isValid = await bcrypt.compare(password, user.passwordHash)
  if (!isValid) {
    return null
  }

  // Use the isAdmin field from user record - operador is always admin, others check the stored flag
  const isAdmin = username === "operador" || user.isAdmin === true
  return { id: user.id, username: user.username, isAdmin, avatar: user.avatar, countryCode: user.countryCode }
}

export const SESSION_SHORT = 7 * 24 * 60 * 60 * 1000   // 7 días
export const SESSION_LONG = 365 * 24 * 60 * 60 * 1000   // 365 días
export const SESSION_SHORT_SECONDS = 7 * 24 * 60 * 60    // 7 días en segundos (para cookie maxAge)
export const SESSION_LONG_SECONDS = 365 * 24 * 60 * 60   // 365 días en segundos (para cookie maxAge)

/**
 * Crea una nueva sesión para un usuario
 *
 * Permite múltiples sesiones simultáneas (multi-dispositivo).
 * La duración depende del parámetro rememberMe.
 *
 * @param user Usuario para el cual crear la sesión
 * @param rememberMe Si true, sesión de 365 días. Si false, 7 días.
 * @returns ID de sesión generado
 */
export function createSession(user: User, rememberMe: boolean = true): string {
  const sessionId = generateSecureToken()
  const maxAge = rememberMe ? SESSION_LONG : SESSION_SHORT
  const expiresAt = Date.now() + maxAge

  sessions.set(sessionId, { user, expiresAt, maxAge })
  saveSessions(sessions)

  logSecurityEvent("SESSION_CREATED", {
    userId: user.id,
    username: user.username,
    rememberMe,
    expiresAt: new Date(expiresAt).toISOString()
  })

  return sessionId
}

/**
 * Obtiene la sesión actual del usuario
 * 
 * Verifica la validez de la sesión y recarga los datos del usuario
 * desde el archivo para asegurar que estén actualizados.
 * 
 * MEJORA DE RENDIMIENTO: Las sesiones se cargan desde memoria primero,
 * y solo se recargan desde disco si no se encuentran (para manejar reinicios del servidor).
 * 
 * @returns Sesión actual o null si no hay sesión válida
 */
export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = await cookies()
    const sessionId = cookieStore.get("session")?.value

    if (!sessionId) {
      return null
    }

    // Intentar obtener sesión desde memoria
    let session = sessions.get(sessionId)

    // Si no está en memoria, recargar desde disco (puede haber sido reiniciado el servidor)
    if (!session) {
      const loadedSessions = loadSessions()
      session = loadedSessions.get(sessionId)
      if (session) {
        // Restaurar sesión en memoria
        sessions.set(sessionId, session)
      }
    }

    if (!session || session.expiresAt < Date.now()) {
      if (session) {
        logSecurityEvent("SESSION_EXPIRED", { sessionId })
      }
      sessions.delete(sessionId)
      saveSessions(sessions)
      return null
    }

    // Renovar sesión automáticamente cuando queda menos del 50% de su duración original
    const originalMaxAge = session.maxAge || 30 * 24 * 60 * 60 * 1000
    const refreshThreshold = originalMaxAge / 2
    if (session.expiresAt - Date.now() < refreshThreshold) {
      session.expiresAt = Date.now() + originalMaxAge
      session.maxAge = originalMaxAge
      sessions.set(sessionId, session)
      saveSessions(sessions)
    }

    // Recarga datos del usuario desde users.json para obtener el avatar más reciente y otras actualizaciones
    const usersMap = loadUsers()
    let freshUser: User | null = null

    if (session.user.steamId) {
      // Encuentra usuario por steamId
      for (const user of usersMap.values()) {
        if (user.steamId === session.user.steamId) {
          freshUser = {
            id: user.id,
            steamId: user.steamId,
            username: user.username,
            isAdmin: user.isAdmin || false,
            avatar: user.avatar,
            createdAt: user.createdAt,
            countryCode: user.countryCode,
          }
          break
        }
      }
    } else {
      // Encuentra usuario por nombre de usuario (para usuarios no Steam como admin)
      const user = usersMap.get(session.user.username)
      if (user) {
        freshUser = {
          id: user.id,
          steamId: user.steamId,
          username: user.username,
          isAdmin: user.isAdmin || false,
          avatar: user.avatar,
          createdAt: user.createdAt,
          countryCode: user.countryCode,
        }
      }
    }

    if (!freshUser) {
      // Usuario no encontrado en users.json, la sesión es inválida
      sessions.delete(sessionId)
      saveSessions(sessions)
      return null
    }

    // Retorna sesión con datos del usuario actualizados
    return {
      user: freshUser,
      expiresAt: session.expiresAt,
      maxAge: session.maxAge || 30 * 24 * 60 * 60 * 1000,
    }
  } catch (error) {
    logSecurityEvent("SESSION_GET_ERROR", { error: String(error) })
    return null
  }
}

export async function verifySession(
  request: NextRequest,
): Promise<{ userId: string; username: string; isAdmin?: boolean } | null> {
  const sessionId = request.cookies.get("session")?.value

  if (!sessionId) {
    return null
  }

  const session = sessions.get(sessionId)
  if (!session || session.expiresAt < Date.now()) {
    if (session) {
      sessions.delete(sessionId)
      saveSessions(sessions)
    }
    return null
  }

  return {
    userId: session.user.id,
    username: session.user.username,
    isAdmin: session.user.isAdmin,
  }
}

export function deleteSession(sessionId: string) {
  sessions.delete(sessionId)
  saveSessions(sessions) // Guarda en archivo después de eliminar sesión
}

export function getAllUsers(): Array<{
  id: string
  username: string
  isAdmin: boolean
  steamId?: string
  avatar?: string
  countryCode?: string
}> {
  const usersMap = loadUsers()
  return Array.from(usersMap.values()).map((user) => ({
    id: user.id,
    username: user.username,
    isAdmin: user.isAdmin || false,
    steamId: user.steamId,
    avatar: user.avatar,
    countryCode: user.countryCode,
  }))
}

export function deleteUser(userId: string): boolean {
  const usersMap = loadUsers()
  let found = false

  for (const [username, user] of usersMap.entries()) {
    if (user.id === userId) {
      // Evita eliminar el admin principal
      if (username === "operador") {
        return false
      }
      usersMap.delete(username)
      found = true
      break
    }
  }

  if (found) {
    saveUsers(usersMap)
  }
  return found
}

export function updateUserAdmin(userId: string, isAdmin: boolean): boolean {
  const usersMap = loadUsers()
  let found = false

  for (const [username, user] of usersMap.entries()) {
    if (user.id === userId) {
      // Evita modificar el admin principal
      if (username === "operador") {
        return false
      }
      user.isAdmin = isAdmin
      usersMap.set(username, user)
      found = true
      break
    }
  }

  if (found) {
    saveUsers(usersMap)
  }
  return found
}

export function updateUserAvatar(userId: string, avatarUrl: string): boolean {
  const usersMap = loadUsers()
  let found = false

  for (const [username, user] of usersMap.entries()) {
    if (user.id === userId) {
      user.avatar = avatarUrl
      usersMap.set(username, user)
      found = true
      break
    }
  }

  if (found) {
    saveUsers(usersMap)
  }
  return found
}

export function updateUserBanner(userId: string, bannerUrl: string, offsetX?: number, offsetY?: number): boolean {
  const usersMap = loadUsers()
  let found = false

  for (const [username, user] of usersMap.entries()) {
    if (user.id === userId) {
      user.banner = bannerUrl
      if (offsetX !== undefined) {
        user.bannerOffsetX = offsetX
      }
      if (offsetY !== undefined) {
        user.bannerOffsetY = offsetY
      }
      usersMap.set(username, user)
      found = true
      break
    }
  }

  if (found) {
    saveUsers(usersMap)
  }
  return found
}

export function getUserById(userId: string): User | null {
  const usersMap = loadUsers()

  for (const user of usersMap.values()) {
    if (user.id === userId) {
      return {
        id: user.id,
        steamId: user.steamId,
        username: user.username,
        isAdmin: user.isAdmin || false,
        avatar: user.avatar,
        createdAt: user.createdAt,
        countryCode: user.countryCode,
      }
    }
  }

  return null
}

// Encuentra usuario por ID de Steam
export function getUserBySteamId(steamId: string): User | null {
  const usersMap = loadUsers()

  for (const user of usersMap.values()) {
    if (user.steamId === steamId) {
      return {
        id: user.id,
        steamId: user.steamId,
        username: user.username,
        isAdmin: user.isAdmin || false,
        avatar: user.avatar,
        banner: user.banner,
        createdAt: user.createdAt,
        countryCode: user.countryCode,
      }
    }
  }

  return null
}

// Batch: encuentra múltiples usuarios por Steam IDs en una sola lectura
export function getUsersBySteamIds(steamIds: string[]): Map<string, User> {
  const usersMap = loadUsers()
  const result = new Map<string, User>()
  const steamIdSet = new Set(steamIds)

  for (const user of usersMap.values()) {
    if (user.steamId && steamIdSet.has(user.steamId)) {
      result.set(user.steamId, {
        id: user.id,
        steamId: user.steamId,
        username: user.username,
        isAdmin: user.isAdmin || false,
        avatar: user.avatar,
        banner: user.banner,
        createdAt: user.createdAt,
        countryCode: user.countryCode,
      })
    }
  }
  return result
}

// Crea o actualiza usuario desde inicio de sesión de Steam
export function createOrUpdateSteamUser(
  steamId: string,
  username: string,
  avatar?: string,
  countryCode?: string,
): User {
  const usersMap = loadUsers()

  // Verifica si el usuario ya existe por steamId
  for (const [key, user] of usersMap.entries()) {
    if (user.steamId === steamId) {
      // Actualiza nombre de usuario
      user.username = username

      // Solo actualiza avatar si el usuario no tiene un avatar personalizado (subido)
      const hasCustomAvatar = user.avatar && user.avatar.startsWith("/avatars/")
      if (avatar && !hasCustomAvatar) {
        user.avatar = avatar
      }

      if (countryCode) {
        user.countryCode = countryCode
      }
      usersMap.set(key, user)
      saveUsers(usersMap)
      return {
        id: user.id,
        steamId: user.steamId,
        username: user.username,
        isAdmin: user.isAdmin || false,
        avatar: user.avatar,
        createdAt: user.createdAt,
        countryCode: user.countryCode,
      }
    }
  }

  // Crea nuevo usuario
  const id = `steam_${steamId}`
  const createdAt = Date.now()
  const newUser = {
    id,
    steamId,
    username,
    avatar,
    isAdmin: false,
    createdAt,
    countryCode: countryCode || "CL",
  }

  usersMap.set(steamId, newUser)
  saveUsers(usersMap)

  return {
    id,
    steamId,
    username,
    isAdmin: false,
    avatar,
    createdAt,
    countryCode: newUser.countryCode,
  }
}
