import { NextRequest, NextResponse } from "next/server"

/**
 * DEPRECATED: Este endpoint ya NO se usa.
 * 
 * Los ratings ahora se calculan automáticamente en /api/match
 * cuando se reciben matches del feeder ZMQ.
 * 
 * Este archivo se mantiene solo para evitar errores 404
 * en llamadas legacy.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: "This endpoint is deprecated",
      message: "Ratings are now calculated automatically in /api/match when matches are received from the ZMQ feeder",
      hint: "No action needed - ratings are being calculated automatically for new matches"
    },
    { status: 410 } // 410 Gone
  )
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      error: "This endpoint is deprecated",
      message: "Ratings are now calculated automatically in /api/match"
    },
    { status: 410 }
  )
}
