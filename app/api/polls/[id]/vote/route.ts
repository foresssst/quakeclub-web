import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkRateLimit, getSecurityHeaders } from "@/lib/security"

function withHeaders(response: NextResponse) {
  const headers = getSecurityHeaders()
  Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v))
  return response
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user.steamId) {
      return withHeaders(NextResponse.json({ error: "Debes iniciar sesión con Steam" }, { status: 401 }))
    }

    if (!checkRateLimit(`poll-vote:${session.user.steamId}`, 10, 60 * 1000)) {
      return withHeaders(NextResponse.json({ error: "Demasiados intentos" }, { status: 429 }))
    }

    const { id: pollId } = await params
    const { optionId } = await request.json()

    if (!optionId) {
      return withHeaders(NextResponse.json({ error: "optionId requerido" }, { status: 400 }))
    }

    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: { options: true },
    })

    if (!poll) {
      return withHeaders(NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 }))
    }
    if (poll.status !== "ACTIVE") {
      return withHeaders(NextResponse.json({ error: "Esta encuesta está cerrada" }, { status: 403 }))
    }

    const option = poll.options.find((o) => o.id === optionId)
    if (!option) {
      return withHeaders(NextResponse.json({ error: "Opción no válida" }, { status: 400 }))
    }

    const player = await prisma.player.findUnique({
      where: { steamId: session.user.steamId },
      select: { id: true, steamId: true },
    })
    if (!player) {
      return withHeaders(NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 }))
    }

    // Check if already voted
    const existingVote = await prisma.pollVote.findUnique({
      where: { pollId_voterId: { pollId, voterId: player.id } },
    })
    if (existingVote) {
      return withHeaders(NextResponse.json({ error: "Ya votaste en esta encuesta" }, { status: 409 }))
    }

    // Create vote and update counters in transaction
    await prisma.$transaction([
      prisma.pollVote.create({
        data: {
          pollId,
          optionId,
          voterId: player.id,
          steamId: player.steamId,
        },
      }),
      prisma.pollOption.update({
        where: { id: optionId },
        data: { voteCount: { increment: 1 } },
      }),
      prisma.poll.update({
        where: { id: pollId },
        data: { totalVotes: { increment: 1 } },
      }),
    ])

    return withHeaders(NextResponse.json({ success: true }))
  } catch (error: any) {
    if (error?.code === "P2002") {
      return withHeaders(NextResponse.json({ error: "Ya votaste en esta encuesta" }, { status: 409 }))
    }
    return withHeaders(NextResponse.json({ error: "Error al votar" }, { status: 500 }))
  }
}
