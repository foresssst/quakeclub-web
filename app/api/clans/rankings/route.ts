import { NextRequest, NextResponse } from 'next/server';
import { calculateClansAverageElo } from '@/lib/clan-elo';

// GET /api/clans/rankings - Ranking de clanes por ELO promedio
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const gameType = searchParams.get('gameType') || 'overall';
    // SEGURIDAD: Limitar el máximo a 100 para prevenir DoS
    const parsedLimit = limitParam ? parseInt(limitParam) : 20;
    const limit = Math.min(Math.max(1, parsedLimit), 100);

    const rankedClans = await calculateClansAverageElo(gameType, limit);

    return NextResponse.json({
      success: true,
      gameType: gameType,
      clans: rankedClans
    });

  } catch (error) {
    console.error('Error fetching clan rankings:', error);
    return NextResponse.json(
      { error: 'Error al obtener el ranking de clanes' },
      { status: 500 }
    );
  }
}
