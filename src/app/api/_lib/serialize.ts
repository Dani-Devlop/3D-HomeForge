import type { Project } from '@prisma/client';
import type { NextRequest } from 'next/server';

// ============================================================
// هلپرهای مشترک سریالایز پاسخ‌های API
// ============================================================

/** خواندن امن بدنه JSON درخواست؛ بدنه غیرمعتبر → { ok: false } */
export async function readJsonBody(
  req: NextRequest,
): Promise<{ ok: true; data: unknown } | { ok: false }> {
  try {
    return { ok: true, data: await req.json() };
  } catch {
    return { ok: false };
  }
}

/** تلاش برای JSON.parse مقادیر رشته‌ای؛ در صورت خطا یا نبود رشته، fallback برمی‌گردد */
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

/** تبدیل امن رشته تاریخ به Date؛ خالی/نامعتبر → null (برای فیلدهای CRM پروژه) */
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
  // CRM — مشخصات مشتری و زمان‌بندی (ISO یا null)
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

/** پروژه را به آبجکت ساده قابل JSON.stringify تبدیل می‌کند (roomSpec/sceneState پارس‌شده) */
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
