import { NextResponse } from 'next/server'

/**
 * API endpoint para limpiar cache de avatares de Steam
 * Solo limpia avatares que NO son custom (data:image/)
 */
export async function POST() {
  try {
    // Este endpoint retorna instrucciones para el cliente
    return NextResponse.json({
      success: true,
      message: 'Cache de avatares limpiado. Recarga la página para ver los cambios.',
      instructions: {
        action: 'clear-steam-avatars',
        prefix: 'qc_avatar_v3_',
        excludePattern: 'data:image/'
      }
    })
  } catch (error) {
    console.error('[Clear Avatar Cache] Error:', error)
    return NextResponse.json(
      { error: 'Error al limpiar cache' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    info: 'Use POST method to clear avatar cache',
    endpoint: '/api/cache/clear-avatars'
  })
}
