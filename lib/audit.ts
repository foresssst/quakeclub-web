/**
 * Sistema de auditoría centralizado para QuakeClub
 * Registra todas las acciones relevantes en la tabla AuditLog
 *
 * IMPORTANTE: Nunca debe romper la aplicación. Todos los errores se capturan internamente.
 */

import { prisma } from './prisma'
import type { AuditCategory, ActorType, AuditStatus } from '@prisma/client'
import type { Session } from './auth'

// Parámetros para crear un registro de auditoría
export interface AuditLogParams {
  category: AuditCategory
  action: string
  actorType?: ActorType
  actorId?: string | null
  actorName?: string | null
  actorIp?: string | null
  targetType?: string | null
  targetId?: string | null
  targetName?: string | null
  details?: Record<string, unknown> | null
  status?: AuditStatus
  method?: string | null
  path?: string | null
  userAgent?: string | null
  duration?: number | null
}

/**
 * Extrae la IP del cliente desde los headers de la request
 */
function extractIp(request: Request | null | undefined): string | null {
  if (!request) return null
  try {
    const forwarded = request.headers.get('x-forwarded-for')
    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }
    const realIp = request.headers.get('x-real-ip')
    if (realIp) return realIp
    return null
  } catch {
    return null
  }
}

/**
 * Extrae method y path desde la request
 */
function extractRequestInfo(request: Request | null | undefined): { method: string | null; path: string | null; userAgent: string | null } {
  if (!request) return { method: null, path: null, userAgent: null }
  try {
    const url = new URL(request.url)
    return {
      method: request.method || null,
      path: url.pathname || null,
      userAgent: request.headers.get('user-agent'),
    }
  } catch {
    return { method: null, path: null, userAgent: null }
  }
}

/**
 * Registra una acción en el log de auditoría.
 *
 * Auto-extrae del session: actorId, actorName, actorType
 * Auto-extrae del request: actorIp, method, path, userAgent
 *
 * NUNCA lanza excepciones - los errores se loguean a consola.
 *
 * @example
 * await logAudit({
 *   category: 'ADMIN',
 *   action: 'BAN_PLAYER',
 *   targetType: 'player',
 *   targetId: steamId,
 *   targetName: playerName,
 *   details: { reason: 'Cheating', duration: '7d' }
 * }, session, request)
 */
export async function logAudit(
  params: AuditLogParams,
  session?: Session | null,
  request?: Request | null
): Promise<void> {
  try {
    const ip = params.actorIp ?? extractIp(request)
    const reqInfo = extractRequestInfo(request)

    // Determinar actor desde session si no se proporcionó explícitamente
    let actorType = params.actorType ?? 'ANONYMOUS' as ActorType
    let actorId = params.actorId ?? null
    let actorName = params.actorName ?? null

    if (session?.user) {
      if (!params.actorId) actorId = session.user.steamId || session.user.id
      if (!params.actorName) actorName = session.user.username
      if (!params.actorType) actorType = 'USER'
    }

    await prisma.auditLog.create({
      data: {
        category: params.category,
        action: params.action,
        actorType,
        actorId,
        actorName,
        actorIp: ip,
        targetType: params.targetType ?? null,
        targetId: params.targetId ?? null,
        targetName: params.targetName ?? null,
        details: params.details ?? undefined,
        status: params.status ?? 'SUCCESS',
        method: params.method ?? reqInfo.method,
        path: params.path ?? reqInfo.path,
        userAgent: params.userAgent ?? reqInfo.userAgent,
        duration: params.duration ?? null,
      },
    })
  } catch (error) {
    console.error('[AUDIT] Error al registrar auditoría:', error)
  }
}

/**
 * Variante fire-and-forget de logAudit.
 * No espera a que la escritura termine - útil para flujos de match processing
 * donde no queremos agregar latencia.
 */
export function logAuditAsync(
  params: AuditLogParams,
  session?: Session | null,
  request?: Request | null
): void {
  logAudit(params, session, request).catch(() => {
    // Error ya logueado dentro de logAudit
  })
}
