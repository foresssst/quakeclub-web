import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ProfileContent } from "@/components/profile-content"

export const dynamic = "force-dynamic"

export default async function ProfilePage() {
  const session = await getSession()

  if (!session) {
    redirect("/login")
  }

  return (
    <div className="relative min-h-screen">
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <ProfileContent user={session.user} isOwnProfile={true} isLoggedIn={true} />
      </div>
    </div>
  )
}
