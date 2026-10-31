import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureAdminSettings, verifyPassword, setOwnerCookie } from '@/lib/auth';
import { readJsonBody } from '@/app/api/_lib/serialize';

// ============================================================
// POST /api/auth/login — admin sign-in (public)
// ============================================================

const loginSchema = z.object({ password: z.string().min(1).max(200) });

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody(req);
    if (!body.ok) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }
    const parsed = loginSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Enter the password' }, { status: 400 });
    }

    await ensureAdminSettings();
    if (!(await verifyPassword(parsed.data.password))) {
      return NextResponse.json({ error: 'Incorrect admin password' }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    await setOwnerCookie(res);
    return res;
  } catch (err) {
    console.error('POST /api/auth/login failed:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
