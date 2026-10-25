import { NextResponse } from 'next/server';
import { clearOwnerCookie } from '@/lib/auth';

// ============================================================
// POST /api/auth/logout — خروج مدیر (حذف کوکی)
// ============================================================

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearOwnerCookie(res);
  return res;
}
