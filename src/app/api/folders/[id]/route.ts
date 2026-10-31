import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Folder } from '@prisma/client';
import { db } from '@/lib/db';
import { requireOwner } from '@/lib/auth';
import { readJsonBody } from '@/app/api/_lib/serialize';

// ============================================================
// /api/folders/[id] — edit (client name/phone) and delete a client folder
// (deleting a folder does not delete its projects; their folderId is nulled via SetNull)
// ============================================================

function serializeFolder(f: Folder & { _count?: { projects: number } }) {
  return {
    id: f.id,
    name: f.name,
    phone: f.phone,
    createdAt: f.createdAt.toISOString(),
    projectCount: f._count?.projects ?? 0,
  };
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  phone: z.string().trim().max(60).nullable().optional(),
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
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }
    const parsed = patchSchema.safeParse(body.data);
    if (!parsed.success || (!parsed.data.name && parsed.data.phone === undefined)) {
      return NextResponse.json(
        { error: 'Enter a client name between 1 and 60 characters' },
        { status: 400 },
      );
    }

    const existing = await db.folder.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    const folder = await db.folder.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone || null } : {}),
      },
      include: { _count: { select: { projects: true } } },
    });
    return NextResponse.json({ folder: serializeFolder(folder) });
  } catch (err) {
    console.error('PATCH /api/folders/[id] failed:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
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
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }
    await db.folder.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/folders/[id] failed:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
