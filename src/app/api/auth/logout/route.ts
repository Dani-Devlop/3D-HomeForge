import { NextResponse } from 'next/server';
import { clearOwnerCookie } from '@/lib/auth';

// ============================================================
// POST /api/auth/logout — admin sign-out (clears the cookie)
// ============================================================

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearOwnerCookie(res);
  return res;
}
