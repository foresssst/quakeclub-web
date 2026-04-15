import { type NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs"
import { sanitizeFilename, logSecurityEvent, getSecurityHeaders } from "@/lib/security"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const name = searchParams.get("name")

    if (!name) {
      return new NextResponse("Nombre de archivo requerido", { status: 400 })
    }

    const sanitizedName = sanitizeFilename(name)

    if (!sanitizedName || !sanitizedName.endsWith(".zip")) {
      logSecurityEvent("GET_HUD_REJECTED", {
        reason: "invalid_filename",
        originalName: name,
      })
      return new NextResponse("Archivo inválido", { status: 400 })
    }

    const hudsDir = path.join(process.cwd(), "public", "huds")
    const filePath = path.join(hudsDir, sanitizedName)

    if (!filePath.startsWith(hudsDir)) {
      logSecurityEvent("PATH_TRAVERSAL_ATTEMPT", {
        requestedFile: name,
        sanitizedFile: sanitizedName,
      })
      return new NextResponse("Acceso denegado", { status: 403 })
    }

    if (!fs.existsSync(filePath)) {
      return new NextResponse("No encontrado", { status: 404 })
    }

    // Incrementar descargas en metadata
    const metadataPath = path.join(hudsDir, "metadata.json")
    let metadata = []
    try {
      if (fs.existsSync(metadataPath)) {
        const metadataContent = fs.readFileSync(metadataPath, "utf8")
        metadata = JSON.parse(metadataContent)
      }
    } catch (error) {
      logSecurityEvent("METADATA_READ_ERROR", { error: String(error) })
      metadata = []
    }

    const idx = metadata.findIndex((m: any) => m.name === sanitizedName)
    if (idx >= 0) {
      metadata[idx].downloads = (metadata[idx].downloads || 0) + 1
      try {
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
      } catch (error) {
        logSecurityEvent("METADATA_WRITE_ERROR", { error: String(error) })
      }
    }

    const content = fs.readFileSync(filePath)

    logSecurityEvent("HUD_DOWNLOADED", {
      filename: sanitizedName,
      downloads: idx >= 0 ? metadata[idx].downloads : 0,
    })

    const response = new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${sanitizedName}"`,
        ...getSecurityHeaders(),
      },
    })

    return response
  } catch (error) {
    logSecurityEvent("GET_HUD_ERROR", { error: String(error) })
    return new NextResponse("Error interno del servidor", { status: 500 })
  }
}
