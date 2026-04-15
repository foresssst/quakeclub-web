import { buildMetadata } from "@/lib/seo"

export const metadata = buildMetadata({
  title: "Foro",
  description:
    "Participa en el foro de la comunidad de Quake Live en Chile. Discusiones, guías, soporte y conversación entre jugadores.",
  path: "/foro",
  keywords: ["foro", "discusion", "comunidad quake live"],
})

export default function ForoLayout({ children }: { children: React.ReactNode }) {
  return children
}
