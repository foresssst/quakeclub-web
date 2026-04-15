import { type NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import { getSession } from "@/lib/auth"
import { sanitizeFilename, logSecurityEvent, getSecurityHeaders } from "@/lib/security"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB (antes de optimizar)
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]

// Configuración de optimización
const MAX_WIDTH = 1920 // Ancho máximo de la imagen
const MAX_HEIGHT = 1080 // Alto máximo de la imagen
const JPEG_QUALITY = 85 // Calidad JPEG (0-100)
const PNG_QUALITY = 85 // Calidad PNG (0-100)
const WEBP_QUALITY = 85 // Calidad WebP (0-100)

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user.isAdmin) {
      logSecurityEvent("UNAUTHORIZED_IMAGE_UPLOAD", { userId: session?.user.id })
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      logSecurityEvent("IMAGE_UPLOAD_REJECTED", {
        userId: session.user.id,
        reason: "file_too_large",
        size: file.size,
      })
      return NextResponse.json(
        { error: `La imagen es demasiado grande. Máximo ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      logSecurityEvent("IMAGE_UPLOAD_REJECTED", {
        userId: session.user.id,
        reason: "invalid_type",
        type: file.type,
      })
      return NextResponse.json(
        { error: "Tipo de archivo no permitido. Solo JPG, PNG, GIF y WebP" },
        { status: 400 }
      )
    }

    const sanitizedFilename = sanitizeFilename(file.name)
    if (!sanitizedFilename) {
      return NextResponse.json({ error: "Nombre de archivo inválido" }, { status: 400 })
    }

    console.log(`[upload-image] Processing image: ${sanitizedFilename}`)
    console.log(`   Original size: ${(file.size / 1024).toFixed(2)} KB`)
    console.log(`   Original type: ${file.type}`)

    // Convertir el archivo a buffer
    const inputBuffer = Buffer.from(await file.arrayBuffer())

    // Procesar la imagen con sharp (animated: true para no perder frames de gifs)
    let processedImage = sharp(inputBuffer, { animated: true })

    // Obtener metadatos de la imagen original
    const metadata = await processedImage.metadata()
    console.log(`   Original dimensions: ${metadata.width}x${metadata.height}`)

    // Redimensionar si es necesario (manteniendo aspect ratio)
    if (metadata.width && metadata.width > MAX_WIDTH) {
      console.log(`     Image too wide, resizing to ${MAX_WIDTH}px`)
      processedImage = processedImage.resize({
        width: MAX_WIDTH,
        height: MAX_HEIGHT,
        fit: "inside",
        withoutEnlargement: true,
      })
    } else if (metadata.height && metadata.height > MAX_HEIGHT) {
      console.log(`     Image too tall, resizing to ${MAX_HEIGHT}px`)
      processedImage = processedImage.resize({
        width: MAX_WIDTH,
        height: MAX_HEIGHT,
        fit: "inside",
        withoutEnlargement: true,
      })
    }

    // Optimizar según el tipo de archivo
    let optimizedBuffer: Buffer
    let mimeType: string

    if (file.type === "image/png") {
      // PNG: Optimizar con compresión
      console.log(`    Optimizing PNG with quality ${PNG_QUALITY}`)
      optimizedBuffer = await processedImage
        .png({
          quality: PNG_QUALITY,
          compressionLevel: 9,
          adaptiveFiltering: true,
        })
        .toBuffer()
      mimeType = "image/png"
    } else if (file.type === "image/gif") {
      // GIF: Mantener animaciones, pero redimensionar
      console.log(`    Processing GIF (maintaining animation if any)`)
      optimizedBuffer = await processedImage.gif().toBuffer()
      mimeType = "image/gif"
    } else if (file.type === "image/webp") {
      // WebP: Optimizar con calidad
      console.log(`    Optimizing WebP with quality ${WEBP_QUALITY}`)
      optimizedBuffer = await processedImage
        .webp({
          quality: WEBP_QUALITY,
        })
        .toBuffer()
      mimeType = "image/webp"
    } else {
      // JPEG (default para jpg, jpeg y otros)
      console.log(`    Converting to JPEG with quality ${JPEG_QUALITY}`)
      optimizedBuffer = await processedImage
        .jpeg({
          quality: JPEG_QUALITY,
          mozjpeg: true, // Usa mozjpeg para mejor compresión
        })
        .toBuffer()
      mimeType = "image/jpeg"
    }

    const finalSize = optimizedBuffer.length
    const compressionRatio = ((1 - finalSize / inputBuffer.length) * 100).toFixed(1)

    console.log(`    Optimized size: ${(finalSize / 1024).toFixed(2)} KB`)
    console.log(`   Compression: ${compressionRatio}% smaller`)
    console.log(`    Data URI size: ${((finalSize * 1.37) / 1024).toFixed(2)} KB (base64)`)

    // Convertir a base64
    const base64 = optimizedBuffer.toString("base64")
    const dataUrl = `data:${mimeType};base64,${base64}`
    const imageId = `img-${Date.now()}`

    // Advertir si la imagen sigue siendo muy grande
    if (finalSize > 1024 * 1024) {
      console.log(`     WARNING: Image is still large (${(finalSize / 1024 / 1024).toFixed(2)}MB)`)
    }

    logSecurityEvent("IMAGE_UPLOAD_SUCCESS", {
      userId: session.user.id,
      filename: sanitizedFilename,
      originalSize: inputBuffer.length,
      optimizedSize: finalSize,
      compressionRatio: `${compressionRatio}%`,
    })

    const response = NextResponse.json({
      imageId,
      url: dataUrl,
      metadata: {
        originalSize: inputBuffer.length,
        optimizedSize: finalSize,
        compressionRatio: `${compressionRatio}%`,
        dimensions: metadata.width && metadata.height ? `${metadata.width}x${metadata.height}` : "unknown",
      },
    })

    const headers = getSecurityHeaders()
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (err) {
    console.error("[upload-image]  Error processing upload:", err)
    logSecurityEvent("IMAGE_UPLOAD_ERROR", { error: String(err) })
    return NextResponse.json({ error: "Error al subir la imagen" }, { status: 500 })
  }
}
