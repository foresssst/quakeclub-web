import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logSecurityEvent, getSecurityHeaders } from "@/lib/security"

function withHeaders(response: NextResponse) {
  const headers = getSecurityHeaders()
  Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v))
  return response
}

export async function GET() {
  try {
    const categories = await prisma.forumCategory.findMany({
      orderBy: { order: "asc" },
      include: {
        _count: { select: { threads: true } },
        threads: {
          orderBy: { lastReplyAt: "desc" },
          take: 1,
          select: { id: true, title: true, lastReplyAt: true, lastReplyBy: true, createdAt: true },
        },
      },
    })

    const result = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      order: cat.order,
      threadCount: cat._count.threads,
      lastThread: cat.threads[0] || null,
    }))

    return withHeaders(NextResponse.json({ categories: result }))
  } catch (error) {
    return withHeaders(NextResponse.json({ error: "Error al obtener categorías" }, { status: 500 }))
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session?.user.isAdmin) {
      return withHeaders(NextResponse.json({ error: "No autorizado" }, { status: 403 }))
    }

    const { name, description, order } = await request.json()
    if (!name?.trim()) {
      return withHeaders(NextResponse.json({ error: "Nombre requerido" }, { status: 400 }))
    }

    const slug = name.trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

    const category = await prisma.forumCategory.create({
      data: {
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        order: order ?? 0,
      },
    })

    logSecurityEvent("FORUM_CATEGORY_CREATED", { categoryId: category.id, name: category.name })

    return withHeaders(NextResponse.json({ category }, { status: 201 }))
  } catch (error: any) {
    if (error?.code === "P2002") {
      return withHeaders(NextResponse.json({ error: "Ya existe una categoría con ese nombre" }, { status: 409 }))
    }
    return withHeaders(NextResponse.json({ error: "Error al crear categoría" }, { status: 500 }))
  }
}
