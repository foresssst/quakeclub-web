import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { getSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
    try {
        const session = await getSession()
        if (!session?.user?.isAdmin) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const formData = await request.formData()
        const file = formData.get('file') as File
        const tournamentId = formData.get('tournamentId') as string

        if (!file) {
            return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
        }

        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        if (!validTypes.includes(file.type)) {
            return NextResponse.json({ error: 'Tipo de archivo no válido. Use JPG, PNG, GIF o WEBP' }, { status: 400 })
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: 'El archivo es muy grande. Máximo 10MB' }, { status: 400 })
        }

        // Create directory if it doesn't exist
        const uploadDir = path.join(process.cwd(), 'public', 'tournaments-images')
        if (!existsSync(uploadDir)) {
            await mkdir(uploadDir, { recursive: true })
        }

        // Generate filename
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const filename = `${tournamentId || 'tournament'}-${Date.now()}.${ext}`
        const filepath = path.join(uploadDir, filename)

        // Write file
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        await writeFile(filepath, buffer)

        // Return the URL path (using API route to serve the file)
        const imageUrl = `/api/tournaments-images/${filename}`

        return NextResponse.json({ 
            success: true, 
            imageUrl 
        })
    } catch (error) {
        console.error('Error uploading tournament image:', error)
        return NextResponse.json({ error: 'Error al subir imagen' }, { status: 500 })
    }
}
