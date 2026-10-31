import type { Project } from '@prisma/client';
import type { NextRequest } from 'next/server';

// ============================================================
// Shared helpers for serializing API responses
// ============================================================

/** Safely reads the request JSON body; invalid body → { ok: false } */
export async function readJsonBody(
  req: NextRequest,
): Promise<{ ok: true; data: unknown } | { ok: false }> {
  try {
    return { ok: true, data: await req.json() };
  } catch {
    return { ok: false };
  }
}

/** Attempts JSON.parse on string values; on error or non-string returns the fallback */
export function parseJsonSafe(value: string | unknown, fallback: unknown): unknown {
  if (typeof value !== 'string') {
    return value === undefined || value === null ? fallback : value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** Safely converts a date string to Date; empty/invalid → null (for project CRM fields) */
export function toDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface SerializedProject {
  id: string;
  name: string;
  roomType: string;
  roomSpec: unknown;
  sceneState: unknown;
  thumbnail: string | null;
  isPublic: boolean;
  folderId: string | null;
  folderName: string | null;
  // CRM — client details and schedule (ISO or null)
  clientName: string | null;
  clientPhone: string | null;
  address: string | null;
  stage: string;
  dealAt: string | null;
  contractAmount: number | null;
  contractPhoto: string | null;
  invoicePhoto: string | null;
  visitAt: string | null;
  installAt: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  shareCount?: number;
}

/** Converts a project into a plain JSON-serializable object (roomSpec/sceneState parsed) */
export function serializeProject(
  p: Project & {
    _count?: { shareLinks: number };
    folder?: { name: string } | null;
  },
): SerializedProject {
  const out: SerializedProject = {
    id: p.id,
    name: p.name,
    roomType: p.roomType,
    roomSpec: parseJsonSafe(p.roomSpec, {}),
    sceneState: parseJsonSafe(p.sceneState, {}),
    thumbnail: p.thumbnail,
    isPublic: p.isPublic,
    folderId: p.folderId,
    folderName: p.folder?.name ?? null,
    clientName: p.clientName,
    clientPhone: p.clientPhone,
    address: p.address,
    stage: p.stage,
    dealAt: p.dealAt ? p.dealAt.toISOString() : null,
    contractAmount: p.contractAmount ?? null,
    contractPhoto: p.contractPhoto,
    invoicePhoto: p.invoicePhoto,
    visitAt: p.visitAt ? p.visitAt.toISOString() : null,
    installAt: p.installAt ? p.installAt.toISOString() : null,
    dueAt: p.dueAt ? p.dueAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
  if (p._count) out.shareCount = p._count.shareLinks;
  return out;
}
