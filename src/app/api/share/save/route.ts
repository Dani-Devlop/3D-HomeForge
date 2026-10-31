import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { checkShareToken } from '@/app/api/_lib/share-guard';
import { readJsonBody } from '@/app/api/_lib/serialize';

// ============================================================
// POST /api/share/save — scene autosave by an editor guest
// (public but protected by the share-link token; modifier role only)
// ============================================================

const saveSchema = z.object({
  token: z.string().min(1),
  guestId: z.string().min(1),
  sceneState: z.object({ objects: z.array(z.unknown()) }),
});

const MAX_OBJECTS = 400;

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody(req);
    if (!body.ok) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }
    const parsed = saveSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }
    const { token, guestId, sceneState } = parsed.data;

    if (sceneState.objects.length > MAX_OBJECTS) {
      return NextResponse.json(
        { error: `At most ${MAX_OBJECTS} objects can be saved` },
        { status: 400 },
      );
    }

    // Validate the share-link token (403 when invalid)
    const check = await checkShareToken(token);
    if (!check.ok) return check.response;
    const { link } = check;

    // The guest must belong to this same link
    const guest = await db.guest.findFirst({
      where: { id: guestId, shareLinkId: link.id },
      select: { id: true },
    });
    if (!guest) {
      return NextResponse.json({ error: 'Guest not recognized' }, { status: 403 });
    }

    // Only editor links are allowed to save
    if (link.role !== 'modifier') {
      return NextResponse.json({ error: 'This link does not have edit access' }, { status: 403 });
    }

    const now = new Date();
    await db.$transaction([
      db.project.update({
        where: { id: link.projectId },
        data: { sceneState: JSON.stringify({ objects: sceneState.objects }) },
      }),
      db.guest.update({ where: { id: guest.id }, data: { lastSeenAt: now } }),
    ]);

    return NextResponse.json({ ok: true, updatedAt: now.toISOString() });
  } catch (err) {
    console.error('POST /api/share/save failed:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
