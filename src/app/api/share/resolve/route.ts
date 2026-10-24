import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseJsonSafe } from '@/app/api/_lib/serialize';
import { checkShareToken } from '@/app/api/_lib/share-guard';

// ============================================================
// /api/share/resolve?token=... — باز کردن لینک اشتراکی برای مهمان
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    const check = await checkShareToken(token);
    if (!check.ok) return check.response;

    const { payload, link } = check;
    if (link.projectId !== payload.pid) {
      return NextResponse.json(
        { ok: false, error: 'لینک نامعتبر یا منقضی است' },
        { status: 403 },
      );
    }

    const project = await db.project.findUnique({ where: { id: link.projectId } });
    if (!project) {
      return NextResponse.json({ ok: false, error: 'پروژه یافت نشد' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      project: {
        id: project.id,
        name: project.name,
        roomType: project.roomType,
        roomSpec: parseJsonSafe(project.roomSpec, {}),
        sceneState: parseJsonSafe(project.sceneState, {}),
      },
      link: {
        id: link.id,
        role: link.role,
        expiresAt: link.expiresAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('GET /api/share/resolve failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}
