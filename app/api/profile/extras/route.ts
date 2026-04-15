import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { updateProfileExtras } from "@/lib/profile-extras"

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user?.steamId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const body = await req.json()
    const profileExtras = updateProfileExtras(session.user.steamId, {
      bio: body?.bio,
      links: body?.links,
    })

    return NextResponse.json({ success: true, profileExtras })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al actualizar perfil"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
