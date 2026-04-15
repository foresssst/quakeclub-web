import fs from "fs"
import path from "path"
import { safeJsonParse } from "@/lib/security"

const DATA_DIR = path.join(process.cwd(), "data")
const PROFILE_EXTRAS_FILE = path.join(DATA_DIR, "profile-extras.json")
const MAX_BIO_LENGTH = 280
const MAX_URL_LENGTH = 300

export interface ProfileLinks {
  steam?: string
  discord?: string
  instagram?: string
  spotify?: string
}

export interface ProfileExtras {
  bio?: string
  links?: ProfileLinks
  updatedAt?: number
}

type ProfileExtrasStore = Record<string, ProfileExtras>

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

function loadProfileExtrasStore(): ProfileExtrasStore {
  try {
    if (!fs.existsSync(PROFILE_EXTRAS_FILE)) {
      return {}
    }

    const raw = fs.readFileSync(PROFILE_EXTRAS_FILE, "utf-8")
    return safeJsonParse<ProfileExtrasStore>(raw, {})
  } catch (error) {
    console.error("Error loading profile extras:", error)
    return {}
  }
}

function saveProfileExtrasStore(store: ProfileExtrasStore) {
  try {
    fs.writeFileSync(PROFILE_EXTRAS_FILE, JSON.stringify(store, null, 2))
  } catch (error) {
    console.error("Error saving profile extras:", error)
    throw error
  }
}

function normalizeBio(value?: string | null) {
  if (!value) {
    return undefined
  }

  const normalized = value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim()

  if (!normalized) {
    return undefined
  }

  return normalized.slice(0, MAX_BIO_LENGTH)
}

function normalizeUrl(value?: string | null) {
  if (!value) {
    return undefined
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  let parsed: URL
  try {
    parsed = new URL(withProtocol)
  } catch {
    throw new Error("URL invalida")
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Solo se permiten enlaces http o https")
  }

  return parsed.toString().slice(0, MAX_URL_LENGTH)
}

function hasContent(extras: ProfileExtras) {
  return Boolean(
    extras.bio ||
      extras.links?.steam ||
      extras.links?.discord ||
      extras.links?.instagram ||
      extras.links?.spotify
  )
}

export function sanitizeProfileExtras(input: { bio?: string | null; links?: ProfileLinks | null }) {
  const sanitized: ProfileExtras = {
    bio: normalizeBio(input.bio),
    links: {
      steam: normalizeUrl(input.links?.steam),
      discord: normalizeUrl(input.links?.discord),
      instagram: normalizeUrl(input.links?.instagram),
      spotify: normalizeUrl(input.links?.spotify),
    },
  }

  if (!sanitized.links?.steam && !sanitized.links?.discord && !sanitized.links?.instagram && !sanitized.links?.spotify) {
    delete sanitized.links
  }

  return sanitized
}

export function getProfileExtras(steamId: string) {
  const store = loadProfileExtrasStore()
  return store[steamId] || null
}

export function updateProfileExtras(steamId: string, input: { bio?: string | null; links?: ProfileLinks | null }) {
  const store = loadProfileExtrasStore()
  const sanitized = sanitizeProfileExtras(input)

  if (!hasContent(sanitized)) {
    delete store[steamId]
    saveProfileExtrasStore(store)
    return null
  }

  const nextValue: ProfileExtras = {
    ...sanitized,
    updatedAt: Date.now(),
  }

  store[steamId] = nextValue
  saveProfileExtrasStore(store)

  return nextValue
}
