import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    // Protección contra path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return new NextResponse('Invalid filename', { status: 400 });
    }

    const baseDir = path.resolve(path.join(process.cwd(), 'public', 'clans-avatars'));
    const filepath = path.resolve(path.join(baseDir, filename));

    // Verificar que la ruta resuelta está dentro del directorio base
    if (!filepath.startsWith(baseDir)) {
      return new NextResponse('Invalid filename', { status: 400 });
    }

    // Verificar que el archivo existe
    if (!fs.existsSync(filepath)) {
      return new NextResponse('Archivo no encontrado', { status: 404 });
    }

    // Leer el archivo
    const fileBuffer = fs.readFileSync(filepath);

    // Determinar el tipo MIME basado en la extensión
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
    };

    const contentType = mimeTypes[ext || ''] || 'application/octet-stream';

    // Retornar el archivo con headers apropiados
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving clan avatar:', error);
    return new NextResponse('Error al cargar la imagen', { status: 500 });
  }
}
