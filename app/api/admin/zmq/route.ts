import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getZmqListenerStatus } from "@/lib/zmq-listener"
import { logAuditAsync } from "@/lib/audit"
import { decrypt, encrypt } from "@/lib/crypto"

function parsePort(value: unknown, field: string): number {
  const parsed = Number.parseInt(String(value), 10)

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`${field} inválido`)
  }

  return parsed
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const configs = await prisma.zmqServerConfig.findMany({
      orderBy: [{ ip: "asc" }, { port: "asc" }],
    })

    const liveStatus = getZmqListenerStatus()

    const servers = configs.map((config) => {
      const addr = `${config.ip}:${config.port}`
      const live = liveStatus?.find((s) => s.addr === addr)
      return {
        ...config,
        password: "••••••••", // Never expose passwords to frontend
        liveConnected: live?.state?.connected ?? false,
        liveActive: live?.state?.active ?? false,
        lastMessageType: live?.state?.lastMessageType ?? null,
      }
    })

    return NextResponse.json({ servers })
  } catch (error) {
    console.error("[ZMQ API] Error listing configs:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const { name, ip, port, password, serverType, gamePort, notes } = body

    const normalizedIp = typeof ip === "string" ? ip.trim() : ""
    const normalizedPassword = typeof password === "string" ? password.trim() : ""
    const normalizedName = typeof name === "string" ? name.trim() : ""

    if (!normalizedIp || !port || !normalizedPassword) {
      return NextResponse.json({ error: "IP, puerto y password son requeridos" }, { status: 400 })
    }

    const zmqPort = parsePort(port, "Puerto ZMQ")
    const parsedGamePort = gamePort ? parsePort(gamePort, "Puerto de juego") : null
    const normalizedServerType = serverType === "competitive" ? "competitive" : "public"

    const server = await prisma.zmqServerConfig.create({
      data: {
        name: normalizedName || `${normalizedIp}:${zmqPort}`,
        ip: normalizedIp,
        port: zmqPort,
        password: encrypt(normalizedPassword),
        serverType: normalizedServerType,
        gamePort: parsedGamePort,
        notes: notes || null,
        addedBy: session.user.username || session.user.steamId || "admin",
      },
    })

    logAuditAsync(
      {
        category: "SERVER",
        action: "ADD_ZMQ_SERVER",
        targetType: "server",
        targetId: `${normalizedIp}:${zmqPort}`,
        details: { name: normalizedName || null, serverType: normalizedServerType, gamePort: parsedGamePort },
      },
      session,
      request,
    )

    return NextResponse.json({ server: { ...server, password: "••••••••" } })
  } catch (error: any) {
    if (error?.message?.includes("inválido")) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un servidor con esa IP y puerto" }, { status: 409 })
    }
    console.error("[ZMQ API] Error creating config:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
