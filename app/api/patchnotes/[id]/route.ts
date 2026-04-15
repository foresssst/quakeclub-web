import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getPatchNoteById, updatePatchNote, deletePatchNote } from "@/lib/patchnotes-storage"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const note = getPatchNoteById(id)
  if (!note) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }
  return NextResponse.json({ note })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const updated = updatePatchNote(id, body)
  if (!updated) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }
  return NextResponse.json({ note: updated })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await params
  const deleted = deletePatchNote(id)
  if (!deleted) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
