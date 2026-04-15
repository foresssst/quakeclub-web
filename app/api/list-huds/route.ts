import { NextResponse } from "next/server"
import path from "path"
import fs from "fs"
import { safeJsonParse, logSecurityEvent, getSecurityHeaders } from "@/lib/security"

export async function GET() {
  try {
    const metadataPath = path.join(process.cwd(), "public", "huds", "metadata.json")
    let metadata = []

    try {
      if (fs.existsSync(metadataPath)) {
        const data = fs.readFileSync(metadataPath, "utf8")
        const parsed = safeJsonParse(data, [])
        // Support both object format {name: {...}} and array format [{name, ...}]
        if (Array.isArray(parsed)) {
          metadata = parsed
        } else if (parsed && typeof parsed === "object") {
          metadata = Object.entries(parsed).map(([name, value]: [string, any]) => ({
            name,
            ...value,
          }))
        }

        // Rescribe rutas de previews generadas dinámicamente
        metadata = metadata.map((item: any) => {
          if (item.previewImage && item.previewImage.startsWith("/huds/previews/")) {
            const fileName = item.previewImage.split("/").pop()
            item.previewImage = `/api/preview?type=hud&name=${fileName}`
          }
          return item
        })
      }
    } catch (error) {
      logSecurityEvent("LIST_HUDS_ERROR", { error: String(error) })
      metadata = []
    }

    const response = NextResponse.json({ files: metadata })

    const headers = getSecurityHeaders()
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    logSecurityEvent("LIST_HUDS_FATAL_ERROR", { error: String(error) })
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
