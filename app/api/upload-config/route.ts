import { type NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import path from "path"
import fs from "fs"
import { getSession } from "@/lib/auth"
import {
  sanitizeFilename,
  validateConfigFile,
  logSecurityEvent,
  getSecurityHeaders,
  safeJsonParse,
  checkUploadRateLimit,
} from "@/lib/security"

// Límite estricto de 0.5MB para archivos .cfg
// Un archivo .cfg típico pesa 50-200KB
const MAX_FILE_SIZE = 512 * 1024 // 0.5MB

export async function POST(req: NextRequest) {
  try {
    console.log("[upload-config] POST received")

    const session = await getSession()
    if (!session) {
      console.log("[upload-config] No session found")
      return NextResponse.json({ error: "Debes iniciar sesión para subir archivos" }, { status: 401 })
    }

    // Rate limiting: 5 uploads por hora por usuario
    const rateLimitResult = checkUploadRateLimit(session.user.id, 5, 60 * 60 * 1000)
    if (!rateLimitResult.allowed) {
      const minutesUntilReset = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000 / 60)
      logSecurityEvent("UPLOAD_RATE_LIMIT_EXCEEDED", {
        userId: session.user.id,
        username: session.user.username,
        resetTime: new Date(rateLimitResult.resetTime).toISOString(),
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
    console.log("[upload-config] formData keys:", Array.from(formData.keys()))

    if (!file) {
      console.log("[upload-config] No file found in formData")
      return NextResponse.json({ error: "Archivo no recibido" }, { status: 400 })
    }

    if (!preview || (!preview.type.includes("image/png") && !preview.type.includes("image/jpeg") && !preview.type.includes("image/jpg"))) {
      console.log("[upload-config] Invalid preview type:", preview?.type)
      return NextResponse.json({ error: "Imagen de vista previa inválida (solo PNG, JPG o JPEG)" }, { status: 400 })
    }

    if (!author || author.trim().length === 0) {
      return NextResponse.json({ error: "El nombre del autor es requerido" }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      logSecurityEvent("UPLOAD_REJECTED", {
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

    if (!sanitizedFilename || !sanitizedFilename.endsWith(".cfg")) {
      console.log("[upload-config] Invalid file name or extension:", sanitizedFilename)
      logSecurityEvent("UPLOAD_REJECTED", {
        userId: session.user.id,
        reason: "invalid_filename",
        originalName: file.name,
      })
      return NextResponse.json({ error: "Archivo inválido. Solo se permiten archivos .cfg" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const content = buffer.toString("utf-8")

    if (!validateConfigFile(content)) {
      logSecurityEvent("UPLOAD_REJECTED", {
        userId: session.user.id,
        reason: "invalid_content",
        filename: sanitizedFilename,
      })
      return NextResponse.json(
        { error: "El contenido del archivo no es válido. Solo se permiten archivos de texto." },
        { status: 400 },
      )
    }

    const dir = path.join(process.cwd(), "public", "configs")
    const previewsDir = path.join(process.cwd(), "public", "configs", "previews")

    if (!fs.existsSync(dir)) {
      console.log("[upload-config] configs folder not found, creating...")
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
    const previewFileName = `${sanitizedFilename.replace(".cfg", "")}.${previewExt}`
    const previewPath = path.join(previewsDir, previewFileName)

    // Escribir archivos de forma sincrónica para asegurar que se completen
    fs.writeFileSync(savePath, buffer)
    fs.writeFileSync(previewPath, previewBuffer)
    
    // Verificar que el archivo de preview se escribió correctamente
    if (!fs.existsSync(previewPath) || fs.statSync(previewPath).size === 0) {
      console.error("[upload-config] Preview file not written correctly")
      throw new Error("Error al guardar la imagen de preview")
    }
    
    console.log("[upload-config] File saved to", savePath, "size", buffer.length)
    console.log("[upload-config] Preview saved to", previewPath, "size", previewBuffer.length)

    const metadataPath = path.join(dir, "metadata.json")
    let metadata: any[] = []
    try {
      if (fs.existsSync(metadataPath)) {
        const data = fs.readFileSync(metadataPath, "utf8")
        metadata = safeJsonParse(data, [])
      }
    } catch (err) {
      console.log("[upload-config] Failed reading metadata.json, starting fresh", err)
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
      previewImage: `/configs/previews/${previewFileName}`,
    }
    const idx = metadata.findIndex((m: any) => m.name === sanitizedFilename)
    if (idx >= 0) metadata[idx] = newMeta
    else metadata.push(newMeta)

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
    console.log("[upload-config] metadata updated")

    logSecurityEvent("UPLOAD_SUCCESS", {
      userId: session.user.id,
      filename: sanitizedFilename,
      size: buffer.length,
    })

    // Revalidar la ruta de configs para que Next.js detecte las nuevas imágenes
    try {
      revalidatePath("/configs")
      revalidatePath(`/configs/previews/${previewFileName}`)
    } catch (revalidateError) {
      console.warn("[upload-config] Revalidation warning:", revalidateError)
    }

    const response = NextResponse.json({ success: true, fileName: sanitizedFilename })
    const headers = getSecurityHeaders()
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (err) {
    console.error("[upload-config] Error processing upload:", err)
    logSecurityEvent("UPLOAD_ERROR", { error: String(err) })
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
