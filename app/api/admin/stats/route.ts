import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAllNews } from "@/lib/news-storage"
import { getSession } from "@/lib/auth"
import { logSecurityEvent } from "@/lib/security"

/**
 * GET /api/admin/stats
 * 
 * Obtiene estadísticas del sistema para el panel de administración.
 * Requiere autenticación y permisos de administrador.
 * 
 * SEGURIDAD: Endpoint protegido - solo accesible por administradores autenticados
 */
export async function GET() {
  try {
    // Verificar autenticación y permisos de administrador
    const session = await getSession()
    
    if (!session || !session.user.isAdmin) {
      logSecurityEvent("UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT", {
        endpoint: "/api/admin/stats",
        userId: session?.user.id || "anonymous",
        username: session?.user.username || "anonymous"
      })
      return NextResponse.json(
        { error: "No autorizado. Se requieren permisos de administrador." },
        { status: 403 }
      )
    }
    
    // Log de acceso autorizado para auditoría
    logSecurityEvent("ADMIN_STATS_ACCESS", {
      userId: session.user.id,
      username: session.user.username
    })
    
    const [totalUsers, totalClans, totalMatches] = await Promise.all([
      // Contar solo usuarios registrados en la web (con privacyLevel definido y no eliminados)
      prisma.player.count({
        where: {
          privacyLevel: { not: null },
          deletedAt: null,
        },
      }),
      prisma.clan.count(),
      prisma.match.count(),
    ])

    // Obtener el conteo de noticias
    const news = getAllNews()
    const totalNews = news.length

    return NextResponse.json({
      totalUsers,
      totalClans,
      totalNews,
      totalMatches,
    })
  } catch (error) {
    console.error("Error fetching admin stats:", error)
    return NextResponse.json({ error: "Error fetching stats" }, { status: 500 })
  }
}
