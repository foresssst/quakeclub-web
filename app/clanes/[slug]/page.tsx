import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import ClanPageContent from "@/components/clan-page-content"
import { buildMetadata, resolveSeoImage } from "@/lib/seo"

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params

  const clan = await prisma.clan.findFirst({
    where: { slug },
    select: { name: true, tag: true, description: true, bannerUrl: true },
  })

  if (!clan) {
    return {
      title: "Clan no encontrado",
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const title = `[${clan.tag}] ${clan.name}`
  const description =
    clan.description || `Perfil del clan ${clan.name} en QuakeClub. Revisa plantilla, identidad competitiva, rankings y desempeño del equipo.`

  return buildMetadata({
    title,
    description,
    path: `/clanes/${slug}`,
    type: "website",
    image: clan.bannerUrl ? resolveSeoImage({ url: clan.bannerUrl, alt: title }) : null,
    keywords: ["clan", "equipo", clan.tag, clan.name.toLowerCase(), "quake live"],
  })
}

export default function ClanDetailPage() {
  return (
    <div className="relative min-h-screen">
      <div className="container mx-auto max-w-[1100px] px-3 pb-16 pt-8 sm:px-4 sm:pt-12">
        <ClanPageContent />
      </div>
    </div>
  )
}
