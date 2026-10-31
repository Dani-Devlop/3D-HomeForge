import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getOwner } from '@/lib/auth';
import { readJsonBody } from '@/app/api/_lib/serialize';
import {
  hasSceneObjects,
  serializePortfolioItem,
  stringifyOrEmpty,
} from '@/app/api/_lib/portfolio';

// ============================================================
// GET    /api/portfolio/[id] → one portfolio item (admin only — for the model editor)
// PATCH  /api/portfolio/[id] → edit a portfolio item (admin only)
// DELETE /api/portfolio/[id] → delete a portfolio item (admin only)
// ============================================================

/** GET — read one portfolio item to edit its 3D model in the editor */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getOwner(req))) {
    return NextResponse.json(
      { error: 'You must be signed in as the admin for this operation' },
      { status: 401 },
    );
  }
  try {
    const { id } = await params;
    const item = await db.portfolioItem.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ error: 'Portfolio item not found' }, { status: 404 });
    }
    return NextResponse.json({ item: serializePortfolioItem(item) });
  } catch (err) {
    console.error('GET /api/portfolio/[id] failed:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

const MAX_IMAGE_CHARS = 6_000_000;

const CATEGORIES = ['kitchen', 'bedroom', 'living', 'office', 'other'] as const;

const looseObject = z.record(z.string(), z.unknown());

const patchSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(400).optional(),
  category: z.enum(CATEGORIES).optional(),
  image: z
    .string()
    .max(MAX_IMAGE_CHARS)
    .refine(
      (v) => v === '' || v.startsWith('data:image/') || v.startsWith('/'),
      'Image must be a dataURL or a public path',
    )
    .optional(),
  roomSpec: looseObject.optional(),
  sceneState: z
    .object({ objects: z.array(z.unknown()).max(400).optional().default([]) })
    .optional(),
  visible: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getOwner(req))) {
    return NextResponse.json(
      { error: 'You must be signed in as the admin for this operation' },
      { status: 401 },
    );
  }
  try {
    const { id } = await params;
    const existing = await db.portfolioItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Portfolio item not found' }, { status: 404 });
    }

    const body = await readJsonBody(req);
    if (!body.ok) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }
    const parsed = patchSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    // After applying the patch at least an image or a live 3D model must remain
    const nextImage = parsed.data.image ?? existing.image;
    const nextScene = parsed.data.sceneState
      ? { objects: parsed.data.sceneState.objects ?? [] }
      : parseExistingScene(existing.sceneState);
    if (nextImage.length < 8 && !hasSceneObjects(nextScene)) {
      return NextResponse.json(
        { error: 'At least an image or a live 3D model is required' },
        { status: 400 },
      );
    }

    const item = await db.portfolioItem.update({
      where: { id },
      data: {
        ...parsed.data,
        roomSpec: parsed.data.roomSpec ? stringifyOrEmpty(parsed.data.roomSpec) : undefined,
        sceneState: parsed.data.sceneState ? stringifyOrEmpty(nextScene) : undefined,
      },
    });
    return NextResponse.json({ item: serializePortfolioItem(item) });
  } catch (err) {
    console.error('PATCH /api/portfolio/[id] failed:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

function parseExistingScene(raw: string): { objects: unknown[] } {
  try {
    const v = JSON.parse(raw || '{}');
    if (v && typeof v === 'object' && Array.isArray((v as { objects?: unknown }).objects)) {
      return v as { objects: unknown[] };
    }
  } catch {
    // ignore
  }
  return { objects: [] };
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getOwner(req))) {
    return NextResponse.json(
      { error: 'You must be signed in as the admin for this operation' },
      { status: 401 },
    );
  }
  try {
    const { id } = await params;
    const existing = await db.portfolioItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Portfolio item not found' }, { status: 404 });
    }
    await db.portfolioItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/portfolio/[id] failed:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
