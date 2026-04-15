import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { v4 as uuidv4 } from "uuid"
import sharp from "sharp"

const COVER_MAX_WIDTH = 2000
const COVER_MAX_HEIGHT = 500
const COVER_MAX_FILESIZE = 10 * 1024 * 1024 // 10MB

export async function POST(req: NextRequest) {
    try {
        const session = await getSession()

        if (!session?.user?.id) {
            return NextResponse.json({ error: "No autenticado" }, { status: 401 })
        }

        // Verificar que el usuario tenga steamId (usuarios de Steam)
        if (!session.user.steamId) {
            return NextResponse.json({ error: "Esta función solo está disponible para usuarios de Steam" }, { status: 403 })
        }

        const body = await req.json()
        const { coverData, offsetX, offsetY, presetId } = body

        // Si es un preset, solo actualizar el ID
        if (presetId) {
            const preset = await prisma.coverPreset.findUnique({
                where: { id: presetId, active: true },
            })

            if (!preset) {
                return NextResponse.json({ error: "Preset no encontrado" }, { status: 404 })
            }

            await prisma.player.update({
                where: { steamId: session.user.steamId },
                data: {
                    coverPresetId: presetId,
                    banner: null, // Clear custom banner when selecting preset
                    bannerOffsetX: 0,
                    bannerOffsetY: 0,
                },
            })

            return NextResponse.json({
                success: true,
                coverUrl: preset.imageUrl,
                presetId: preset.id,
            })
        }

        // Subir banner personalizado
        if (!coverData) {
            return NextResponse.json({ error: "No se proporcionó imagen" }, { status: 400 })
        }

        // Buscar el player por steamId del usuario en sesión
        const player = await prisma.player.findUnique({
            where: { steamId: session.user.steamId },
        })

        if (!player) {
            return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
        }

        // Detectar tipo de imagen desde base64
        const mimeMatch = coverData.match(/^data:(image\/[a-zA-Z]+);base64,/)
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg'
        const isGif = mimeType === 'image/gif'

        // Decodificar base64
        const base64Data = coverData.replace(/^data:image\/\w+;base64,/, "")
        const buffer = Buffer.from(base64Data, "base64")

        // Validar tamaño
        if (buffer.length > COVER_MAX_FILESIZE) {
            return NextResponse.json(
                { error: `El archivo es demasiado grande. Máximo ${COVER_MAX_FILESIZE / 1024 / 1024}MB` },
                { status: 400 }
            )
        }

        // Procesar imagen con sharp
        let processedBuffer: Buffer
        let fileExtension: string

        try {
            const image = sharp(buffer, { animated: isGif })
            const metadata = await image.metadata()

            // Para GIFs, preservar la animación
            if (isGif) {
                // Solo validar dimensiones pero mantener el formato GIF
                if (metadata.width && metadata.width > COVER_MAX_WIDTH) {
                    processedBuffer = await image
                        .resize(COVER_MAX_WIDTH, null, { fit: "inside" })
                        .gif()
                        .toBuffer()
                } else {
                    // Mantener el GIF original sin modificar
                    processedBuffer = buffer
                }
                fileExtension = 'gif'
            } else {
                // Para otros formatos, convertir a JPEG optimizado
                if (metadata.width && metadata.width > COVER_MAX_WIDTH) {
                    image.resize(COVER_MAX_WIDTH, null, { fit: "inside" })
                }
                if (metadata.height && metadata.height > COVER_MAX_HEIGHT) {
                    image.resize(null, COVER_MAX_HEIGHT, { fit: "inside" })
                }
                processedBuffer = await image.jpeg({ quality: 90 }).toBuffer()
                fileExtension = 'jpg'
            }
        } catch (error) {
            console.error("Error processing image:", error)
            return NextResponse.json({ error: "Error al procesar la imagen" }, { status: 400 })
        }

        // Guardar archivo con la extensión correcta
        const filename = `${uuidv4()}.${fileExtension}`
        const uploadDir = path.join(process.cwd(), "public", "covers")
        const filepath = path.join(uploadDir, filename)

        try {
            await mkdir(uploadDir, { recursive: true })
            await writeFile(filepath, processedBuffer)
        } catch (error) {
            console.error("Error saving file:", error)
            return NextResponse.json({ error: "Error al guardar el archivo" }, { status: 500 })
        }

        const coverUrl = `/api/covers/${filename}`

        // Actualizar base de datos
        await prisma.player.update({
            where: { steamId: session.user.steamId },
            data: {
                banner: coverUrl,
                bannerOffsetX: offsetX || 0,
                bannerOffsetY: offsetY || 0,
                coverPresetId: null, // Clear preset when uploading custom
            },
        })

        return NextResponse.json({
            success: true,
            coverUrl,
            offsetX: offsetX || 0,
            offsetY: offsetY || 0,
        })
    } catch (error) {
        console.error("Error in cover upload:", error)
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const session = await getSession()

        if (!session?.user?.id) {
            return NextResponse.json({ error: "No autenticado" }, { status: 401 })
        }

        if (!session.user.steamId) {
            return NextResponse.json({ error: "Esta función solo está disponible para usuarios de Steam" }, { status: 403 })
        }

        await prisma.player.update({
            where: { steamId: session.user.steamId },
            data: {
                banner: null,
                bannerOffsetX: 0,
                bannerOffsetY: 0,
                coverPresetId: null,
            },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error deleting cover:", error)
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
    }
}

// Actualizar solo el offset del banner
export async function PATCH(req: NextRequest) {
    try {
        const session = await getSession()

        if (!session?.user?.id) {
            return NextResponse.json({ error: "No autenticado" }, { status: 401 })
        }

        if (!session.user.steamId) {
            return NextResponse.json({ error: "Esta función solo está disponible para usuarios de Steam" }, { status: 403 })
        }

        const body = await req.json()
        const { offsetX, offsetY } = body

        await prisma.player.update({
            where: { steamId: session.user.steamId },
            data: {
                bannerOffsetX: offsetX || 0,
                bannerOffsetY: offsetY || 0,
            },
        })

        return NextResponse.json({ success: true, offsetX, offsetY })
    } catch (error) {
        console.error("Error updating cover offset:", error)
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
    }
}
