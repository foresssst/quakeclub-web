import { buildMetadata } from "@/lib/seo"

export const metadata = buildMetadata({
  title: "Clanes",
  description:
    "Explora los clanes de Quake Club. Revisa equipos activos, rankings, perfiles de clan, plantillas e identidad competitiva.",
  path: "/clanes",
  keywords: ["clanes", "equipos", "clan arena", "reclutamiento"],
})

export default function ClanesLayout({ children }: { children: React.ReactNode }) {
  return children
}
