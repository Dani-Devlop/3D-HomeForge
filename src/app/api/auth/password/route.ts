import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureAdminSettings, requireOwner, setPassword, verifyPassword } from '@/lib/auth';
import { readJsonBody } from '@/app/api/_lib/serialize';

// ============================================================
// POST /api/auth/password — change the admin password (active session required)
// ============================================================

const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(4).max(200),
});

export async function POST(req: NextRequest) {
  const denied = await requireOwner(req);
  if (denied) return denied;

  try {
    const body = await readJsonBody(req);
    if (!body.ok) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }
    const parsed = passwordSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'New password must be at least 4 characters' },
        { status: 400 },
      );
    }

    await ensureAdminSettings();
    if (!(await verifyPassword(parsed.data.currentPassword))) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    const ok = await setPassword(parsed.data.newPassword);
    if (!ok) {
      return NextResponse.json({ error: 'New password must be at least 4 characters' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/auth/password failed:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
