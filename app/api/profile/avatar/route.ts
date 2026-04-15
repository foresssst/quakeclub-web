import { NextResponse } from "next/server"
import { getSession, updateUserAvatar } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import fs from "fs"
import path from "path"
import { v4 as uuidv4 } from "uuid"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB para GIFs y fotos bonitas!
const AVATARS_DIR = path.join(process.cwd(), "public", "avatars")

// Ensure avatars directory exists
if (!fs.existsSync(AVATARS_DIR)) {
  fs.mkdirSync(AVATARS_DIR, { recursive: true })
}

export async function DELETE(request: Request) {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    // Borrar archivo de avatar anterior si es local
    const oldAvatar = session.user.avatar
    if (oldAvatar && oldAvatar.startsWith("/avatars/")) {
      const oldPath = path.join(process.cwd(), "public", oldAvatar)
      try { fs.unlinkSync(oldPath) } catch {}
    }

    const success = updateUserAvatar(session.user.id, "")

    if (!success) {
      return NextResponse.json({ error: "Error al eliminar avatar" }, { status: 500 })
    }

    // Sync to Player DB
    if (session.user.steamId) {
      await prisma.player.update({
        where: { steamId: session.user.steamId },
        data: { avatar: null },
      }).catch(() => {})
    }

    const updatedSession = await getSession()
    if (updatedSession) {
      updatedSession.user.avatar = ""
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting avatar:", error)
    return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { avatarData } = await request.json()

    if (!avatarData || typeof avatarData !== "string") {
      return NextResponse.json({ error: "Datos de avatar inválidos" }, { status: 400 })
    }

    // Check if it's a base64 image
    if (!avatarData.startsWith("data:image/")) {
      return NextResponse.json({ error: "Formato de imagen inválido" }, { status: 400 })
    }

    // Extract base64 data and extension
    const matches = avatarData.match(/^data:image\/(png|jpg|jpeg|gif|webp);base64,(.+)$/)
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

    // Guardar archivo a disco (no base64 en sesión/users.json)
    const filename = `${uuidv4()}.${ext}`
    const filepath = path.join(AVATARS_DIR, filename)
    fs.writeFileSync(filepath, buffer)
    const avatarUrl = `/avatars/${filename}`

    // Borrar avatar anterior si es archivo local
    const oldAvatar = session.user.avatar
    if (oldAvatar && oldAvatar.startsWith("/avatars/")) {
      const oldPath = path.join(process.cwd(), "public", oldAvatar)
      try { fs.unlinkSync(oldPath) } catch {}
    }

    const success = updateUserAvatar(session.user.id, avatarUrl)

    if (!success) {
      return NextResponse.json({ error: "Error al actualizar avatar" }, { status: 500 })
    }

    // Sync to Player DB
    if (session.user.steamId) {
      await prisma.player.update({
        where: { steamId: session.user.steamId },
        data: { avatar: avatarUrl },
      }).catch(() => {})
    }

    const updatedSession = await getSession()
    if (updatedSession) {
      updatedSession.user.avatar = avatarUrl
    }

    return NextResponse.json({ success: true, avatarUrl })
  } catch (error) {
    console.error("Error updating avatar:", error)
    return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 500 })
  }
}
