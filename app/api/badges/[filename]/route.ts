import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"

const BADGES_DIR = path.join(process.cwd(), "public", "badges")

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params

    // Validar que el filename no contenga caracteres peligrosos
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 })
    }

    const filePath = path.join(BADGES_DIR, filename)
    const fileBuffer = await readFile(filePath)

    // Determinar el content-type basado en la extensión
    const ext = path.extname(filename).toLowerCase()
    const contentType = ext === ".webp" ? "image/webp" :
                       ext === ".png" ? "image/png" :
                       ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
                       ext === ".gif" ? "image/gif" :
                       "application/octet-stream"

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (error) {
    console.error("Error serving badge image:", error)
    return NextResponse.json({ error: "Badge not found" }, { status: 404 })
  }
}
