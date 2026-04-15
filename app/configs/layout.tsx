import { buildMetadata } from "@/lib/seo"

export const metadata = buildMetadata({
  title: "Configs",
  description:
    "Explora configs de Quake Live compartidas por la comunidad. Descarga configs y referencias para mejorar tu setup.",
  path: "/configs",
  keywords: ["configs", "autoexec", "crosshair", "quake live cfg"],
})

export default function ConfigsLayout({ children }: { children: React.ReactNode }) {
  return children
}
