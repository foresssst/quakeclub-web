import { NextResponse } from "next/server"
import { getSession, updateUserBanner } from "@/lib/auth"
import fs from "fs"
import path from "path"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const BANNERS_DIR = path.join(process.cwd(), "public", "banners")

// Ensure banners directory exists
if (!fs.existsSync(BANNERS_DIR)) {
  fs.mkdirSync(BANNERS_DIR, { recursive: true })
}

export async function DELETE(request: Request) {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const success = updateUserBanner(session.user.id, "")

    if (!success) {
      return NextResponse.json({ error: "Error al eliminar banner" }, { status: 500 })
    }

    const updatedSession = await getSession()
    if (updatedSession) {
      updatedSession.user.banner = ""
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting banner:", error)
    return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { bannerData, offsetX, offsetY } = await request.json()

    if (!bannerData || typeof bannerData !== "string") {
      return NextResponse.json({ error: "Datos de banner inválidos" }, { status: 400 })
    }

    // Check if it's a base64 image
    if (!bannerData.startsWith("data:image/")) {
      return NextResponse.json({ error: "Formato de imagen inválido" }, { status: 400 })
    }

    // Extract base64 data and extension
    const matches = bannerData.match(/^data:image\/(png|jpg|jpeg|gif|webp);base64,(.+)$/)
    if (!matches) {
      return NextResponse.json({ error: "Formato de imagen inválido" }, { status: 400 })
    }

    const ext = matches[1]
    const base64Data = matches[2]
    const buffer = Buffer.from(base64Data, "base64")

    // Check file size (max 10MB)
    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `El archivo es demasiado grande. Máximo ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 },
      )
    }

    const success = updateUserBanner(session.user.id, bannerData, offsetX, offsetY)

    if (!success) {
      return NextResponse.json({ error: "Error al actualizar banner" }, { status: 500 })
    }

    const updatedSession = await getSession()
    if (updatedSession) {
      updatedSession.user.banner = bannerData
    }

    return NextResponse.json({ success: true, bannerUrl: bannerData })
  } catch (error) {
    console.error("Error updating banner:", error)
    return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 500 })
  }
}
