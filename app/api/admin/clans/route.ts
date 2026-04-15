import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { computeClanEloFromMembers, buildRatingFilter } from "@/lib/clan-elo"


export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
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
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    const formattedClans = clans.map((clan) => {
      const eloResult = computeClanEloFromMembers(clan.ClanMember, null)
      return {
        id: clan.id,
        name: clan.name,
        tag: clan.tag,
        slug: clan.slug,
        inGameTag: clan.inGameTag,
        avatarUrl: clan.avatarUrl,
        elo: eloResult.averageElo,
        createdAt: clan.createdAt.toISOString(),
        memberCount: clan.ClanMember.length,
      }
    })

    return NextResponse.json({ clans: formattedClans })
  } catch (error) {
    console.error("Error fetching clans:", error)
    return NextResponse.json({ error: "Error fetching clans", details: String(error) }, { status: 500 })
  } finally {
    
  }
}
