import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getOwner } from '@/lib/auth';
import { readJsonBody } from '@/app/api/_lib/serialize';
import { serializePortfolioItem } from '@/app/api/_lib/portfolio';

// ============================================================
// PATCH  /api/portfolio/[id] → ویرایش نمونه‌کار (فقط مدیر)
// DELETE /api/portfolio/[id] → حذف نمونه‌کار (فقط مدیر)
// ============================================================

const MAX_IMAGE_CHARS = 6_000_000;

const CATEGORIES = ['kitchen', 'bedroom', 'living', 'office', 'other'] as const;

const patchSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(400).optional(),
  category: z.enum(CATEGORIES).optional(),
  image: z
    .string()
    .min(8)
    .max(MAX_IMAGE_CHARS)
    .refine(
      (v) => v.startsWith('data:image/') || v.startsWith('/'),
      'تصویر باید dataURL یا مسیر عمومی باشد',
    )
    .optional(),
  visible: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getOwner(req))) {
    return NextResponse.json(
      { error: 'برای این عملیات باید به‌عنوان مدیر وارد شوید' },
      { status: 401 },
    );
  }
  try {
    const { id } = await params;
    const existing = await db.portfolioItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'نمونه‌کار یافت نشد' }, { status: 404 });
    }

    const body = await readJsonBody(req);
    if (!body.ok) {
      return NextResponse.json({ error: 'داده ارسالی نامعتبر است' }, { status: 400 });
    }
    const parsed = patchSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json({ error: 'اطلاعات ارسالی نامعتبر است' }, { status: 400 });
    }

    const item = await db.portfolioItem.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ item: serializePortfolioItem(item) });
  } catch (err) {
    console.error('PATCH /api/portfolio/[id] failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getOwner(req))) {
    return NextResponse.json(
      { error: 'برای این عملیات باید به‌عنوان مدیر وارد شوید' },
      { status: 401 },
    );
  }
  try {
    const { id } = await params;
    const existing = await db.portfolioItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'نمونه‌کار یافت نشد' }, { status: 404 });
    }
    await db.portfolioItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/portfolio/[id] failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}
