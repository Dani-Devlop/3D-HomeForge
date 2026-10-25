import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureAdminSettings, requireOwner, setPassword, verifyPassword } from '@/lib/auth';
import { readJsonBody } from '@/app/api/_lib/serialize';

// ============================================================
// POST /api/auth/password — تعویض رمز مدیر (فقط با نشست فعال)
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
      return NextResponse.json({ error: 'داده ارسالی نامعتبر است' }, { status: 400 });
    }
    const parsed = passwordSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'رمز جدید باید حداقل ۴ کاراکتر باشد' },
        { status: 400 },
      );
    }

    await ensureAdminSettings();
    if (!(await verifyPassword(parsed.data.currentPassword))) {
      return NextResponse.json({ error: 'رمز فعلی اشتباه است' }, { status: 401 });
    }

    const ok = await setPassword(parsed.data.newPassword);
    if (!ok) {
      return NextResponse.json({ error: 'رمز جدید باید حداقل ۴ کاراکتر باشد' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/auth/password failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}
