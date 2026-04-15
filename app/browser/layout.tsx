import { buildMetadata } from "@/lib/seo"

export const metadata = buildMetadata({
  title: "Servidores",
  description:
    "Servidores de Quake Live en Chile y el resto del mundo. Mira quién está jugando, revisa mapas y mas, conéctate desde Quake Club.",
  path: "/browser",
  keywords: ["servidores", "browser", "quake live servers", "partidas en vivo"],
})

export default function BrowserLayout({ children }: { children: React.ReactNode }) {
  return children
}
