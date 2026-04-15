import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    try {
        const { filename } = await params
        const filepath = path.join(process.cwd(), 'public', 'tournaments-images', filename)

        if (!existsSync(filepath)) {
            return NextResponse.json({ error: 'Imagen no encontrada' }, { status: 404 })
        }

        const buffer = await readFile(filepath)
        
        // Determine content type
        const ext = filename.split('.').pop()?.toLowerCase()
        const contentTypes: Record<string, string> = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp'
        }
        const contentType = contentTypes[ext || 'jpg'] || 'image/jpeg'

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable'
            }
        })
    } catch (error) {
        console.error('Error serving tournament image:', error)
        return NextResponse.json({ error: 'Error al cargar imagen' }, { status: 500 })
    }
}
