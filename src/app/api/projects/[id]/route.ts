import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireOwner } from '@/lib/auth';
import { serializeProject, readJsonBody, toDate } from '@/app/api/_lib/serialize';

// ============================================================
// /api/projects/[id] — خواندن، ویرایش و حذف یک پروژه (فقط مدیر)
// PATCH شامل فیلدهای CRM: clientName/clientPhone/address/visitAt/installAt/dueAt
// ============================================================

const projectCount = {
  _count: { select: { shareLinks: true } },
  folder: { select: { name: true } },
} as const;

const looseObject = z.record(z.string(), z.unknown());

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  roomType: z.string().min(1).optional(),
  roomSpec: looseObject.optional(),
  sceneState: looseObject.optional(),
  thumbnail: z.string().nullable().optional(),
  isPublic: z.boolean().optional(),
  folderId: z.string().min(1).nullable().optional(),
  // CRM
  clientName: z.string().max(80).optional(),
  clientPhone: z.string().max(30).optional(),
  address: z.string().max(300).optional(),
  visitAt: z.string().nullable().optional(),
  installAt: z.string().nullable().optional(),
  dueAt: z.string().nullable().optional(),
});

/** رشته خالی → null (پاک‌کردن فیلد) */
const toNullIfEmpty = (s: string): string | null => (s === '' ? null : s);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireOwner(req);
  if (denied) return denied;

  try {
    const { id } = await params;
    const project = await db.project.findUnique({ where: { id }, include: projectCount });
    if (!project) {
      return NextResponse.json({ error: 'پروژه یافت نشد' }, { status: 404 });
    }
    return NextResponse.json({ project: serializeProject(project) });
  } catch (err) {
    console.error('GET /api/projects/[id] failed:', err);
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
      return NextResponse.json({ error: 'داده ارسالی نامعتبر است' }, { status: 400 });
    }
    const parsed = patchSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'داده ارسالی نامعتبر است' },
        { status: 400 },
      );
    }
    const {
      name, roomType, roomSpec, sceneState, thumbnail, isPublic, folderId,
      clientName, clientPhone, address, visitAt, installAt, dueAt,
    } = parsed.data;

    const existing = await db.project.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: 'پروژه یافت نشد' }, { status: 404 });
    }

    // null یعنی جداکردن از پوشه؛ مقدار غیرتهی باید موجود باشد
    if (folderId) {
      const folder = await db.folder.findUnique({
        where: { id: folderId },
        select: { id: true },
      });
      if (!folder) {
        return NextResponse.json({ error: 'پوشه یافت نشد' }, { status: 400 });
      }
    }

    const project = await db.project.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(roomType !== undefined ? { roomType } : {}),
        ...(roomSpec !== undefined ? { roomSpec: JSON.stringify(roomSpec) } : {}),
        ...(sceneState !== undefined ? { sceneState: JSON.stringify(sceneState) } : {}),
        ...(thumbnail !== undefined ? { thumbnail } : {}),
        ...(isPublic !== undefined ? { isPublic } : {}),
        ...(folderId !== undefined ? { folderId } : {}),
        ...(clientName !== undefined ? { clientName: toNullIfEmpty(clientName) } : {}),
        ...(clientPhone !== undefined ? { clientPhone: toNullIfEmpty(clientPhone) } : {}),
        ...(address !== undefined ? { address: toNullIfEmpty(address) } : {}),
        // رشته خالی/نامعتبر → null (پاک‌کردن تاریخ)
        ...(visitAt !== undefined ? { visitAt: toDate(visitAt) } : {}),
        ...(installAt !== undefined ? { installAt: toDate(installAt) } : {}),
        ...(dueAt !== undefined ? { dueAt: toDate(dueAt) } : {}),
      },
      include: projectCount,
    });
    return NextResponse.json({ project: serializeProject(project) });
  } catch (err) {
    console.error('PATCH /api/projects/[id] failed:', err);
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
    const existing = await db.project.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: 'پروژه یافت نشد' }, { status: 404 });
    }
    await db.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/projects/[id] failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}
