import { buildMetadata } from "@/lib/seo"

export const metadata = buildMetadata({
  title: "Rankings ELO",
  description:
    "Rankings ELO de Quake Live en Chile en tiempo real. Sigue CA, DUEL, CTF y otros modos competitivos con estadísticas actualizadas.",
  path: "/rankings",
  keywords: ["rankings elo", "clasificacion", "duel", "clan arena"],
})

export default function RankingsLayout({ children }: { children: React.ReactNode }) {
  return children
}
