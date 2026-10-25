import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getOwner } from '@/lib/auth';
import { readJsonBody } from '@/app/api/_lib/serialize';
import {
  hasSceneObjects,
  serializePortfolioItem,
  stringifyOrEmpty,
} from '@/app/api/_lib/portfolio';

// ============================================================
// نمونه‌کارها (صفحه عمومی لندینگ) — تصویر یا مدل سه‌بعدی زنده
// GET  /api/portfolio          → فقط موارد visible (عمومی، مرتب بر sortOrder سپس newest)
// GET  /api/portfolio?all=1    → همه موارد (فقط مدیر)
// POST /api/portfolio          → ساخت مورد جدید (فقط مدیر)
// ============================================================

const MAX_IMAGE_CHARS = 6_000_000; // ~4.5MB باینری در dataURL

const CATEGORIES = ['kitchen', 'bedroom', 'living', 'office', 'other'] as const;

const looseObject = z.record(z.string(), z.unknown());

const itemSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    description: z.string().trim().max(400).optional().default(''),
    category: z.enum(CATEGORIES).optional().default('kitchen'),
    image: z
      .string()
      .max(MAX_IMAGE_CHARS)
      .refine(
        (v) => v === '' || v.startsWith('data:image/') || v.startsWith('/'),
        'تصویر باید dataURL یا مسیر عمومی باشد',
      )
      .optional()
      .default(''),
    roomSpec: looseObject.optional(),
    sceneState: z
      .object({ objects: z.array(z.unknown()).max(400).optional().default([]) })
      .optional(),
    visible: z.boolean().optional().default(true),
    sortOrder: z.number().int().min(0).max(9999).optional(),
  })
  .refine(
    (v) => v.image.length >= 8 || hasSceneObjects(v.sceneState),
    { message: 'تصویر یا مدل سه‌بعدی زنده الزامی است' },
  );

export async function GET(req: NextRequest) {
  try {
    const all = req.nextUrl.searchParams.get('all') === '1';
    if (all && !(await getOwner(req))) {
      return NextResponse.json(
        { error: 'برای این عملیات باید به‌عنوان مدیر وارد شوید' },
        { status: 401 },
      );
    }
    const items = await db.portfolioItem.findMany({
      where: all ? undefined : { visible: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json({ items: items.map(serializePortfolioItem) });
  } catch (err) {
    console.error('GET /api/portfolio failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await getOwner(req))) {
    return NextResponse.json(
      { error: 'برای این عملیات باید به‌عنوان مدیر وارد شوید' },
      { status: 401 },
    );
  }
  try {
    const body = await readJsonBody(req);
    if (!body.ok) {
      return NextResponse.json({ error: 'داده ارسالی نامعتبر است' }, { status: 400 });
    }
    const parsed = itemSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'اطلاعات نمونه‌کار کامل نیست (عنوان + تصویر یا مدل سه‌بعدی الزامی است)' },
        { status: 400 },
      );
    }
    // ترتیب پیش‌فرض: انتهای لیست
    const last = await db.portfolioItem.aggregate({ _max: { sortOrder: true } });
    const sortOrder = parsed.data.sortOrder ?? (last._max.sortOrder ?? 0) + 1;

    const item = await db.portfolioItem.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        category: parsed.data.category,
        image: parsed.data.image,
        roomSpec: stringifyOrEmpty(parsed.data.roomSpec),
        sceneState: stringifyOrEmpty(parsed.data.sceneState),
        visible: parsed.data.visible,
        sortOrder,
      },
    });
    return NextResponse.json({ item: serializePortfolioItem(item) }, { status: 201 });
  } catch (err) {
    console.error('POST /api/portfolio failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}
