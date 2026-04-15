import { buildMetadata } from "@/lib/seo"

export const metadata = buildMetadata({
  title: "Ladder",
  description:
    "Sigue el ladder competitivo de Quake Live en Chile con temporadas activas, clasificación, estadísticas de rendimiento e historial de partidas.",
  path: "/ladder",
  keywords: ["ladder", "temporadas", "clasificacion", "ranked quake live"],
})

export default function LadderLayout({ children }: { children: React.ReactNode }) {
  return children
}
