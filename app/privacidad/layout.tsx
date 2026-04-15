import { buildMetadata } from "@/lib/seo"

export const metadata = buildMetadata({
  title: "Privacidad",
  description:
    "Política de privacidad de QuakeClub. Conoce cómo tratamos los datos asociados a la comunidad de Quake Live en Chile.",
  path: "/privacidad",
  keywords: ["privacidad", "datos", "politica de privacidad"],
})

export default function PrivacidadLayout({ children }: { children: React.ReactNode }) {
  return children
}
