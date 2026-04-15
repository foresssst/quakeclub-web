import { buildMetadata } from "@/lib/seo"

export const metadata = buildMetadata({
  title: "Noticias",
  description:
    "Lee las últimas noticias de Quake Club y la escena de Quake Live en Chile: torneos, eventos, anuncios oficiales y novedades de la comunidad.",
  path: "/noticias",
  keywords: ["noticias", "actualizaciones", "eventos", "torneos quake live"],
})

export default function NoticiasLayout({ children }: { children: React.ReactNode }) {
  return children
}
