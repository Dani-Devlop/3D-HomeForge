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
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
  if (p._count) out.shareCount = p._count.shareLinks;
  return out;
}
