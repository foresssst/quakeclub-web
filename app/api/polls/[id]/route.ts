import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logSecurityEvent, getSecurityHeaders } from "@/lib/security"

function withHeaders(response: NextResponse) {
  const headers = getSecurityHeaders()
  Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v))
  return response
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getSession()

    const poll = await prisma.poll.findUnique({
      where: { id },
      include: {
        options: { orderBy: { order: "asc" } },
      },
    })

    if (!poll) {
      return withHeaders(NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 }))
    }

    // Check if current user has voted
    let userVote: string | null = null
    if (session?.user.steamId) {
      const player = await prisma.player.findUnique({
        where: { steamId: session.user.steamId },
        select: { id: true },
      })
      if (player) {
        const vote = await prisma.pollVote.findUnique({
          where: { pollId_voterId: { pollId: id, voterId: player.id } },
          select: { optionId: true },
        })
        userVote = vote?.optionId || null
      }
    }

    return withHeaders(NextResponse.json({ poll, userVote }))
  } catch (error) {
    return withHeaders(NextResponse.json({ error: "Error" }, { status: 500 }))
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user.isAdmin) {
      return withHeaders(NextResponse.json({ error: "No autorizado" }, { status: 403 }))
    }

    const { id } = await params
    const body = await request.json()

    const data: Record<string, unknown> = {}
    if (body.title !== undefined) data.title = body.title.trim()
    if (body.description !== undefined) data.description = body.description?.trim() || null
    if (body.status === "CLOSED") {
      data.status = "CLOSED"
      data.closedAt = new Date()
    }
    if (body.status === "ACTIVE") {
      data.status = "ACTIVE"
      data.closedAt = null
    }

    const poll = await prisma.poll.update({
      where: { id },
      data,
      include: { options: { orderBy: { order: "asc" } } },
    })

    logSecurityEvent("POLL_UPDATED", { pollId: id, changes: Object.keys(data) })

    return withHeaders(NextResponse.json({ poll }))
  } catch (error) {
    return withHeaders(NextResponse.json({ error: "Error al actualizar" }, { status: 500 }))
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user.isAdmin) {
      return withHeaders(NextResponse.json({ error: "No autorizado" }, { status: 403 }))
    }

    const { id } = await params
    await prisma.poll.delete({ where: { id } })

    logSecurityEvent("POLL_DELETED", { pollId: id })

    return withHeaders(NextResponse.json({ success: true }))
  } catch (error) {
    return withHeaders(NextResponse.json({ error: "Error al eliminar" }, { status: 500 }))
  }
}
