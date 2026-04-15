import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import fs from "fs"
import path from "path"
import { sanitizeFilename, isPathSafe, safeJsonParse, logSecurityEvent } from "@/lib/security"

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const formData = await req.formData()
    const configNameRaw = formData.get("configName") as string
    const preview = formData.get("preview") as File

    if (!configNameRaw || !preview) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 })
    }

    // Sanitizar el nombre del config para prevenir path traversal
    const configName = sanitizeFilename(configNameRaw)
    if (!configName || configName !== configNameRaw) {
      logSecurityEvent("PATH_TRAVERSAL_ATTEMPT", {
        endpoint: "update-config-preview",
        originalName: configNameRaw,
        sanitizedName: configName,
      })
      return NextResponse.json({ error: "Nombre de archivo inválido" }, { status: 400 })
    }

    if (!preview.type.includes("image/png") && !preview.type.includes("image/jpeg") && !preview.type.includes("image/jpg")) {
      console.log("[update-config-preview] Invalid preview type:", preview.type)
      return NextResponse.json({ error: "Imagen de vista previa inválida (solo PNG, JPG o JPEG)" }, { status: 400 })
    }

    const dir = path.join(process.cwd(), "public", "configs")
    const previewsDir = path.join(dir, "previews")
    const metadataPath = path.join(dir, "metadata.json")

    // Leer metadata con protección
    let metadata: any[] = []
    try {
      if (fs.existsSync(metadataPath)) {
        const data = fs.readFileSync(metadataPath, "utf8")
        metadata = safeJsonParse(data, [])
      }
    } catch (err) {
      console.error("[update-config-preview] Error reading metadata:", err)
      logSecurityEvent("METADATA_READ_ERROR", { endpoint: "update-config-preview", error: String(err) })
      metadata = []
    }

    // Buscar la config en metadata
    const configIndex = metadata.findIndex((m: any) => m.name === configName)
    if (configIndex === -1) {
      return NextResponse.json({ error: "Config no encontrada" }, { status: 404 })
    }

    const config = metadata[configIndex]

    // Verificar que el usuario sea el dueño o admin
    const isAdmin = session.user.isAdmin || session.user.username === "operador"
    if (config.userId !== session.user.id && !isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    // Guardar nueva imagen de preview
    const previewBuffer = Buffer.from(await preview.arrayBuffer())
    const previewExt = (preview.name.split(".").pop() || "png").toLowerCase()
    const previewFileName = `${configName.replace(".cfg", "")}.${previewExt}`
    const previewPath = path.join(previewsDir, previewFileName)

    // Validar que el path esté dentro del directorio permitido
    if (!isPathSafe(previewsDir, previewPath)) {
      logSecurityEvent("PATH_TRAVERSAL_ATTEMPT", {
        endpoint: "update-config-preview",
        attemptedPath: previewPath,
      })
      return NextResponse.json({ error: "Nombre de archivo inválido" }, { status: 400 })
    }

    // Eliminar preview anterior si existe y tiene diferente extensión
    const oldPreviewImage = config.previewImage
    if (oldPreviewImage) {
      const oldPreviewPath = path.join(process.cwd(), "public", oldPreviewImage)
      if (fs.existsSync(oldPreviewPath) && oldPreviewPath !== previewPath) {
        fs.unlinkSync(oldPreviewPath)
      }
    }

    fs.writeFileSync(previewPath, previewBuffer)

    // Actualizar metadata
    metadata[configIndex].previewImage = `/configs/previews/${previewFileName}`
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))

    return NextResponse.json({ 
      success: true, 
      previewImage: `/configs/previews/${previewFileName}` 
    })
  } catch (err) {
    console.error("[update-config-preview] Error:", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
