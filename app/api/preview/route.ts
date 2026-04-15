import { type NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs"
import { sanitizeFilename } from "@/lib/security"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type")
    const name = searchParams.get("name")

    if (!type || !name || (type !== 'config' && type !== 'hud')) {
      return new NextResponse("Parámetros inválidos", { status: 400 })
    }

    // Name comes like "myconfig.png"
    const sanitizedName = sanitizeFilename(name)
    const dir = path.join(process.cwd(), "public", type === 'config' ? 'configs' : 'huds', "previews")
    const filePath = path.join(dir, sanitizedName)

    if (!filePath.startsWith(dir)) {
      return new NextResponse("Acceso denegado", { status: 403 })
    }

    if (!fs.existsSync(filePath)) {
      return new NextResponse("No encontrado", { status: 404 })
    }

    const buffer = fs.readFileSync(filePath)
    
    const ext = path.extname(sanitizedName).toLowerCase()
    let contentType = "image/png"
    if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg"
    if (ext === ".gif") contentType = "image/gif"
    if (ext === ".webp") contentType = "image/webp"

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=60",
      },
    })
  } catch (error) {
    return new NextResponse("Error interno", { status: 500 })
  }
}
