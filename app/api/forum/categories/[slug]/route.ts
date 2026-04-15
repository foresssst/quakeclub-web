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
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const category = await prisma.forumCategory.findUnique({
      where: { slug },
      include: { _count: { select: { threads: true } } },
    })

    if (!category) {
      return withHeaders(NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 }))
    }

    return withHeaders(NextResponse.json({
      category: { ...category, threadCount: category._count.threads },
    }))
  } catch (error) {
    return withHeaders(NextResponse.json({ error: "Error" }, { status: 500 }))
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user.isAdmin) {
      return withHeaders(NextResponse.json({ error: "No autorizado" }, { status: 403 }))
    }

    const { slug } = await params
    const { name, description, order } = await request.json()

    const category = await prisma.forumCategory.update({
      where: { slug },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(order !== undefined && { order }),
      },
    })

    return withHeaders(NextResponse.json({ category }))
  } catch (error) {
    return withHeaders(NextResponse.json({ error: "Error al actualizar" }, { status: 500 }))
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user.isAdmin) {
      return withHeaders(NextResponse.json({ error: "No autorizado" }, { status: 403 }))
    }

    const { slug } = await params
    await prisma.forumCategory.delete({ where: { slug } })

    logSecurityEvent("FORUM_CATEGORY_DELETED", { slug })

    return withHeaders(NextResponse.json({ success: true }))
  } catch (error) {
    return withHeaders(NextResponse.json({ error: "Error al eliminar" }, { status: 500 }))
  }
}
