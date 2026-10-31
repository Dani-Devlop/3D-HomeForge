import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireOwner } from '@/lib/auth';
import { serializeProject, readJsonBody, toDate } from '@/app/api/_lib/serialize';
import { isProjectStage } from '@/lib/crm';

// ============================================================
// /api/projects/[id] — read, edit and delete one project (admin only)
// PATCH includes the CRM fields: clientName/clientPhone/address/stage/dealAt/
// contractAmount/contractPhoto/invoicePhoto/visitAt/installAt/dueAt
// ============================================================

const projectCount = {
  _count: { select: { shareLinks: true } },
  folder: { select: { name: true } },
} as const;

const looseObject = z.record(z.string(), z.unknown());

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  roomType: z.string().min(1).optional(),
  roomSpec: looseObject.optional(),
  sceneState: looseObject.optional(),
  thumbnail: z.string().nullable().optional(),
  isPublic: z.boolean().optional(),
  folderId: z.string().min(1).nullable().optional(),
  // CRM
  clientName: z.string().max(80).optional(),
  clientPhone: z.string().max(60).optional(),
  address: z.string().max(300).optional(),
  stage: z.string().refine(isProjectStage, 'Invalid project stage').optional(),
  dealAt: z.string().nullable().optional(),
  contractAmount: z.number().min(0).max(1e12).nullable().optional(),
  contractPhoto: z
    .string()
    .max(4_000_000)
    .refine((v) => v === '' || v.startsWith('data:image/'), 'Contract photo must be an image dataURL')
    .nullable()
    .optional(),
  invoicePhoto: z
    .string()
    .max(4_000_000)
    .refine((v) => v === '' || v.startsWith('data:image/'), 'Invoice photo must be an image dataURL')
    .nullable()
    .optional(),
  visitAt: z.string().nullable().optional(),
  installAt: z.string().nullable().optional(),
  dueAt: z.string().nullable().optional(),
});

/** Empty string → null (clears the field) */
const toNullIfEmpty = (s: string): string | null => (s === '' ? null : s);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireOwner(req);
  if (denied) return denied;

  try {
    const { id } = await params;
    const project = await db.project.findUnique({ where: { id }, include: projectCount });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json({ project: serializeProject(project) });
  } catch (err) {
    console.error('GET /api/projects/[id] failed:', err);
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
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }
    const parsed = patchSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 },
      );
    }
    const {
      name, roomType, roomSpec, sceneState, thumbnail, isPublic, folderId,
      clientName, clientPhone, address, stage, dealAt,
      contractAmount, contractPhoto, invoicePhoto,
      visitAt, installAt, dueAt,
    } = parsed.data;

    const existing = await db.project.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // null means detaching from the folder; a non-null value must exist
    if (folderId) {
      const folder = await db.folder.findUnique({
        where: { id: folderId },
        select: { id: true },
      });
      if (!folder) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 400 });
      }
    }

    const project = await db.project.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(roomType !== undefined ? { roomType } : {}),
        ...(roomSpec !== undefined ? { roomSpec: JSON.stringify(roomSpec) } : {}),
        ...(sceneState !== undefined ? { sceneState: JSON.stringify(sceneState) } : {}),
        ...(thumbnail !== undefined ? { thumbnail } : {}),
        ...(isPublic !== undefined ? { isPublic } : {}),
        ...(folderId !== undefined ? { folderId } : {}),
        ...(clientName !== undefined ? { clientName: toNullIfEmpty(clientName) } : {}),
        ...(clientPhone !== undefined ? { clientPhone: toNullIfEmpty(clientPhone) } : {}),
        ...(address !== undefined ? { address: toNullIfEmpty(address) } : {}),
        ...(stage !== undefined ? { stage } : {}),
        ...(dealAt !== undefined ? { dealAt: toDate(dealAt) } : {}),
        ...(contractAmount !== undefined ? { contractAmount } : {}),
        ...(contractPhoto !== undefined
          ? { contractPhoto: !contractPhoto ? null : contractPhoto }
          : {}),
        ...(invoicePhoto !== undefined
          ? { invoicePhoto: !invoicePhoto ? null : invoicePhoto }
          : {}),
        // Empty/invalid string → null (clears the date)
        ...(visitAt !== undefined ? { visitAt: toDate(visitAt) } : {}),
        ...(installAt !== undefined ? { installAt: toDate(installAt) } : {}),
        ...(dueAt !== undefined ? { dueAt: toDate(dueAt) } : {}),
      },
      include: projectCount,
    });
    return NextResponse.json({ project: serializeProject(project) });
  } catch (err) {
    console.error('PATCH /api/projects/[id] failed:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireOwner(req);
  if (denied) return denied;

  try {
    const { id } = await params;
    const existing = await db.project.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    await db.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/projects/[id] failed:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
