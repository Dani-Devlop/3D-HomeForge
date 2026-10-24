import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { parseJsonSafe, readJsonBody } from '@/app/api/_lib/serialize';

// ============================================================
// /api/presets — ذخیره و بازیابی ترکیب‌های آماده کابینت
// ============================================================

const createSchema = z.object({
  name: z.string().min(1).max(50),
  data: z.array(z.unknown()),
});

export async function GET() {
  try {
    const presets = await db.preset.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({
      presets: presets.map((p) => ({
        id: p.id,
        name: p.name,
        data: parseJsonSafe(p.data, []),
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('GET /api/presets failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody(req);
    if (!body.ok) {
      return NextResponse.json({ error: 'داده ارسالی نامعتبر است' }, { status: 400 });
    }
    const parsed = createSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json({ error: 'داده ارسالی نامعتبر است' }, { status: 400 });
    }
    const preset = await db.preset.create({
      data: { name: parsed.data.name, data: JSON.stringify(parsed.data.data) },
    });
    return NextResponse.json(
      {
        preset: {
          id: preset.id,
          name: preset.name,
          data: parseJsonSafe(preset.data, []),
          createdAt: preset.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('POST /api/presets failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'شناسه پریست الزامی است' }, { status: 400 });
    }
    const existing = await db.preset.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: 'پریست یافت نشد' }, { status: 404 });
    }
    await db.preset.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/presets failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}
