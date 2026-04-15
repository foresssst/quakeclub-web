import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    try {
        const { filename } = await params

        // Validar que el filename sea seguro (sin path traversal)
        if (filename.includes('..') || filename.includes('/')) {
            return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
        }

        const filepath = path.join(process.cwd(), 'public', 'covers', filename)

        try {
            const fileBuffer = await readFile(filepath)

            // Determinar el content type basado en la extensión
            const ext = path.extname(filename).toLowerCase()
            let contentType = 'image/jpeg'

            if (ext === '.png') contentType = 'image/png'
            else if (ext === '.webp') contentType = 'image/webp'
            else if (ext === '.gif') contentType = 'image/gif'

            return new NextResponse(fileBuffer, {
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': 'public, max-age=31536000, immutable',
                },
            })
        } catch (error) {
            console.error('Error reading cover file:', error)
            return NextResponse.json({ error: 'File not found' }, { status: 404 })
        }
    } catch (error) {
        console.error('Error serving cover:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
