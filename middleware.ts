import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Middleware global de QuakeClub
 * 
 * Protege las rutas /api/admin/* requiriendo una cookie de sesión válida.
 * Es una primera línea de defensa — cada ruta admin TAMBIÉN debe verificar
 * isAdmin internamente (defensa en profundidad).
 * 
 * Excepciones:
 * - GET /api/admin/banner-config → usado por el frontend público
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Excluir banner-config GET (lo usa el frontend público)
  if (pathname === "/api/admin/banner-config" && request.method === "GET") {
    return NextResponse.next()
  }

  // Proteger todas las rutas /api/admin/*
  if (pathname.startsWith("/api/admin")) {
    const sessionCookie = request.cookies.get("session")

    if (!sessionCookie?.value) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/api/admin/:path*"],
}
