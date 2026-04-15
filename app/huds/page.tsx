import { getSession } from "@/lib/auth"
import { HudsPageClient } from "./huds-client"

export default async function HudsPage() {
  return <HudsPageClient />
}
