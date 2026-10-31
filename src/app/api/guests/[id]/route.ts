import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireOwner } from '@/lib/auth';
import { isValidRole } from '@/lib/scene-types';
import { readJsonBody } from '@/app/api/_lib/serialize';

// ============================================================
// /api/guests/[id] — guest presence (heartbeat) and role change
// GET is public but the response only contains {id,name,color,role} (no shareLinkId)
// PATCH is admin only
// ============================================================

const patchSchema = z.object({ role: z.unknown() });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const guest = await db.guest.findUnique({ where: { id } });
    if (!guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }
    await db.guest.update({ where: { id }, data: { lastSeenAt: new Date() } });
    // Limited response — no shareLinkId
    return NextResponse.json({
      guest: {
        id: guest.id,
        name: guest.name,
        color: guest.color,
        role: guest.role,
      },
    });
  } catch (err) {
    console.error('GET /api/guests/[id] failed:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
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
      return NextResponse.json(
        { error: 'Role must be viewer or modifier' },
        { status: 400 },
      );
    }
    const parsed = patchSchema.safeParse(body.data);
    if (!parsed.success || !isValidRole(parsed.data.role)) {
      return NextResponse.json(
        { error: 'Role must be viewer or modifier' },
        { status: 400 },
      );
    }

    const existing = await db.guest.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    const guest = await db.guest.update({
      where: { id },
      data: { role: parsed.data.role },
    });
    return NextResponse.json({
      guest: {
        id: guest.id,
        name: guest.name,
        color: guest.color,
        role: guest.role,
      },
    });
  } catch (err) {
    console.error('PATCH /api/guests/[id] failed:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
