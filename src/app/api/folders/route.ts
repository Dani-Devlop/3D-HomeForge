import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Folder } from '@prisma/client';
import { db } from '@/lib/db';
import { readJsonBody } from '@/app/api/_lib/serialize';

// ============================================================
// /api/folders — فهرست و ساخت پوشه (هر پوشه = یک خانه/آشپزخانه)
// ============================================================

interface FolderDTO {
  id: string;
  name: string;
  createdAt: string;
  projectCount: number;
}

function serializeFolder(f: Folder & { _count?: { projects: number } }): FolderDTO {
  return {
    id: f.id,
    name: f.name,
    createdAt: f.createdAt.toISOString(),
    projectCount: f._count?.projects ?? 0,
  };
}

export async function GET() {
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
});

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody(req);
    if (!body.ok) {
      return NextResponse.json({ error: 'داده ارسالی نامعتبر است' }, { status: 400 });
    }
    const parsed = createSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'نام پوشه را بین ۱ تا ۶۰ کاراکتر وارد کنید' },
        { status: 400 },
      );
    }

    const folder = await db.folder.create({
      data: { name: parsed.data.name },
      include: { _count: { select: { projects: true } } },
    });
    return NextResponse.json({ folder: serializeFolder(folder) }, { status: 201 });
  } catch (err) {
    console.error('POST /api/folders failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}
