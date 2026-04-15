import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/health/zmq
 * Health check endpoint para verificar que el API está disponible
 * El listener ZMQ llama a esto al iniciar para verificar conectividad
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: "ok",
    service: "quakeclub-api",
    timestamp: new Date().toISOString(),
    message: "ZMQ listener can connect successfully"
  })
}

/**
 * POST /api/health/zmq
 * Permite que el listener envíe información sobre su estado
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Log de la conexión del listener
    console.log(`[HEALTH] ZMQ Listener conectado:`, {
      ports: body.ports?.length || 0,
      timestamp: body.timestamp
    })
    
    return NextResponse.json({
      status: "ok",
      message: "Health check received",
      receivedPorts: body.ports?.length || 0
    })
  } catch (error) {
    return NextResponse.json({
      status: "error",
      message: "Invalid request"
    }, { status: 400 })
  }
}
