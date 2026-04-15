import { type NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs"
import { getSession } from "@/lib/auth"
import { sanitizeFilename, logSecurityEvent, getSecurityHeaders } from "@/lib/security"

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const name = searchParams.get("name")

    if (!name) {
      return NextResponse.json({ error: "Nombre de archivo requerido" }, { status: 400 })
    }

    const decodedName = decodeURIComponent(name)
    const sanitizedName = sanitizeFilename(decodedName)

    if (!sanitizedName || !sanitizedName.endsWith(".zip")) {
      logSecurityEvent("HUD_DELETE_REJECTED", {
        userId: session.user.id,
        reason: "invalid_filename",
        originalName: name,
      })
      return NextResponse.json({ error: "Archivo inválido" }, { status: 400 })
    }

    const hudsDir = path.join(process.cwd(), "public", "huds")
    const filePath = path.join(hudsDir, sanitizedName)

    if (!filePath.startsWith(hudsDir)) {
      logSecurityEvent("PATH_TRAVERSAL_ATTEMPT", {
        userId: session.user.id,
        requestedFile: name,
      })
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const metadataPath = path.join(hudsDir, "metadata.json")
    let metadata: any[] = []

    try {
      if (fs.existsSync(metadataPath)) {
        metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"))
      }
    } catch (error) {
      logSecurityEvent("METADATA_READ_ERROR", { error: String(error) })
      return NextResponse.json({ error: "Error al leer metadata" }, { status: 500 })
    }

    const hudIndex = metadata.findIndex((m: any) => m.name === sanitizedName)
    if (hudIndex === -1) {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 })
    }

    const hud = metadata[hudIndex]

    const isAdmin = session.user.isAdmin || session.user.username === "operador"
    if (hud.userId !== session.user.id && !isAdmin) {
      logSecurityEvent("HUD_DELETE_REJECTED", {
        userId: session.user.id,
        reason: "unauthorized",
        filename: sanitizedName,
        ownerId: hud.userId,
      })
      return NextResponse.json({ error: "No tienes permiso para eliminar este archivo" }, { status: 403 })
    }

    // Delete the zip file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    // Delete the preview image
    if (hud.previewImage) {
      const previewPath = path.join(process.cwd(), "public", hud.previewImage)
      if (fs.existsSync(previewPath)) {
        fs.unlinkSync(previewPath)
      }
    }

    // Update metadata
    metadata.splice(hudIndex, 1)
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))

    logSecurityEvent("HUD_DELETE_SUCCESS", {
      userId: session.user.id,
      filename: sanitizedName,
      isAdmin,
    })

    const response = NextResponse.json({ success: true })
    const headers = getSecurityHeaders()
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (err) {
    console.error("[delete-hud] Error:", err)
    logSecurityEvent("HUD_DELETE_ERROR", { error: String(err) })
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
