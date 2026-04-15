import { NextResponse } from "next/server"
import path from "path"
import fs from "fs"
import { safeJsonParse, logSecurityEvent, getSecurityHeaders } from "@/lib/security"

export async function GET() {
  try {
    const metadataPath = path.join(process.cwd(), "public", "configs", "metadata.json")
    let metadata = []

    try {
      if (fs.existsSync(metadataPath)) {
        const data = fs.readFileSync(metadataPath, "utf8")
        const parsed = safeJsonParse(data, [])
        metadata = parsed.map((item: any) => {
          if (item.previewImage && item.previewImage.startsWith("/configs/previews/")) {
            const fileName = item.previewImage.split("/").pop()
            item.previewImage = `/api/preview?type=config&name=${fileName}`
          }
          return item
        })
      }
    } catch (error) {
      logSecurityEvent("LIST_CONFIGS_ERROR", { error: String(error) })
      metadata = []
    }

    const response = NextResponse.json({ files: metadata })

    const headers = getSecurityHeaders()
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    logSecurityEvent("LIST_CONFIGS_FATAL_ERROR", { error: String(error) })
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
