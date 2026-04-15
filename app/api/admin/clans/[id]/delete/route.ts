import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { logAuditAsync } from '@/lib/audit'

interface Params {
  params: Promise<{ id: string }>
}

// DELETE /api/admin/clans/[id]/delete
// Solo admins pueden eliminar clanes
export async function DELETE(request: NextRequest, context: Params) {
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

    // Eliminar todas las relaciones (las cascadas deberían manejarlo, pero siendo explícito)
    await prisma.$transaction([
      // Eliminar invitaciones
      prisma.clanInvitation.deleteMany({
        where: { clanId: clan.id },
      }),
      // Eliminar solicitudes
      prisma.clanJoinRequest.deleteMany({
        where: { clanId: clan.id },
      }),
      // Eliminar miembros
      prisma.clanMember.deleteMany({
        where: { clanId: clan.id },
      }),
      // Eliminar el clan
      prisma.clan.delete({
        where: { id: clan.id },
      }),
    ])

    logAuditAsync({ category: "ADMIN", action: "DELETE_CLAN", targetType: "clan", targetId: clan.id, targetName: `[${clan.tag}] ${clan.name}` }, session, request)

    return NextResponse.json({
      success: true,
      message: `Clan [${clan.tag}] ${clan.name} eliminado correctamente`
    })
  } catch (error) {
    console.error('Error deleting clan:', error)
    return NextResponse.json(
      { error: 'Error al eliminar el clan' },
      { status: 500 }
    )
  }
}
