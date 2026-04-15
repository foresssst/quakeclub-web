import { NextResponse } from "next/server"
import { getSession, getUserById } from "@/lib/auth"

export async function GET() {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const user = getUserById(session.user.id)

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  }

  return NextResponse.json(user)
}
