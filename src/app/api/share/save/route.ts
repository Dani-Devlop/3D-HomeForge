import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { checkShareToken } from '@/app/api/_lib/share-guard';
import { readJsonBody } from '@/app/api/_lib/serialize';

// ============================================================
// POST /api/share/save — ذخیره خودکار صحنه توسط مهمان ویرایشگر
// (عمومی ولی با توکن لینک محافظت‌شده؛ فقط نقش modifier)
// ============================================================

const saveSchema = z.object({
  token: z.string().min(1),
  guestId: z.string().min(1),
  sceneState: z.object({ objects: z.array(z.unknown()) }),
});

const MAX_OBJECTS = 400;

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody(req);
    if (!body.ok) {
      return NextResponse.json({ error: 'داده ارسالی نامعتبر است' }, { status: 400 });
    }
    const parsed = saveSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json({ error: 'داده ارسالی نامعتبر است' }, { status: 400 });
    }
    const { token, guestId, sceneState } = parsed.data;

    if (sceneState.objects.length > MAX_OBJECTS) {
      return NextResponse.json(
        { error: `حداکثر ${MAX_OBJECTS} آبجکت قابل ذخیره است` },
        { status: 400 },
      );
    }

    // اعتبارسنجی توکن لینک اشتراکی (۴۰۳ در صورت نامعتبر بودن)
    const check = await checkShareToken(token);
    if (!check.ok) return check.response;
    const { link } = check;

    // مهمان باید متعلق به همین لینک باشد
    const guest = await db.guest.findFirst({
      where: { id: guestId, shareLinkId: link.id },
      select: { id: true },
    });
    if (!guest) {
      return NextResponse.json({ error: 'مهمان شناسایی نشد' }, { status: 403 });
    }

    // فقط لینک‌های ویرایشگر حق ذخیره دارند
    if (link.role !== 'modifier') {
      return NextResponse.json({ error: 'این لینک دسترسی ویرایش ندارد' }, { status: 403 });
    }

    const now = new Date();
    await db.$transaction([
      db.project.update({
        where: { id: link.projectId },
        data: { sceneState: JSON.stringify({ objects: sceneState.objects }) },
      }),
      db.guest.update({ where: { id: guest.id }, data: { lastSeenAt: now } }),
    ]);

    return NextResponse.json({ ok: true, updatedAt: now.toISOString() });
  } catch (err) {
    console.error('POST /api/share/save failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}
