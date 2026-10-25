import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireOwner } from '@/lib/auth';

// ============================================================
// /api/projects/[id]/guests — همه مهمان‌های همه لینک‌های اشتراکی پروژه (فقط مدیر)
// ============================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireOwner(req);
  if (denied) return denied;

  try {
    const { id } = await params;
    const project = await db.project.findUnique({ where: { id }, select: { id: true } });
    if (!project) {
      return NextResponse.json({ error: 'پروژه یافت نشد' }, { status: 404 });
    }

    const guests = await db.guest.findMany({
      where: { shareLink: { projectId: id } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      guests: guests.map((g) => ({
        id: g.id,
        name: g.name,
        color: g.color,
        role: g.role,
        createdAt: g.createdAt.toISOString(),
        shareLinkId: g.shareLinkId,
      })),
    });
  } catch (err) {
    console.error('GET /api/projects/[id]/guests failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}
