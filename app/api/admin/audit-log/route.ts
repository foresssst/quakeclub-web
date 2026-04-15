/**
 * API de Auditoría - QuakeClub
 *
 * GET /api/admin/audit-log - Obtener registros de auditoría con filtros y paginación
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import type { AuditCategory, AuditStatus, Prisma } from '@prisma/client'

const VALID_CATEGORIES: AuditCategory[] = [
  'AUTH', 'ADMIN', 'PLAYER', 'CLAN', 'TOURNAMENT', 'MATCH', 'RATING', 'SERVER', 'CONTENT', 'SYSTEM'
]

const VALID_STATUSES: AuditStatus[] = ['SUCCESS', 'FAILURE', 'ERROR']

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)

    // Paginación
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const requestedLimit = parseInt(searchParams.get('limit') || '50')
    const limit = Math.min(Math.max(1, requestedLimit), 200)
    const skip = (page - 1) * limit

    // Filtros
    const category = searchParams.get('category') as AuditCategory | null
    const status = searchParams.get('status') as AuditStatus | null
    const action = searchParams.get('action')
    const actorId = searchParams.get('actorId')
    const targetType = searchParams.get('targetType')
    const targetId = searchParams.get('targetId')
    const search = searchParams.get('search')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    // Construir where
    const where: Prisma.AuditLogWhereInput = {}

    if (category && VALID_CATEGORIES.includes(category)) {
      where.category = category
    }

    if (status && VALID_STATUSES.includes(status)) {
      where.status = status
    }

    if (action) {
      where.action = { contains: action, mode: 'insensitive' }
    }

    if (actorId) {
      where.actorId = actorId
    }

    if (targetType) {
      where.targetType = targetType
    }

    if (targetId) {
      where.targetId = targetId
    }

    if (from || to) {
      where.createdAt = {}
      if (from) {
        const fromDate = new Date(from)
        if (!isNaN(fromDate.getTime())) {
          where.createdAt.gte = fromDate
        }
      }
      if (to) {
        const toDate = new Date(to)
        if (!isNaN(toDate.getTime())) {
          // Incluir todo el día "to"
          toDate.setHours(23, 59, 59, 999)
          where.createdAt.lte = toDate
        }
      }
    }

    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { actorName: { contains: search, mode: 'insensitive' } },
        { targetName: { contains: search, mode: 'insensitive' } },
        { actorId: { contains: search, mode: 'insensitive' } },
        { targetId: { contains: search, mode: 'insensitive' } },
        { path: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json(
      { error: 'Error al obtener registros de auditoría' },
      { status: 500 }
    )
  }
}
