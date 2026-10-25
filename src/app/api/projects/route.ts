import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requireOwner } from '@/lib/auth';
import { serializeProject, readJsonBody, toDate } from '@/app/api/_lib/serialize';

// ============================================================
// /api/projects — فهرست و ساخت پروژه (فقط مدیر)
// GET ?folderId=<id> | ?folderId=none | ?q=<جست‌وجو>
// q در نام/نام مشتری/تلفن/آدرس جست‌وجو می‌شود؛ اگر q الگوی تاریخ
// YYYY-MM-DD یا YYYY/MM/DD باشد بازدید/اجرا/اتمام همان روز هم چک می‌شود
// ============================================================

const projectCount = {
  _count: { select: { shareLinks: true } },
  folder: { select: { name: true } },
} as const;

export async function GET(req: NextRequest) {
  const denied = await requireOwner(req);
  if (denied) return denied;

  try {
    const params = new URL(req.url).searchParams;
    const folderId = params.get('folderId');
    const q = (params.get('q') ?? '').trim();

    const folderFilter: Prisma.ProjectWhereInput | undefined =
      folderId === 'none'
        ? { folderId: null }
        : folderId
          ? { folderId }
          : undefined;

    let searchFilter: Prisma.ProjectWhereInput | undefined;
    if (q) {
      const contains = { contains: q };
      const or: Prisma.ProjectWhereInput[] = [
        { name: contains },
        { clientName: contains },
        { clientPhone: contains },
        { address: contains },
      ];

      // جست‌وجوی تاریخ: ۱۴۰۳-۰۵-۱۲ یا ۱۴۰۳/۰۵/۱۲ (میلادی) → بازدید/اجرا/اتمام همان روز
      const m = q.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
      if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = Number(m[3]);
        const dayStart = new Date(y, mo - 1, d);
        const dayEnd = new Date(y, mo - 1, d + 1);
        or.push(
          { visitAt: { gte: dayStart, lt: dayEnd } },
          { installAt: { gte: dayStart, lt: dayEnd } },
          { dueAt: { gte: dayStart, lt: dayEnd } },
        );
      }
      searchFilter = { OR: or };
    }

    // فیلتر پوشه و جست‌وجو با هم AND می‌شوند (کلیدهای متفاوت → spread کافی است)
    const where: Prisma.ProjectWhereInput | undefined =
      folderFilter || searchFilter ? { ...folderFilter, ...searchFilter } : undefined;

    const projects = await db.project.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: projectCount,
    });
    return NextResponse.json({ projects: projects.map(serializeProject) });
  } catch (err) {
    console.error('GET /api/projects failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}

const looseObject = z.record(z.string(), z.unknown());

const createSchema = z.object({
  name: z.string().min(1).max(80),
  roomType: z.string().min(1).optional(),
  roomSpec: looseObject.optional(),
  sceneState: looseObject.optional(),
  folderId: z.string().min(1).nullable().optional(),
  // CRM — مشخصات مشتری و زمان‌بندی
  clientName: z.string().max(80).optional(),
  clientPhone: z.string().max(30).optional(),
  address: z.string().max(300).optional(),
  visitAt: z.string().nullable().optional(),
  installAt: z.string().nullable().optional(),
  dueAt: z.string().nullable().optional(),
});

/** رشته خالی → null (پاک‌کردن فیلد) */
const toNullIfEmpty = (s: string): string | null => (s === '' ? null : s);

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
        { error: 'داده ارسالی نامعتبر است' },
        { status: 400 },
      );
    }
    const {
      name, roomType, roomSpec, sceneState, folderId,
      clientName, clientPhone, address, visitAt, installAt, dueAt,
    } = parsed.data;

    // پوشه ارسالی باید موجود باشد
    if (folderId) {
      const folder = await db.folder.findUnique({
        where: { id: folderId },
        select: { id: true },
      });
      if (!folder) {
        return NextResponse.json({ error: 'پوشه یافت نشد' }, { status: 400 });
      }
    }

    const project = await db.project.create({
      data: {
        name,
        ...(roomType !== undefined ? { roomType } : {}),
        ...(roomSpec !== undefined ? { roomSpec: JSON.stringify(roomSpec) } : {}),
        ...(sceneState !== undefined ? { sceneState: JSON.stringify(sceneState) } : {}),
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
    return NextResponse.json({ project: serializeProject(project) }, { status: 201 });
  } catch (err) {
    console.error('POST /api/projects failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}
