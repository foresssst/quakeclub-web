import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import fs from 'fs';
import path from 'path';


const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const AVATARS_DIR = path.join(process.cwd(), 'public', 'clans-avatars');

// Asegurar que el directorio existe
if (!fs.existsSync(AVATARS_DIR)) {
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user.steamId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { slug } = await params;

    // Obtener el clan
    const clan = await prisma.clan.findUnique({
      where: { slug },
      include: {
        ClanMember: {
          where: { steamId: session.user.steamId },
        },
      },
    });

    if (!clan) {
      return NextResponse.json({ error: 'Clan no encontrado' }, { status: 404 });
    }

    // Verificar que el usuario sea FOUNDER o ADMIN
    const membership = clan.ClanMember[0];
    if (!membership || (membership.role !== 'FOUNDER' && membership.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'No tienes permisos para cambiar el avatar del clan' },
        { status: 403 }
      );
    }

    // Leer FormData
    const formData = await request.formData();
    const file = formData.get('avatar') as File;

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó ningún archivo' }, { status: 400 });
    }

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Solo se permiten imágenes' }, { status: 400 });
    }

    // Validar tamaño
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `La imagen es demasiado grande. Máximo ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Obtener extensión del archivo
    const ext = file.name.split('.').pop() || 'png';
    const filename = `${clan.tag.toLowerCase()}-${Date.now()}.${ext}`;
    const filepath = path.join(AVATARS_DIR, filename);

    // Guardar el archivo
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filepath, buffer);

    const avatarUrl = `/api/clans-avatars/${filename}`;

    // Borrar el avatar anterior si existe y no es el default
    if (clan.avatarUrl && clan.avatarUrl.startsWith('/api/clans-avatars/')) {
      const oldFilename = clan.avatarUrl.split('/').pop();
      if (oldFilename) {
        const oldFilepath = path.join(AVATARS_DIR, oldFilename);
        if (fs.existsSync(oldFilepath)) {
          fs.unlinkSync(oldFilepath);
        }
      }
    }

    // Actualizar el avatar del clan
    const updatedClan = await prisma.clan.update({
      where: { id: clan.id },
      data: { avatarUrl },
    });

    return NextResponse.json({
      success: true,
      clan: {
        id: updatedClan.id,
        tag: updatedClan.tag,
        avatarUrl: updatedClan.avatarUrl,
      },
    });
  } catch (error) {
    console.error('Error updating clan avatar:', error);
    return NextResponse.json({ error: 'Error al actualizar el avatar' }, { status: 500 });
  }
}
