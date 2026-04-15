import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { computeClanEloFromMembers, buildRatingFilter } from "@/lib/clan-elo"


// GET /api/clans - Obtener lista de todos los clanes
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const sort = searchParams.get('sort') || 'name'
        const limitParam = searchParams.get('limit')
        // SEGURIDAD: Limitar el máximo a 100 para prevenir DoS
        const parsedLimit = limitParam ? parseInt(limitParam) : 50
        const limit = Math.min(Math.max(1, parsedLimit), 100)

        // Configurar ordenamiento base
        let orderBy: any = { name: 'asc' }
        if (sort === 'members') {
            orderBy = { ClanMember: { _count: 'desc' } }
        }

        const clans = await prisma.clan.findMany({
            include: {
                ClanMember: {
                    include: {
                        Player: {
                            include: {
                                PlayerRating: buildRatingFilter(null)
                            }
                        }
                    }
                },
                _count: {
                    select: {
                        ClanMember: true
                    }
                }
            },
            orderBy: sort !== 'elo' ? orderBy : { name: 'asc' },
        })

        // Calcular ELO en tiempo real y formatear
        let formattedClans = clans.map(clan => {
            const eloResult = computeClanEloFromMembers(clan.ClanMember, null)
            return {
                id: clan.id,
                name: clan.name,
                tag: clan.tag,
                slug: clan.slug,
                avatarUrl: clan.avatarUrl,
                elo: eloResult.averageElo,
                _count: clan._count
            }
        })

        // Ordenar por ELO si es necesario (no se puede hacer en DB porque es calculado)
        if (sort === 'elo') {
            formattedClans.sort((a, b) => b.elo - a.elo)
        }

        formattedClans = formattedClans.slice(0, limit)

        return NextResponse.json({ clans: formattedClans })

    } catch (error) {
        console.error("Error fetching clans:", error)
        return NextResponse.json(
            { error: "Error al obtener clanes" },
            { status: 500 }
        )
    } finally {

    }
}
