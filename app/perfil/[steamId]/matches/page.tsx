import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { MatchHistoryContent } from "@/components/match-history-content"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildMetadata } from "@/lib/seo"

interface PageProps {
  params: Promise<{ steamId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  return buildMetadata({
    title: `Historial de Partidas - ${resolvedParams.steamId}`,
    description: `Historial completo de partidas del jugador ${resolvedParams.steamId} en QuakeClub.`,
    path: `/perfil/${resolvedParams.steamId}/matches`,
    keywords: ["historial de partidas", "match history", "quake live"],
    noIndex: true,
  })
}

async function getPlayerData(steamId: string) {
  try {
    const player = await prisma.player.findUnique({
      where: { steamId },
      select: { steamId: true, username: true, avatar: true },
    })
    if (player) return player

    // Fallback: el jugador puede no estar en Player pero sí tener partidas
    const matchStat = await prisma.playerMatchStats.findFirst({
      where: { steamId },
      select: { playerName: true },
      orderBy: { Match: { timestamp: 'desc' } },
    })
    if (matchStat) {
      return { steamId, username: matchStat.playerName || `Player_${steamId}`, avatar: null }
    }

    return null
  } catch (error) {
    console.error("Error fetching player data:", error)
    return null
  }
}

export default async function MatchHistoryPage({ params }: PageProps) {
  const resolvedParams = await params
  const session = await getSession()

  // Requiere login para ver perfiles
  if (!session?.user) {
    redirect(`/login?redirect=/perfil/${resolvedParams.steamId}/matches`)
  }

  const currentUserSteamId = session.user.steamId

  const playerData = await getPlayerData(resolvedParams.steamId)

  if (!playerData) {
    return (
      <div className="relative min-h-screen">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="mx-auto max-w-[1100px] text-center">
            <h1 className="font-tiktok text-2xl font-bold text-foreground mb-4">Jugador no encontrado</h1>
            <p className="text-foreground/50">No se pudo cargar la información del jugador</p>
          </div>
        </div>
      </div>
    )
  }

  const isOwnProfile = currentUserSteamId === resolvedParams.steamId

  return (
    <div className="relative min-h-screen">
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <MatchHistoryContent
          steamId={resolvedParams.steamId}
          username={playerData.username}
          isOwnProfile={isOwnProfile}
        />
      </div>
    </div>
  )
}
