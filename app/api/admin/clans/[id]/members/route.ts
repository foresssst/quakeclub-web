import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { calculateClanAverageElo } from '@/lib/clan-elo'

interface Params {
  params: Promise<{ id: string }>
}

// POST: Agregar miembro al clan (solo admin) - Agrega directamente sin invitación
export async function POST(request: NextRequest, context: Params) {
  try {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id: clanId } = await context.params
    const body = await request.json()
    const { steamId, role = 'MEMBER' } = body

    if (!steamId) {
      return NextResponse.json(
        { error: 'Steam ID requerido' },
        { status: 400 }
      )
    }

    // Validar rol
    if (!['FOUNDER', 'ADMIN', 'MEMBER'].includes(role)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    }

    // Buscar clan
    const clan = await prisma.clan.findUnique({
      where: { id: clanId },
    })

    if (!clan) {
      return NextResponse.json({ error: 'Clan no encontrado' }, { status: 404 })
    }

    // Buscar jugador
    const player = await prisma.player.findUnique({
      where: { steamId },
    })

    if (!player) {
      return NextResponse.json(
        { error: 'Jugador no encontrado' },
        { status: 404 }
      )
    }

    // Verificar que el jugador no esté ya en un clan
    const existingMembership = await prisma.clanMember.findFirst({
      where: { playerId: player.id },
    })

    if (existingMembership) {
      return NextResponse.json(
        { error: 'El jugador ya pertenece a un clan' },
        { status: 400 }
      )
    }

    // Si se está asignando como FOUNDER, verificar que el clan no tenga ya un fundador
    if (role === 'FOUNDER') {
      const existingFounder = await prisma.clanMember.findFirst({
        where: {
          clanId: clan.id,
          role: 'FOUNDER',
        },
      })

      if (existingFounder) {
        return NextResponse.json(
          { error: 'El clan ya tiene un fundador. Primero cambia el rol del fundador actual.' },
          { status: 400 }
        )
      }
    }

    // Crear membresía y actualizar founderId si es FOUNDER
    const memberId = `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    if (role === 'FOUNDER') {
      await prisma.$transaction([
        prisma.clanMember.create({
          data: {
            id: memberId,
            clanId: clan.id,
            playerId: player.id,
            steamId: player.steamId,
            role: 'FOUNDER',
          },
        }),
        prisma.clan.update({
          where: { id: clan.id },
          data: { founderId: player.id },
        }),
      ])
      // Recalcular ELO con la función centralizada
      const eloResult = await calculateClanAverageElo(clan.id)
      await prisma.clan.update({ where: { id: clan.id }, data: { averageElo: eloResult.averageElo, totalGames: eloResult.totalGames, totalWins: eloResult.totalWins, updatedAt: new Date() } })
    } else {
      await prisma.clanMember.create({
        data: {
          id: memberId,
          clanId: clan.id,
          playerId: player.id,
          steamId: player.steamId,
          role,
        },
      })
      // Recalcular ELO con la función centralizada
      const eloResult = await calculateClanAverageElo(clan.id)
      await prisma.clan.update({ where: { id: clan.id }, data: { averageElo: eloResult.averageElo, totalGames: eloResult.totalGames, totalWins: eloResult.totalWins, updatedAt: new Date() } })
    }

    return NextResponse.json({
      success: true,
      message: `${player.username} agregado como ${role}`,
    })
  } catch (error) {
    console.error('Error adding member:', error)
    return NextResponse.json(
      { error: 'Error al agregar miembro' },
      { status: 500 }
    )
  }
}

// PATCH: Cambiar rol de un miembro (solo admin)
export async function PATCH(request: NextRequest, context: Params) {
  try {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id: clanId } = await context.params
    const body = await request.json()
    const { memberId, newRole } = body

    if (!memberId || !newRole) {
      return NextResponse.json(
        { error: 'memberId y newRole son requeridos' },
        { status: 400 }
      )
    }

    // Validar rol
    if (!['FOUNDER', 'ADMIN', 'MEMBER'].includes(newRole)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    }

    // Buscar miembro
    const member = await prisma.clanMember.findUnique({
      where: { id: memberId },
      include: { Clan: true, Player: true },
    })

    if (!member || member.clanId !== clanId) {
      return NextResponse.json(
        { error: 'Miembro no encontrado' },
        { status: 404 }
      )
    }

    // Si se está cambiando a FOUNDER
    if (newRole === 'FOUNDER') {
      // Verificar que no haya otro FOUNDER
      const existingFounder = await prisma.clanMember.findFirst({
        where: {
          clanId: clanId,
          role: 'FOUNDER',
          NOT: { id: memberId },
        },
      })

      if (existingFounder) {
        return NextResponse.json(
          { error: 'El clan ya tiene un fundador. Primero cambia el rol del fundador actual.' },
          { status: 400 }
        )
      }

      // Actualizar miembro y founderId del clan
      await prisma.$transaction([
        prisma.clanMember.update({
          where: { id: memberId },
          data: { role: 'FOUNDER' },
        }),
        prisma.clan.update({
          where: { id: clanId },
          data: { founderId: member.Player.id },
        }),
      ])
    } else {
      // Si el miembro actual es FOUNDER y se le está quitando el rol
      if (member.role === 'FOUNDER') {
        // Buscar otro miembro para asignar como fundador (prioridad: ADMIN > MEMBER)
        const nextFounder = await prisma.clanMember.findFirst({
          where: {
            clanId: clanId,
            NOT: { id: memberId },
          },
          orderBy: {
            role: 'asc', // ADMIN viene antes que MEMBER alfabéticamente
          },
        })

        if (!nextFounder) {
          return NextResponse.json(
            { error: 'No se puede cambiar el rol del fundador. Debe haber al menos otro miembro en el clan para transferir el rol.' },
            { status: 400 }
          )
        }

        // Transferir fundador al siguiente miembro y cambiar rol del actual
        await prisma.$transaction([
          prisma.clanMember.update({
            where: { id: memberId },
            data: { role: newRole },
          }),
          prisma.clanMember.update({
            where: { id: nextFounder.id },
            data: { role: 'FOUNDER' },
          }),
          prisma.clan.update({
            where: { id: clanId },
            data: { founderId: nextFounder.playerId },
          }),
        ])
      } else {
        // Cambio de rol normal
        await prisma.clanMember.update({
          where: { id: memberId },
          data: { role: newRole },
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Rol cambiado a ${newRole}`,
    })
  } catch (error) {
    console.error('Error updating member role:', error)
    return NextResponse.json(
      { error: 'Error al cambiar rol' },
      { status: 500 }
    )
  }
}

