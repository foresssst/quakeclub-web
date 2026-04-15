import { buildMetadata } from "@/lib/seo"

export const metadata = buildMetadata({
  title: "Academia",
  description:
    "Guías, tutoriales, fundamentos y estrategias para subir tu nivel competitivo en Quake Club.",
  path: "/academia",
  keywords: ["academia", "guias quake live", "tutoriales quake"],
})

export default function AcademiaLayout({ children }: { children: React.ReactNode }) {
  return children
}
