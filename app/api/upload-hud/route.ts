import { type NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import path from "path"
import fs from "fs"
import { getSession } from "@/lib/auth"
import {
  sanitizeFilename,
  logSecurityEvent,
  getSecurityHeaders,
  safeJsonParse,
  checkUploadRateLimit,
} from "@/lib/security"

// Límite de 10MB para archivos .zip de HUDs
const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Debes iniciar sesión para subir archivos" }, { status: 401 })
    }

    // Rate limiting: 5 uploads por hora por usuario
    const rateLimitResult = checkUploadRateLimit(session.user.id, 5, 60 * 60 * 1000)
    if (!rateLimitResult.allowed) {
      const minutesUntilReset = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000 / 60)
      logSecurityEvent("HUD_UPLOAD_RATE_LIMIT_EXCEEDED", {
        userId: session.user.id,
        username: session.user.username,
      })
      return NextResponse.json(
        {
          error: `Has excedido el límite de uploads. Podrás subir más archivos en ${minutesUntilReset} minuto(s).`,
          resetTime: rateLimitResult.resetTime,
        },
        { status: 429 },
      )
    }

    const formData = await req.formData()
    const file = formData.get("file") as File
    const preview = formData.get("preview") as File
    const author = formData.get("author") as string
    const description = formData.get("description") as string

    if (!file) {
      return NextResponse.json({ error: "Archivo no recibido" }, { status: 400 })
    }

    if (!preview || (!preview.type.includes("image/png") && !preview.type.includes("image/jpeg") && !preview.type.includes("image/jpg"))) {
      return NextResponse.json({ error: "Imagen de vista previa inválida (solo PNG, JPG o JPEG)" }, { status: 400 })
    }

    if (!author || author.trim().length === 0) {
      return NextResponse.json({ error: "El nombre del autor es requerido" }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      logSecurityEvent("HUD_UPLOAD_REJECTED", {
        userId: session.user.id,
        reason: "file_too_large",
        size: file.size,
      })
      return NextResponse.json(
        { error: `El archivo es demasiado grande. Máximo permitido: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 },
      )
    }

    const sanitizedFilename = sanitizeFilename(file.name)

    if (!sanitizedFilename || !sanitizedFilename.endsWith(".zip")) {
      logSecurityEvent("HUD_UPLOAD_REJECTED", {
        userId: session.user.id,
        reason: "invalid_filename",
        originalName: file.name,
      })
      return NextResponse.json({ error: "Archivo inválido. Solo se permiten archivos .zip" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const dir = path.join(process.cwd(), "public", "huds")
    const previewsDir = path.join(process.cwd(), "public", "huds", "previews")

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    if (!fs.existsSync(previewsDir)) {
      fs.mkdirSync(previewsDir, { recursive: true })
    }

    const savePath = path.join(dir, sanitizedFilename)
    if (!savePath.startsWith(dir)) {
      logSecurityEvent("PATH_TRAVERSAL_ATTEMPT", {
        userId: session.user.id,
        filename: sanitizedFilename,
      })
      return NextResponse.json({ error: "Nombre de archivo inválido" }, { status: 400 })
    }

    const previewBuffer = Buffer.from(await preview.arrayBuffer())
    const previewExt = (preview.name.split(".").pop() || "png").toLowerCase()
    const previewFileName = `${sanitizedFilename.replace(".zip", "")}.${previewExt}`
    const previewPath = path.join(previewsDir, previewFileName)

    fs.writeFileSync(savePath, buffer)
    fs.writeFileSync(previewPath, previewBuffer)

    if (!fs.existsSync(previewPath) || fs.statSync(previewPath).size === 0) {
      throw new Error("Error al guardar la imagen de preview")
    }

    const metadataPath = path.join(dir, "metadata.json")
    let metadata: any[] = []
    try {
      if (fs.existsSync(metadataPath)) {
        const data = fs.readFileSync(metadataPath, "utf8")
        metadata = safeJsonParse(data, [])
      }
    } catch (err) {
      logSecurityEvent("METADATA_READ_ERROR", { error: String(err) })
      metadata = []
    }

    const now = new Date()
    const newMeta = {
      name: sanitizedFilename,
      size: `${(buffer.length / 1024).toFixed(2)} KB`,
      uploadDate: now.toISOString().slice(0, 10),
      downloads: 0,
      userId: session.user.id,
      username: session.user.username,
      author: author.trim(),
      description: description?.trim() || "",
      previewImage: `/huds/previews/${previewFileName}`,
    }
    const idx = metadata.findIndex((m: any) => m.name === sanitizedFilename)
    if (idx >= 0) metadata[idx] = newMeta
    else metadata.push(newMeta)

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))

    logSecurityEvent("HUD_UPLOAD_SUCCESS", {
      userId: session.user.id,
      filename: sanitizedFilename,
      size: buffer.length,
    })

    try {
      revalidatePath("/huds")
      revalidatePath(`/huds/previews/${previewFileName}`)
    } catch (revalidateError) {
      console.warn("[upload-hud] Revalidation warning:", revalidateError)
    }

    const response = NextResponse.json({ success: true, fileName: sanitizedFilename })
    const headers = getSecurityHeaders()
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (err) {
    console.error("[upload-hud] Error processing upload:", err)
    logSecurityEvent("HUD_UPLOAD_ERROR", { error: String(err) })
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
