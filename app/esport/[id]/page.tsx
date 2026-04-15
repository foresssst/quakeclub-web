import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import TournamentPageContent from "@/components/tournament-page-content"
import { buildMetadata, resolveSeoImage } from "@/lib/seo"

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params

  const tournament = await prisma.tournament.findFirst({
    where: {
      OR: [
        { id },
        { slug: id },
      ],
    },
    select: { name: true, description: true, gameType: true, status: true, imageUrl: true },
  })

  if (!tournament) {
    return {
      title: "Torneo no encontrado",
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const statusMap: Record<string, string> = {
    UPCOMING: "Próximamente",
    REGISTRATION_OPEN: "Inscripciones abiertas",
    IN_PROGRESS: "En curso",
    COMPLETED: "Finalizado",
  }

  const status = statusMap[tournament.status] || tournament.status
  const title = tournament.name
  const description =
    tournament.description || `Torneo de ${tournament.gameType} en QuakeClub. ${status}, brackets, equipos, resultados y seguimiento competitivo.`

  return buildMetadata({
    title,
    description,
    path: `/esport/${id}`,
    type: "website",
    image: tournament.imageUrl ? resolveSeoImage({ url: tournament.imageUrl, alt: title }) : null,
    keywords: ["torneo", tournament.gameType.toLowerCase(), status.toLowerCase(), "quake live esports"],
  })
}

export default function TournamentPage({ params }: PageProps) {
  return <TournamentPageContent params={params} />
}
