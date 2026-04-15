import { NextResponse } from "next/server"
import { verifyUser, createSession, SESSION_SHORT_SECONDS, SESSION_LONG_SECONDS } from "@/lib/auth"
import { cookies } from "next/headers"
import { checkRateLimit, sanitizeUsername, logSecurityEvent, getSecurityHeaders } from "@/lib/security"
import { logAuditAsync } from "@/lib/audit"

export async function POST(request: Request) {
  try {
    const { username, password, rememberMe = true } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 })
    }

    const sanitizedUsername = sanitizeUsername(username)

    const rateLimitKey = `login:${sanitizedUsername}`
    if (!checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000)) {
      logSecurityEvent("RATE_LIMIT_EXCEEDED", { username: sanitizedUsername, endpoint: "login" })
      logAuditAsync({ category: "AUTH", action: "LOGIN_RATE_LIMITED", actorType: "ANONYMOUS", actorName: sanitizedUsername, status: "FAILURE", details: { username: sanitizedUsername } }, null, request)
      return NextResponse.json(
        { error: "Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos." },
        { status: 429 },
      )
    }

    const user = await verifyUser(sanitizedUsername, password)
    if (!user) {
      logSecurityEvent("LOGIN_FAILED", { username: sanitizedUsername })
      logAuditAsync({ category: "AUTH", action: "LOGIN_FAILED", actorType: "ANONYMOUS", actorName: sanitizedUsername, status: "FAILURE", details: { username: sanitizedUsername } }, null, request)
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 })
    }

    const sessionId = createSession(user, rememberMe)
    const cookieStore = await cookies()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ""
    const cookieDomain = siteUrl.includes("quakeclub.com") ? ".quakeclub.com" : undefined

    cookieStore.set("session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: rememberMe ? SESSION_LONG_SECONDS : SESSION_SHORT_SECONDS,
      path: "/",
      ...(cookieDomain && process.env.NODE_ENV === "production" ? { domain: cookieDomain } : {}),
    })

    logSecurityEvent("LOGIN_SUCCESS", { username: sanitizedUsername, userId: user.id })
    logAuditAsync({ category: "AUTH", action: "ADMIN_LOGIN", actorId: user.id, actorName: sanitizedUsername, details: { rememberMe } }, null, request)

    const response = NextResponse.json({ user })
    const headers = getSecurityHeaders()
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    logSecurityEvent("LOGIN_ERROR", { error: String(error) })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
