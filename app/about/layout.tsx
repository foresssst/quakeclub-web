import { buildMetadata } from "@/lib/seo"

export const metadata = buildMetadata({
  title: "Acerca de",
  description:
    "QuakeClub es la comunidad competitiva de Quake Live en Chile. Conoce quiénes somos, nuestra misión y el equipo detrás del proyecto.",
  path: "/about",
  keywords: ["acerca de", "comunidad quake live", "quakeclub chile"],
})

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children
}