// DELETE: Eliminar miembro del clan (solo admin)
export async function DELETE(request: NextRequest, context: Params) {
  try {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id: clanId } = await context.params
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return NextResponse.json(
        { error: 'memberId requerido' },
        { status: 400 }
      )
    }

    // Buscar miembro
    const member = await prisma.clanMember.findUnique({
      where: { id: memberId },
    })

    if (!member || member.clanId !== clanId) {
      return NextResponse.json(
        { error: 'Miembro no encontrado' },
        { status: 404 }
      )
    }

    // Prevenir eliminar al fundador si es el único miembro
    if (member.role === 'FOUNDER') {
      const memberCount = await prisma.clanMember.count({
        where: { clanId: clanId },
      })

      if (memberCount > 1) {
        return NextResponse.json(
          { error: 'No puedes eliminar al fundador mientras haya otros miembros. Primero transfiere el rol de fundador.' },
          { status: 400 }
        )
      }
    }

    // Si es el fundador y es el único miembro, eliminar el clan completo
    if (member.role === 'FOUNDER') {
      // El fundador solo puede ser eliminado si es el único miembro (validado arriba)
      // En ese caso, eliminamos el clan completo
      await prisma.clan.delete({
        where: { id: clanId },
      })

      return NextResponse.json({
        success: true,
        message: 'Clan eliminado (era el único miembro)',
      })
    }

    // Eliminar miembro y recalcular ELO
    await prisma.clanMember.delete({ where: { id: memberId } })
    const eloResult = await calculateClanAverageElo(clanId)
    await prisma.clan.update({ where: { id: clanId }, data: { averageElo: eloResult.averageElo, totalGames: eloResult.totalGames, totalWins: eloResult.totalWins, updatedAt: new Date() } })

    return NextResponse.json({
      success: true,
      message: 'Miembro eliminado',
    })
  } catch (error) {
    console.error('Error removing member:', error)
    return NextResponse.json(
      { error: 'Error al eliminar miembro' },
      { status: 500 }
    )
  }
}
