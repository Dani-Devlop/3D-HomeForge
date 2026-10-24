import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { guestColorFor } from '@/lib/scene-types';
import { checkShareToken } from '@/app/api/_lib/share-guard';
import { readJsonBody } from '@/app/api/_lib/serialize';

// ============================================================
// /api/guests — ثبت‌نام مهمان با لینک اشتراکی
// ============================================================

const createSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1).max(30),
});

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody(req);
    if (!body.ok) {
      return NextResponse.json(
        { error: 'نام باید بین ۱ تا ۳۰ کاراکتر باشد' },
        { status: 400 },
      );
    }
    const parsed = createSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'نام باید بین ۱ تا ۳۰ کاراکتر باشد' },
        { status: 400 },
      );
    }

    const check = await checkShareToken(parsed.data.token);
    if (!check.ok) return check.response;

    const { name } = parsed.data;
    const guest = await db.guest.create({
      data: {
        name,
        color: guestColorFor(name),
        role: check.link.role,
        shareLinkId: check.link.id,
      },
    });
    return NextResponse.json(
      { guest: { id: guest.id, name: guest.name, color: guest.color, role: guest.role } },
      { status: 201 },
    );
  } catch (err) {
    console.error('POST /api/guests failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}
