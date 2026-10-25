import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Folder } from '@prisma/client';
import { db } from '@/lib/db';
import { requireOwner } from '@/lib/auth';
import { readJsonBody } from '@/app/api/_lib/serialize';

// ============================================================
// /api/folders/[id] — تغییر نام و حذف یک پوشه
// (حذف پوشه پروژه‌ها را حذف نمی‌کند؛ folderId آن‌ها با SetNull تهی می‌شود)
// ============================================================

function serializeFolder(f: Folder & { _count?: { projects: number } }) {
  return {
    id: f.id,
    name: f.name,
    createdAt: f.createdAt.toISOString(),
    projectCount: f._count?.projects ?? 0,
  };
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(60),
});

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
      return NextResponse.json({ error: 'داده ارسالی نامعتبر است' }, { status: 400 });
    }
    const parsed = patchSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'نام پوشه را بین ۱ تا ۶۰ کاراکتر وارد کنید' },
        { status: 400 },
      );
    }

    const existing = await db.folder.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: 'پوشه یافت نشد' }, { status: 404 });
    }

    const folder = await db.folder.update({
      where: { id },
      data: { name: parsed.data.name },
      include: { _count: { select: { projects: true } } },
    });
    return NextResponse.json({ folder: serializeFolder(folder) });
  } catch (err) {
    console.error('PATCH /api/folders/[id] failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireOwner(req);
  if (denied) return denied;

  try {
    const { id } = await params;
    const existing = await db.folder.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: 'پوشه یافت نشد' }, { status: 404 });
    }
    await db.folder.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/folders/[id] failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}
