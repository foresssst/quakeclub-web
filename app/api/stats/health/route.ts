import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/stats/health
 * Health check endpoint para verificar que el API está activo
 * Usado por el listener ZMQ para confirmar conectividad
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: "ok",
    message: "QuakeClub Stats API is running",
    timestamp: new Date().toISOString(),
    service: "stats-receiver"
  })
}

/**
 * POST /api/stats/health (ping-pong)
 * El listener puede enviar un ping y recibir confirmación
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    return NextResponse.json({
      status: "ok",
      message: "pong",
      receivedFrom: body.source || "unknown",
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      status: "ok",
      message: "pong",
      timestamp: new Date().toISOString()
    })
  }
}
