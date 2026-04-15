import { buildMetadata } from "@/lib/seo"

export const metadata = buildMetadata({
  title: "Esports",
  description:
    "Sigue de cerca todos los torneos de Quake Live en Chile en Quake Club. Encuentra inscripciones abiertas, brackets, equipos, calendario y resultados.",
  path: "/esport",
  keywords: ["esports", "torneos quake live", "brackets", "competitivo"],
})

export default function EsportLayout({ children }: { children: React.ReactNode }) {
  return children
}
