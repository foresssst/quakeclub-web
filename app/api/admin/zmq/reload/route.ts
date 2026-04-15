import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { stopZmqListener, startZmqListener } from "@/lib/zmq-listener"

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    console.log("[ZMQ] Recargando listener por solicitud de admin...")

    await stopZmqListener()

    // Reset init flag so startZmqListener creates a new instance
    ;(global as any)["__zmq_initialized__"] = false

    await startZmqListener()

    console.log("[ZMQ] Listener recargado exitosamente")

    return NextResponse.json({ success: true, message: "ZMQ listener recargado" })
  } catch (error) {
    console.error("[ZMQ API] Error reloading listener:", error)
    return NextResponse.json({ error: "Error recargando ZMQ listener" }, { status: 500 })
  }
}
