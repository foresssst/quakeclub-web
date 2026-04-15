import { NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import sharp from "sharp"
import { getSession } from "@/lib/auth"

const BADGES_DIR = path.join(process.cwd(), "public", "badges")
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB (GIFs pueden ser más pesados)
const TARGET_WIDTH = 86
const TARGET_HEIGHT = 40

// Crear directorio si no existe
async function ensureBadgesDir() {
  try {
    await mkdir(BADGES_DIR, { recursive: true })
  } catch (error) {
    console.error("Error creating badges directory:", error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó un archivo" }, { status: 400 })
    }

    // Validar tipo de archivo
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Formato no soportado. Usa PNG, JPG, WebP o GIF" },
        { status: 400 }
      )
    }

    // Validar tamaño
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "El archivo es demasiado grande (máximo 10MB)" },
        { status: 400 }
      )
    }

    // Generar nombre único
    const timestamp = Date.now()
    const safeFileName = file.name.replace(/[^a-z0-9.]/gi, "_").toLowerCase()
    const fileName = `${timestamp}-${safeFileName}`

    // Asegurar que el directorio existe
    await ensureBadgesDir()

    // Leer el archivo
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const isGif = file.type === "image/gif"

    let finalFileName: string
    let filePath: string

    if (isGif) {
      // Para GIFs: redimensionar manteniendo animación
      finalFileName = fileName.replace(/\.(jpg|jpeg|png|webp)$/i, ".gif")
      if (!finalFileName.endsWith(".gif")) {
        finalFileName = finalFileName + ".gif"
      }
      filePath = path.join(BADGES_DIR, finalFileName)

      // Sharp puede redimensionar GIFs animados con animated: true
      await sharp(buffer, { animated: true })
        .resize(TARGET_WIDTH, TARGET_HEIGHT, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .gif()
        .toFile(filePath)
    } else {
      // Para otros formatos: convertir a WebP
      finalFileName = fileName.replace(/\.(jpg|jpeg|png|gif|webp)$/i, ".webp")
      if (!finalFileName.endsWith(".webp")) {
        finalFileName = finalFileName + ".webp"
      }
      filePath = path.join(BADGES_DIR, finalFileName)

      await sharp(buffer)
        .resize(TARGET_WIDTH, TARGET_HEIGHT, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 90 })
        .toFile(filePath)
    }

    const imageUrl = `/api/badges/${finalFileName}`

    return NextResponse.json({
      success: true,
      imageUrl,
      fileName: finalFileName,
    })
  } catch (error) {
    console.error("Error uploading badge image:", error)
    return NextResponse.json({ error: "Error al subir la imagen" }, { status: 500 })
  }
}
