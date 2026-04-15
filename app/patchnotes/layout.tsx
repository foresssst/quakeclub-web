import { buildMetadata } from "@/lib/seo"

export const metadata = buildMetadata({
  title: "Patch Notes",
  description:
    "Revisa el historial de cambios de Quake Club: mejoras del sitio, nuevas funciones, ajustes visuales y actualizaciones importantes.",
  path: "/patchnotes",
  keywords: ["patch notes", "cambios", "actualizaciones quakeclub"],
})

export default function PatchNotesLayout({ children }: { children: React.ReactNode }) {
  return children
}
