import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireOwner } from '@/lib/auth';
import { isValidRole } from '@/lib/scene-types';
import { readJsonBody } from '@/app/api/_lib/serialize';

// ============================================================
// /api/guests/[id] — حضور مهمان (heartbeat) و تغییر نقش
// GET عمومی است ولی پاسخ فقط {id,name,color,role} دارد (بدون shareLinkId)
// PATCH فقط برای مدیر
// ============================================================

const patchSchema = z.object({ role: z.unknown() });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const guest = await db.guest.findUnique({ where: { id } });
    if (!guest) {
      return NextResponse.json({ error: 'مهمان یافت نشد' }, { status: 404 });
    }
    await db.guest.update({ where: { id }, data: { lastSeenAt: new Date() } });
    // پاسخ محدود — بدون shareLinkId
    return NextResponse.json({
      guest: {
        id: guest.id,
        name: guest.name,
        color: guest.color,
        role: guest.role,
      },
    });
  } catch (err) {
    console.error('GET /api/guests/[id] failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireOwner(req);
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await readJsonBody(req);
    if (!body.ok) {
      return NextResponse.json(
        { error: 'نقش باید viewer یا modifier باشد' },
        { status: 400 },
      );
    }
    const parsed = patchSchema.safeParse(body.data);
    if (!parsed.success || !isValidRole(parsed.data.role)) {
      return NextResponse.json(
        { error: 'نقش باید viewer یا modifier باشد' },
        { status: 400 },
      );
    }

    const existing = await db.guest.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: 'مهمان یافت نشد' }, { status: 404 });
    }

    const guest = await db.guest.update({
      where: { id },
      data: { role: parsed.data.role },
    });
    return NextResponse.json({
      guest: {
        id: guest.id,
        name: guest.name,
        color: guest.color,
        role: guest.role,
      },
    });
  } catch (err) {
    console.error('PATCH /api/guests/[id] failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}
