import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditAsync } from "@/lib/audit"
import { encrypt } from "@/lib/crypto"

function parsePort(value: unknown, field: string): number {
  const parsed = Number.parseInt(String(value), 10)

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`${field} inválido`)
  }

  return parsed
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, ip, port, password, serverType, gamePort, enabled, notes } = body

    const existing = await prisma.zmqServerConfig.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Servidor no encontrado" }, { status: 404 })
    }

    const data: Record<string, any> = {}
    const nextIp = ip !== undefined ? String(ip).trim() : existing.ip
    const nextPort = port !== undefined ? parsePort(port, "Puerto ZMQ") : existing.port

    if (ip !== undefined) data.ip = nextIp
    if (port !== undefined) data.port = nextPort
    if (typeof password === "string" && password.trim()) data.password = encrypt(password.trim())
    if (serverType !== undefined) data.serverType = serverType === "competitive" ? "competitive" : "public"
    if (gamePort !== undefined) data.gamePort = gamePort ? parsePort(gamePort, "Puerto de juego") : null
    if (enabled !== undefined) data.enabled = enabled
    if (notes !== undefined) data.notes = notes || null
    if (name !== undefined) {
      const normalizedName = String(name).trim()
      data.name = normalizedName || `${nextIp}:${nextPort}`
    }

    const server = await prisma.zmqServerConfig.update({
      where: { id },
      data,
    })

    logAuditAsync({ category: "SERVER", action: "UPDATE_ZMQ_SERVER", targetType: "server", targetId: id, details: data }, session, request)

    return NextResponse.json({ server })
  } catch (error: any) {
    if (error?.message?.includes("inválido")) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Servidor no encontrado" }, { status: 404 })
    }
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un servidor con esa IP y puerto" }, { status: 409 })
    }
    console.error("[ZMQ API] Error updating config:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { id } = await params

    await prisma.zmqServerConfig.delete({ where: { id } })

    logAuditAsync({ category: "SERVER", action: "DELETE_ZMQ_SERVER", targetType: "server", targetId: id }, session, request)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Servidor no encontrado" }, { status: 404 })
    }
    console.error("[ZMQ API] Error deleting config:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
