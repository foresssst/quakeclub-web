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

    // Decodificar el nombre del archivo
    const decodedName = decodeURIComponent(name)
    const sanitizedName = sanitizeFilename(decodedName)

    if (!sanitizedName || !sanitizedName.endsWith(".cfg")) {
      logSecurityEvent("DELETE_REJECTED", {
        userId: session.user.id,
        reason: "invalid_filename",
        originalName: name,
      })
      return NextResponse.json({ error: "Archivo inválido" }, { status: 400 })
    }

    const configsDir = path.join(process.cwd(), "public", "configs")
    const filePath = path.join(configsDir, sanitizedName)

    if (!filePath.startsWith(configsDir)) {
      logSecurityEvent("PATH_TRAVERSAL_ATTEMPT", {
        userId: session.user.id,
        requestedFile: name,
      })
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const metadataPath = path.join(configsDir, "metadata.json")
    let metadata: any[] = []

    try {
      if (fs.existsSync(metadataPath)) {
        metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"))
      }
    } catch (error) {
      logSecurityEvent("METADATA_READ_ERROR", { error: String(error) })
      return NextResponse.json({ error: "Error al leer metadata" }, { status: 500 })
    }

    const configIndex = metadata.findIndex((m: any) => m.name === sanitizedName)
    if (configIndex === -1) {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 })
    }

    const config = metadata[configIndex]

    // Unificado: verificar tanto isAdmin como username "operador" para consistencia
    const isAdmin = session.user.isAdmin || session.user.username === "operador"
    if (config.userId !== session.user.id && !isAdmin) {
      logSecurityEvent("DELETE_REJECTED", {
        userId: session.user.id,
        reason: "unauthorized",
        filename: sanitizedName,
        ownerId: config.userId,
      })
      return NextResponse.json({ error: "No tienes permiso para eliminar este archivo" }, { status: 403 })
    }

    // Delete file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    // Update metadata
    metadata.splice(configIndex, 1)
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))

    logSecurityEvent("DELETE_SUCCESS", {
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
    console.error("[delete-config] Error:", err)
    logSecurityEvent("DELETE_ERROR", { error: String(err) })
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
