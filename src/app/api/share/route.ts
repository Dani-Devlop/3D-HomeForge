import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { signShareToken } from '@/lib/share-token';
import { generateShortCode } from '@/lib/share-code';
import { requireOwner } from '@/lib/auth';
import { isValidRole } from '@/lib/scene-types';
import { readJsonBody } from '@/app/api/_lib/serialize';

// ============================================================
// /api/share — ساخت، فهرست و ویرایش لینک‌های اشتراکی
// ============================================================

interface LinkPayload {
  id: string;
  token: string;
  shortCode?: string | null;
  role: string;
  active: boolean;
  expiresAt: string;
  createdAt?: string;
  guestCount?: number;
}

const serializeLink = (link: {
  id: string;
  token: string;
  shortCode?: string | null;
  role: string;
  active: boolean;
  expiresAt: Date;
  createdAt: Date;
  _count?: { guests: number };
}): LinkPayload => ({
  id: link.id,
  token: link.token,
  shortCode: link.shortCode ?? null,
  role: link.role,
  active: link.active,
  expiresAt: link.expiresAt.toISOString(),
  createdAt: link.createdAt.toISOString(),
  ...(link._count ? { guestCount: link._count.guests } : {}),
});

/** کد کوتاه یکتا تولید می‌کند (چک برخورد در دیتابیس) */
async function allocateShortCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateShortCode();
    const exists = await db.shareLink.findUnique({ where: { shortCode: code }, select: { id: true } });
    if (!exists) return code;
  }
  // احتمال بسیار ناچیز — کد بلندتر
  return generateShortCode(10);
}

const createSchema = z.object({
  projectId: z.string().min(1),
  role: z.unknown().optional(),
  expiresInDays: z.number().int().min(1).max(90).optional(),
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
      return NextResponse.json({ error: 'داده ارسالی نامعتبر است' }, { status: 400 });
    }
    const { projectId } = parsed.data;
    const role = parsed.data.role === undefined ? 'viewer' : parsed.data.role;
    if (!isValidRole(role)) {
      return NextResponse.json({ error: 'نقش باید viewer یا modifier باشد' }, { status: 400 });
    }
    const days = parsed.data.expiresInDays ?? 7;

    const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) {
      return NextResponse.json({ error: 'پروژه یافت نشد' }, { status: 404 });
    }

    const exp = Date.now() + days * 86400000;
    const id = crypto.randomUUID();
    const shortCode = await allocateShortCode();
    const link = await db.shareLink.create({
      data: {
        id,
        token: signShareToken({ lid: id, pid: projectId, role, exp }),
        shortCode,
        role,
        expiresAt: new Date(exp),
        projectId,
      },
    });
    return NextResponse.json({ link: serializeLink(link) }, { status: 201 });
  } catch (err) {
    console.error('POST /api/share failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const denied = await requireOwner(req);
  if (denied) return denied;

  try {
    const projectId = req.nextUrl.searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'شناسه پروژه الزامی است' }, { status: 400 });
    }
    const links = await db.shareLink.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { guests: true } } },
    });
    // بک‌فیل کد کوتاه برای لینک‌های قدیمیِ فاقد کد — یک‌بارمصرف و ماندگار
    const missing = links.filter((l) => !l.shortCode);
    if (missing.length > 0) {
      await Promise.all(
        missing.map(async (l) => {
          try {
            await db.shareLink.update({
              where: { id: l.id },
              data: { shortCode: await allocateShortCode() },
            });
            l.shortCode = await db.shareLink
              .findUnique({ where: { id: l.id }, select: { shortCode: true } })
              .then((r) => r?.shortCode ?? null);
          } catch {
            // برخورد unique — بی‌خطر؛ دفعه بعد دوباره تلاش می‌شود
          }
        }),
      );
    }
    return NextResponse.json({ links: links.map(serializeLink) });
  } catch (err) {
    console.error('GET /api/share failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  active: z.boolean().optional(),
  role: z.unknown().optional(),
});

export async function PATCH(req: NextRequest) {
  const denied = await requireOwner(req);
  if (denied) return denied;

  try {
    const body = await readJsonBody(req);
    if (!body.ok) {
      return NextResponse.json({ error: 'داده ارسالی نامعتبر است' }, { status: 400 });
    }
    const parsed = patchSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json({ error: 'داده ارسالی نامعتبر است' }, { status: 400 });
    }
    const { id, active, role } = parsed.data;
    if (role !== undefined && !isValidRole(role)) {
      return NextResponse.json({ error: 'نقش باید viewer یا modifier باشد' }, { status: 400 });
    }

    const existing = await db.shareLink.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: 'لینک یافت نشد' }, { status: 404 });
    }

    const link = await db.shareLink.update({
      where: { id },
      data: {
        ...(active !== undefined ? { active } : {}),
        ...(role !== undefined ? { role } : {}),
      },
    });
    return NextResponse.json({ link: serializeLink(link) });
  } catch (err) {
    console.error('PATCH /api/share failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}
