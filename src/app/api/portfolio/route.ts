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
// Portfolio items (public landing page) — image or live 3D model
// GET  /api/portfolio          → visible items only (public, ordered by sortOrder then newest)
// GET  /api/portfolio?all=1    → all items (admin only)
// POST /api/portfolio          → create a new item (admin only)
// ============================================================

const MAX_IMAGE_CHARS = 6_000_000; // ~4.5MB binary in the dataURL

const CATEGORIES = ['kitchen', 'bedroom', 'living', 'office', 'other'] as const;

const looseObject = z.record(z.string(), z.unknown());

const itemSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    description: z.string().trim().max(400).optional().default(''),
    category: z.enum(CATEGORIES).optional().default('kitchen'),
    image: z
      .string()
      .max(MAX_IMAGE_CHARS)
      .refine(
        (v) => v === '' || v.startsWith('data:image/') || v.startsWith('/'),
        'Image must be a dataURL or a public path',
      )
      .optional()
      .default(''),
    roomSpec: looseObject.optional(),
    sceneState: z
      .object({ objects: z.array(z.unknown()).max(400).optional().default([]) })
      .optional(),
    visible: z.boolean().optional().default(true),
    sortOrder: z.number().int().min(0).max(9999).optional(),
  })
  .refine(
    (v) => v.image.length >= 8 || hasSceneObjects(v.sceneState),
    { message: 'An image or a live 3D model is required' },
  );

export async function GET(req: NextRequest) {
  try {
    const all = req.nextUrl.searchParams.get('all') === '1';
    if (all && !(await getOwner(req))) {
      return NextResponse.json(
        { error: 'You must be signed in as the admin for this operation' },
        { status: 401 },
      );
    }
    const items = await db.portfolioItem.findMany({
      where: all ? undefined : { visible: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json({ items: items.map(serializePortfolioItem) });
  } catch (err) {
    console.error('GET /api/portfolio failed:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await getOwner(req))) {
    return NextResponse.json(
      { error: 'You must be signed in as the admin for this operation' },
      { status: 401 },
    );
  }
  try {
    const body = await readJsonBody(req);
    if (!body.ok) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }
    const parsed = itemSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Portfolio item info is incomplete (title + image or 3D model required)' },
        { status: 400 },
      );
    }
    // Default order: end of the list
    const last = await db.portfolioItem.aggregate({ _max: { sortOrder: true } });
    const sortOrder = parsed.data.sortOrder ?? (last._max.sortOrder ?? 0) + 1;

    const item = await db.portfolioItem.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        category: parsed.data.category,
        image: parsed.data.image,
        roomSpec: stringifyOrEmpty(parsed.data.roomSpec),
        sceneState: stringifyOrEmpty(parsed.data.sceneState),
        visible: parsed.data.visible,
        sortOrder,
      },
    });
    return NextResponse.json({ item: serializePortfolioItem(item) }, { status: 201 });
  } catch (err) {
    console.error('POST /api/portfolio failed:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
