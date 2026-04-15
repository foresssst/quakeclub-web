import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { createPatchNote } from "@/lib/patchnotes-storage"

export async function POST(request: Request) {
  const session = await getSession()
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const body = await request.json()
  const { version, title, date, content, author } = body

  if (!version || !title || !date || !content) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
  }

  const note = createPatchNote({
    version,
    title,
    date,
    content,
    author: author || session.user.username || "QuakeClub",
  })

  return NextResponse.json({ note })
}
