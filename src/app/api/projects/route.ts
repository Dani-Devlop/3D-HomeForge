import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requireOwner } from '@/lib/auth';
import { serializeProject, readJsonBody, toDate } from '@/app/api/_lib/serialize';
import { isProjectStage } from '@/lib/crm';

// ============================================================
// /api/projects — list and create projects (admin only)
// GET ?folderId=<id> | ?folderId=none | ?q=<search>
// q searches name/client name/phone/address; if q matches a date pattern
// YYYY-MM-DD or YYYY/MM/DD, the visit/install/due dates of that day are checked too
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

      // Date search: 2024-05-12 or 2024/05/12 (Gregorian) → visit/install/due of the same day
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

    // Folder filter and search are ANDed together (different keys → spreading is enough)
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
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

const looseObject = z.record(z.string(), z.unknown());

const MAX_PHOTO_CHARS = 4_000_000; // ~3MB after base64

const createSchema = z.object({
  name: z.string().min(1).max(80),
  roomType: z.string().min(1).optional(),
  roomSpec: looseObject.optional(),
  sceneState: looseObject.optional(),
  folderId: z.string().min(1).nullable().optional(),
  // CRM — client details, progress stage and deal info
  clientName: z.string().max(80).optional(),
  clientPhone: z.string().max(60).optional(),
  address: z.string().max(300).optional(),
  stage: z.string().refine(isProjectStage, 'Invalid project stage').optional(),
  dealAt: z.string().nullable().optional(),
  contractAmount: z.number().min(0).max(1e12).nullable().optional(),
  contractPhoto: z.string().max(MAX_PHOTO_CHARS).refine((v) => v === '' || v.startsWith('data:image/'), 'Contract photo must be an image dataURL').nullable().optional(),
  invoicePhoto: z.string().max(MAX_PHOTO_CHARS).refine((v) => v === '' || v.startsWith('data:image/'), 'Invoice photo must be an image dataURL').nullable().optional(),
  visitAt: z.string().nullable().optional(),
  installAt: z.string().nullable().optional(),
  dueAt: z.string().nullable().optional(),
});

/** Empty string → null (clears the field) */
const toNullIfEmpty = (s: string): string | null => (s === '' ? null : s);

export async function POST(req: NextRequest) {
  const denied = await requireOwner(req);
  if (denied) return denied;

  try {
    const body = await readJsonBody(req);
    if (!body.ok) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }
    const parsed = createSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 },
      );
    }
    const {
      name, roomType, roomSpec, sceneState, folderId,
      clientName, clientPhone, address, stage, dealAt,
      contractAmount, contractPhoto, invoicePhoto,
      visitAt, installAt, dueAt,
    } = parsed.data;

    /** Empty image string → null (removes the photo) */
    const photoOrNull = (s?: string | null): string | null | undefined =>
      s === undefined ? undefined : !s ? null : s;

    // The sent folder must exist
    if (folderId) {
      const folder = await db.folder.findUnique({
        where: { id: folderId },
        select: { id: true },
      });
      if (!folder) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 400 });
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
        ...(stage !== undefined ? { stage } : {}),
        ...(dealAt !== undefined ? { dealAt: toDate(dealAt) } : {}),
        ...(contractAmount !== undefined ? { contractAmount } : {}),
        ...(contractPhoto !== undefined ? { contractPhoto: photoOrNull(contractPhoto) } : {}),
        ...(invoicePhoto !== undefined ? { invoicePhoto: photoOrNull(invoicePhoto) } : {}),
        // Empty/invalid string → null (clears the date)
        ...(visitAt !== undefined ? { visitAt: toDate(visitAt) } : {}),
        ...(installAt !== undefined ? { installAt: toDate(installAt) } : {}),
        ...(dueAt !== undefined ? { dueAt: toDate(dueAt) } : {}),
      },
      include: projectCount,
    });
    return NextResponse.json({ project: serializeProject(project) }, { status: 201 });
  } catch (err) {
    console.error('POST /api/projects failed:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
