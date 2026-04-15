import type { Metadata } from "next"
import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ProfileContent } from "@/components/profile-content"
import { prisma } from "@/lib/prisma"
import { buildMetadata, resolveSeoImage } from "@/lib/seo"

interface PageProps {
  params: Promise<{ steamId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { steamId } = await params

  const player = await prisma.player.findUnique({
    where: { steamId },
    select: { username: true, banner: true },
  })

  if (!player) {
    return {
      title: "Jugador no encontrado",
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const playerName = player.username || `Player_${steamId.slice(-6)}`
  const title = `${playerName} - Perfil`
  const description = `Perfil de ${playerName} en QuakeClub. Estadísticas, rankings ELO, historial de partidas y rendimiento competitivo.`

  return buildMetadata({
    title,
    description,
    path: `/perfil/${steamId}`,
    type: "profile",
    image: player.banner ? resolveSeoImage({ url: player.banner, alt: playerName }) : null,
    keywords: [playerName.toLowerCase(), "perfil jugador", "estadisticas quake live"],
    noIndex: true,
  })
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { steamId } = await params
  const session = await getSession()

  // Requiere login para ver perfiles
  if (!session?.user) {
    redirect(`/login?redirect=/perfil/${steamId}`)
  }

  const isOwnProfile = session.user.steamId === steamId

  const user = {
    id: steamId,
    steamId: steamId,
    username: `Player_${steamId.slice(-6)}`,
    avatar: undefined,
  }

  return (
    <div className="relative min-h-screen">
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <ProfileContent user={user} isOwnProfile={isOwnProfile} isLoggedIn={true} />
      </div>
    </div>
  )
}
