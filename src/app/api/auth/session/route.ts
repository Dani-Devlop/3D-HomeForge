import { NextRequest, NextResponse } from 'next/server';
import { getOwner } from '@/lib/auth';

// ============================================================
// GET /api/auth/session — وضعیت ورود مدیر (عمومی)
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const authed = await getOwner(req);
    return NextResponse.json({ authed });
  } catch (err) {
    console.error('GET /api/auth/session failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}
