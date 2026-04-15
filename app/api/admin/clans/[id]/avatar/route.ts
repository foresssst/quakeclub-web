import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

interface Params {
  params: Promise<{ id: string }>
}

// POST: Subir avatar del clan (solo admin)
export async function POST(request: NextRequest, context: Params) {
  try {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id: clanId } = await context.params

    // Verificar que el clan existe
    const clan = await prisma.clan.findUnique({
      where: { id: clanId },
    })

    if (!clan) {
      return NextResponse.json({ error: 'Clan no encontrado' }, { status: 404 })
    }

    // Obtener el archivo del request
    const formData = await request.formData()
    const file = formData.get('avatar') as File

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    }

    // Validar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de archivo no válido. Solo se permiten imágenes (JPG, PNG, GIF, WEBP)' },
        { status: 400 }
      )
    }

    // Validar tamaño (10MB max)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'El archivo es demasiado grande. Máximo 10MB' },
        { status: 400 }
      )
    }

    // Crear directorio si no existe
    const uploadsDir = path.join(process.cwd(), 'public', 'clans-avatars')
    try {
      await mkdir(uploadsDir, { recursive: true })
    } catch (error) {
      // Directory already exists, that's fine
    }

    // Generar nombre de archivo único
    const ext = path.extname(file.name)
    const fileName = `${clan.tag.toLowerCase()}_${Date.now()}${ext}`
    const filePath = path.join(uploadsDir, fileName)

    // Guardar archivo
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Actualizar URL en la base de datos
    const avatarUrl = `/clans-avatars/${fileName}`
    await prisma.clan.update({
      where: { id: clanId },
      data: { avatarUrl },
    })

    return NextResponse.json({
      success: true,
      avatarUrl,
      message: 'Avatar actualizado correctamente',
    })
  } catch (error) {
    console.error('Error uploading avatar:', error)
    return NextResponse.json(
      { error: 'Error al subir el avatar' },
      { status: 500 }
    )
  }
}

// DELETE: Eliminar avatar del clan (solo admin)
export async function DELETE(request: NextRequest, context: Params) {
  try {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id: clanId } = await context.params

    // Actualizar clan para quitar avatar
    await prisma.clan.update({
      where: { id: clanId },
      data: { avatarUrl: null },
    })

    return NextResponse.json({
      success: true,
      message: 'Avatar eliminado correctamente',
    })
  } catch (error) {
    console.error('Error deleting avatar:', error)
    return NextResponse.json(
      { error: 'Error al eliminar el avatar' },
      { status: 500 }
    )
  }
}
