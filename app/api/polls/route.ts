import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logSecurityEvent, getSecurityHeaders } from "@/lib/security"

function withHeaders(response: NextResponse) {
  const headers = getSecurityHeaders()
  Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v))
  return response
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") // "ACTIVE" | "CLOSED" | null (all)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "20")), 50)
    const skip = (page - 1) * limit

    const where = status ? { status: status as "ACTIVE" | "CLOSED" } : {}

    const [polls, total] = await Promise.all([
      prisma.poll.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          options: { orderBy: { order: "asc" } },
        },
      }),
      prisma.poll.count({ where }),
    ])

    return withHeaders(NextResponse.json({ polls, total, page, totalPages: Math.ceil(total / limit) }))
  } catch (error) {
    return withHeaders(NextResponse.json({ error: "Error al obtener encuestas" }, { status: 500 }))
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session?.user.isAdmin) {
      return withHeaders(NextResponse.json({ error: "No autorizado" }, { status: 403 }))
    }

    const { title, description, options } = await request.json()

    if (!title?.trim()) {
      return withHeaders(NextResponse.json({ error: "Título requerido" }, { status: 400 }))
    }
    if (!options || !Array.isArray(options) || options.length < 2) {
      return withHeaders(NextResponse.json({ error: "Se requieren al menos 2 opciones" }, { status: 400 }))
    }
    if (options.length > 10) {
      return withHeaders(NextResponse.json({ error: "Máximo 10 opciones" }, { status: 400 }))
    }

    const poll = await prisma.poll.create({
      data: {
        title: title.trim().replace(/<[^>]*>/g, ""),
        description: description?.trim().replace(/<[^>]*>/g, "") || null,
        createdBy: session.user.steamId || session.user.id,
        options: {
          create: options
            .filter((o: string) => o?.trim())
            .map((text: string, i: number) => ({
              text: text.trim().replace(/<[^>]*>/g, ""),
              order: i,
            })),
        },
      },
      include: { options: { orderBy: { order: "asc" } } },
    })

    logSecurityEvent("POLL_CREATED", { pollId: poll.id, title: poll.title })

    return withHeaders(NextResponse.json({ poll }, { status: 201 }))
  } catch (error) {
    return withHeaders(NextResponse.json({ error: "Error al crear encuesta" }, { status: 500 }))
  }
}
