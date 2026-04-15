import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { logAuditAsync } from '@/lib/audit'
import { computeClanEloFromMembers } from '@/lib/clan-elo'

interface Params {
  params: Promise<{ id: string }>
}

// GET: Obtener detalles completos de un clan (solo admin)
export async function GET(request: NextRequest, context: Params) {
  try {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await context.params

    const clan = await prisma.clan.findUnique({
      where: { id },
      include: {
        ClanMember: {
          include: {
            Player: {
              select: {
                id: true,
                steamId: true,
                username: true,
                avatar: true,
                PlayerRating: {
                  where: { ratingType: 'public' },
                },
              },
            },
          },
          orderBy: [
            {
              role: 'asc', // FOUNDER first, then ADMIN, then MEMBER
            },
            {
              joinedAt: 'asc',
            },
          ],
        },
        ClanInvitation: {
          where: { status: 'PENDING' },
          include: {
            Player_ClanInvitation_inviteeIdToPlayer: {
              select: {
                steamId: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
        ClanJoinRequest: {
          where: { status: 'PENDING' },
          include: {
            Player: {
              select: {
                steamId: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
      },
    })

    if (!clan) {
      return NextResponse.json({ error: 'Clan no encontrado' }, { status: 404 })
    }

    // Calcular ELO en tiempo real
    const eloResult = computeClanEloFromMembers(clan.ClanMember, null)

    // Format response
    const formattedClan = {
      id: clan.id,
      name: clan.name,
      tag: clan.tag,
      inGameTag: clan.inGameTag,
      description: clan.description,
      avatarUrl: clan.avatarUrl,
      averageElo: eloResult.averageElo,
      founderId: clan.founderId,
      createdAt: clan.createdAt,
      members: clan.ClanMember.map((member) => ({
        id: member.id,
        playerId: member.Player.id,
        steamId: member.Player.steamId,
        username: member.Player.username,
        avatar: member.Player.avatar,
        role: member.role,
        joinedAt: member.joinedAt,
        rating: member.Player.PlayerRating[0]?.rating || 900,
      })),
      pendingInvitations: clan.ClanInvitation.map((inv) => ({
        id: inv.id,
        invitee: inv.Player_ClanInvitation_inviteeIdToPlayer,
        createdAt: inv.createdAt,
      })),
      pendingRequests: clan.ClanJoinRequest.map((req) => ({
        id: req.id,
        player: req.Player,
        message: req.message,
        createdAt: req.createdAt,
      })),
    }

    return NextResponse.json({ clan: formattedClan })
  } catch (error) {
    console.error('Error fetching clan:', error)
    return NextResponse.json(
      { error: 'Error al obtener el clan' },
      { status: 500 }
    )
  }
}

// PATCH: Actualizar información del clan (solo admin)
export async function PATCH(request: NextRequest, context: Params) {
  try {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await context.params
    const body = await request.json()
    const { name, tag, inGameTag, description } = body

    // Validaciones
    if (name !== undefined && (!name || name.trim().length < 1)) {
      return NextResponse.json(
        { error: 'El nombre debe tener al menos 1 carácter' },
        { status: 400 }
      )
    }

    if (tag !== undefined && (!tag || tag.trim().length < 1 || tag.trim().length > 6)) {
      return NextResponse.json(
        { error: 'El tag debe tener entre 1 y 6 caracteres' },
        { status: 400 }
      )
    }

    // Si se cambia el tag, verificar que no exista otro clan con ese tag
    if (tag !== undefined) {
      const existingClan = await prisma.clan.findFirst({
        where: {
          tag: tag.trim().toUpperCase(),
          NOT: { id },
        },
      })

      if (existingClan) {
        return NextResponse.json(
          { error: 'Ya existe un clan con ese tag' },
          { status: 400 }
        )
      }
    }

    // Actualizar clan
    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (tag !== undefined) updateData.tag = tag.trim().toUpperCase()
    if (inGameTag !== undefined) updateData.inGameTag = inGameTag?.trim() || null
    if (description !== undefined) updateData.description = description?.trim() || null

    const updatedClan = await prisma.clan.update({
      where: { id },
      data: updateData,
    })

    logAuditAsync({ category: "ADMIN", action: "UPDATE_CLAN", targetType: "clan", targetId: id, targetName: `[${updatedClan.tag}] ${updatedClan.name}`, details: updateData }, session, request)

    return NextResponse.json({
      success: true,
      clan: updatedClan,
    })
  } catch (error) {
    console.error('Error updating clan:', error)
    return NextResponse.json(
      { error: 'Error al actualizar el clan' },
      { status: 500 }
    )
  }
}

// DELETE: Eliminar clan (solo admin)
export async function DELETE(request: NextRequest, context: Params) {
  try {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await context.params

    // Verificar que el clan existe
    const clan = await prisma.clan.findUnique({
      where: { id },
    })

    if (!clan) {
      return NextResponse.json({ error: 'Clan no encontrado' }, { status: 404 })
    }

    // Eliminar clan (Prisma cascade eliminará miembros, invitaciones, etc.)
    await prisma.clan.delete({
      where: { id },
    })

    logAuditAsync({ category: "ADMIN", action: "DELETE_CLAN", targetType: "clan", targetId: id, targetName: `[${clan.tag}] ${clan.name}` }, session, request)

    return NextResponse.json({
      success: true,
      message: 'Clan eliminado correctamente',
    })
  } catch (error) {
    console.error('Error deleting clan:', error)
    return NextResponse.json(
      { error: 'Error al eliminar el clan' },
      { status: 500 }
    )
  }
}
