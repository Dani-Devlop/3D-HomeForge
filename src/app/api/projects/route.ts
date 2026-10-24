import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { serializeProject, readJsonBody } from '@/app/api/_lib/serialize';

// ============================================================
// /api/projects — فهرست و ساخت پروژه
// ============================================================

const projectCount = { _count: { select: { shareLinks: true } } } as const;

export async function GET() {
  try {
    const projects = await db.project.findMany({
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
});

export async function POST(req: NextRequest) {
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
    const { name, roomType, roomSpec, sceneState } = parsed.data;

    const project = await db.project.create({
      data: {
        name,
        ...(roomType !== undefined ? { roomType } : {}),
        ...(roomSpec !== undefined ? { roomSpec: JSON.stringify(roomSpec) } : {}),
        ...(sceneState !== undefined ? { sceneState: JSON.stringify(sceneState) } : {}),
      },
      include: projectCount,
    });
    return NextResponse.json({ project: serializeProject(project) }, { status: 201 });
  } catch (err) {
    console.error('POST /api/projects failed:', err);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}
