import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ConfigsPageClient } from "./configs-client"

export default async function ConfigsPage() {
  const session = await getSession()

  // Requiere login para acceder a configs
  if (!session?.user) {
    redirect("/login?redirect=/configs")
  }

  return <ConfigsPageClient />
}
