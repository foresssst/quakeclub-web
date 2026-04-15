import type { Metadata } from "next"
import { MatchDetailContent } from "@/components/match-detail-content"
import { prisma } from "@/lib/prisma"
import { buildMetadata } from "@/lib/seo"

interface PageProps {
  params: Promise<{ matchId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { matchId } = await params

  const match = await prisma.match.findFirst({
    where: {
      OR: [
        { matchId: matchId },
        { id: matchId },
      ],
    },
    select: {
      gameType: true,
      map: true,
      timestamp: true,
      PlayerMatchStats: {
        select: { playerName: true, score: true },
        orderBy: { score: "desc" },
        take: 2,
      },
    },
  })

  if (!match) {
    return {
      title: "Partida no encontrada",
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const gameType = (match.gameType || "match").toUpperCase()
  const mapName = match.map || "Unknown"
  const players = match.PlayerMatchStats
  const playerNames = players.map(p => p.playerName).join(" vs ")
  const scores = players.map(p => p.score).join(" - ")

  const title = `${gameType} en ${mapName} - ${playerNames}`
  const description = `${gameType} en ${mapName}: ${playerNames} (${scores}). Estadísticas detalladas, armas y más.`

  return buildMetadata({
    title,
    description,
    path: `/match/${matchId}`,
    type: "article",
    publishedTime: match.timestamp?.toISOString?.(),
    keywords: ["match", gameType.toLowerCase(), mapName.toLowerCase(), "estadisticas quake live"],
  })
}

export default async function MatchDetailPage({ params }: PageProps) {
  const { matchId } = await params

  return <MatchDetailContent matchId={matchId} />
}
