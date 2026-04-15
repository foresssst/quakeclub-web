import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import fs from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data")
const BANNER_CONFIG_FILE = path.join(DATA_DIR, "banner-config.json")

// Asegura que el directorio de datos existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

interface BannerConfig {
  mode: "latest" | "specific" | "motd"
  newsId?: string
  motdText?: string
}

function loadBannerConfig(): BannerConfig {
  try {
    if (fs.existsSync(BANNER_CONFIG_FILE)) {
      const data = fs.readFileSync(BANNER_CONFIG_FILE, "utf-8")
      return JSON.parse(data)
    }
  } catch (error) {
    console.error("Error loading banner config:", error)
  }
  return { mode: "latest" }
}

function saveBannerConfig(config: BannerConfig) {
  try {
    fs.writeFileSync(BANNER_CONFIG_FILE, JSON.stringify(config, null, 2))
  } catch (error) {
    console.error("Error saving banner config:", error)
    throw error
  }
}

export async function GET() {
  try {
    const config = loadBannerConfig()
    return NextResponse.json(config)
  } catch (error) {
    console.error("Error fetching banner config:", error)
    return NextResponse.json({ mode: "latest" })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()

    if (!session) {
      console.log("[Banner Config] No session found")
      return NextResponse.json({ error: "No autorizado - sesión no encontrada" }, { status: 401 })
    }

    if (!session.user.isAdmin) {
      console.log("[Banner Config] User is not admin:", session.user.username)
      return NextResponse.json({ error: "Usuario no es administrador" }, { status: 403 })
    }

    const { mode, newsId, motdText } = await request.json()

    const config: BannerConfig = { mode }
    if (newsId) config.newsId = newsId
    if (motdText) config.motdText = motdText

    saveBannerConfig(config)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving banner config:", error)
    return NextResponse.json({ error: "Error al guardar configuración" }, { status: 500 })
  }
}
