import { buildMetadata } from "@/lib/seo"

export const metadata = buildMetadata({
  title: "Reglas",
  description:
    "Reglas y normativas de QuakeClub para comunidad, torneos, servidores y convivencia en Quake Live.",
  path: "/reglas",
  keywords: ["reglas", "normativas", "torneos quake live"],
})

export default function ReglasLayout({ children }: { children: React.ReactNode }) {
  return children
}
