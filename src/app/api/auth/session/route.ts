import { NextRequest, NextResponse } from 'next/server';
import { getOwner } from '@/lib/auth';

// ============================================================
// GET /api/auth/session — admin sign-in status (public)
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const authed = await getOwner(req);
    return NextResponse.json({ authed });
  } catch (err) {
    console.error('GET /api/auth/session failed:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
