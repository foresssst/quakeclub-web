import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import openid from "openid"

const STEAM_OPENID_URL = "https://steamcommunity.com/openid"

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const returnTo = url.searchParams.get('returnTo') || '/';
    const rememberMe = url.searchParams.get('rememberMe') !== 'false'; // default true

    // Guardar returnTo y rememberMe en cookies temporales
    const cookieStore = await cookies();
    cookieStore.set('auth_return_to', returnTo, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 5, // 5 minutos
      path: "/",
    });
    cookieStore.set('auth_remember_me', rememberMe ? '1' : '0', {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 5, // 5 minutos
      path: "/",
    });
    
    const returnUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/steam/callback`;
    const realm = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const relyingParty = new openid.RelyingParty(
      returnUrl,
      realm,
      true, // Use stateless verification
      false, // Strict mode
      [],
    )

    // Get authentication URL
    return new Promise<NextResponse>((resolve, reject) => {
      relyingParty.authenticate(STEAM_OPENID_URL, false, (error, authUrl) => {
        if (error || !authUrl) {
          console.error("Steam auth error:", error)
          resolve(NextResponse.json({ error: "Failed to initiate Steam login" }, { status: 500 }))
          return
        }

        // Redirect to Steam login
        resolve(NextResponse.redirect(authUrl))
      })
    })
  } catch (error) {
    console.error("Steam auth error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
