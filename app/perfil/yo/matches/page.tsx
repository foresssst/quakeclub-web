import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { MatchHistoryContent } from "@/components/match-history-content"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = {
  title: "Mi Historial de Partidas | QuakeClub",
  description: "Historial completo de mis partidas en QuakeClub",
}

async function getPlayerData(steamId: string) {
  try {
    const player = await prisma.player.findUnique({
      where: { steamId },
      select: { steamId: true, username: true, avatar: true },
    })
    return player
  } catch (error) {
    console.error("Error fetching player data:", error)
    return null
  }
}

export default async function MyMatchHistoryPage() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get("session")

  if (!sessionCookie) {
    redirect("/login")
  }

  let steamId: string
  try {
    const sessionData = JSON.parse(sessionCookie.value)
    steamId = sessionData.steamId
  } catch (error) {
    console.error("Error parsing session:", error)
    redirect("/login")
  }

  const playerData = await getPlayerData(steamId)

  if (!playerData) {
    return (
      <div className="relative min-h-screen">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="mx-auto max-w-[1100px] text-center">
            <h1 className="font-tiktok text-2xl font-bold text-foreground mb-4">Error al cargar datos</h1>
            <p className="text-foreground/50">No se pudo cargar tu información de jugador</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen">
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <MatchHistoryContent steamId={steamId} username={playerData.username} isOwnProfile={true} />
      </div>
    </div>
  )
}
