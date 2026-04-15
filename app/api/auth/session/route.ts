import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    return NextResponse.json({ 
      user: {
        steamId: session.user.steamId,
        username: session.user.username,
        isAdmin: session.user.isAdmin
      }
    });
  } catch (error) {
    console.error('Error getting session:', error);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
