import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Folder } from '@prisma/client';
import { db } from '@/lib/db';
import { requireOwner } from '@/lib/auth';
import { readJsonBody } from '@/app/api/_lib/serialize';

// ============================================================
// /api/folders — فهرست و ساخت پوشه مشتری (هر پوشه = یک مشتری؛ همه پروژه‌های او)
// ============================================================

interface FolderDTO {
  id: string;
  name: string;
  phone: string | null;
  createdAt: string;
  projectCount: number;
}

function serializeFolder(f: Folder & { _count?: { projects: number } }): FolderDTO {
  return {
    id: f.id,
    name: f.name,
    phone: f.phone,
    createdAt: f.createdAt.toISOString(),
    projectCount: f._count?.projects ?? 0,
  };
}

export async function GET(req: NextRequest) {
  const denied = await requireOwner(req);
  if (denied) return denied;

  try {
    const folders = await db.folder.findMany({
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { projects: true } } },
    });
    return NextResponse.json({ folders: folders.map(serializeFolder) });
  } catch (err) {
    console.error('GET /api/folders failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  phone: z.string().trim().max(60).optional(),
});

export async function POST(req: NextRequest) {
  const denied = await requireOwner(req);
  if (denied) return denied;

  try {
    const body = await readJsonBody(req);
    if (!body.ok) {
      return NextResponse.json({ error: 'داده ارسالی نامعتبر است' }, { status: 400 });
    }
    const parsed = createSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'نام مشتری را بین ۱ تا ۶۰ کاراکتر وارد کنید' },
        { status: 400 },
      );
    }

    // پوشه تکراری با همان نام → همان پوشه موجود برگرردد (پوشه = مشتری)
    const existing = await db.folder.findFirst({
      where: { name: parsed.data.name },
      include: { _count: { select: { projects: true } } },
    });
    if (existing) {
      return NextResponse.json({ folder: serializeFolder(existing), existed: true });
    }

    const folder = await db.folder.create({
      data: {
        name: parsed.data.name,
        ...(parsed.data.phone ? { phone: parsed.data.phone } : {}),
      },
      include: { _count: { select: { projects: true } } },
    });
    return NextResponse.json({ folder: serializeFolder(folder) }, { status: 201 });
  } catch (err) {
    console.error('POST /api/folders failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}
