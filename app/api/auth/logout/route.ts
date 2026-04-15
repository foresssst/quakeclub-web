import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { deleteSession, getSession } from "@/lib/auth"
import { logAuditAsync } from "@/lib/audit"

const getCookieDomain = () => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ""
  return siteUrl.includes("quakeclub.com") ? ".quakeclub.com" : undefined
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    const cookieStore = await cookies()
    const sessionId = cookieStore.get("session")?.value

    if (session) {
      logAuditAsync({ category: "AUTH", action: "LOGOUT", actorId: session.user.steamId || session.user.id, actorName: session.user.username }, session, request)
    }

    if (sessionId) {
      deleteSession(sessionId)
    }

    cookieStore.set("session", "", { maxAge: 0, path: "/", domain: getCookieDomain() })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET handler for direct navigation to /api/auth/logout
export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionId = cookieStore.get("session")?.value

    if (sessionId) {
      deleteSession(sessionId)
    }

    cookieStore.set("session", "", { maxAge: 0, path: "/", domain: getCookieDomain() })

    // Redirect to home page after logout
    return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_BASE_URL || "https://quakeclub.com"))
  } catch (error) {
    return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_BASE_URL || "https://quakeclub.com"))
  }
}
