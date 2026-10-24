import { NextResponse } from 'next/server';
import type { ShareLink } from '@prisma/client';
import { db } from '@/lib/db';
import { verifyShareToken, type SharePayload } from '@/lib/share-token';

// ============================================================
// اعتبارسنجی مشترک توکن لینک اشتراکی (برای resolve و ورود مهمان)
// ============================================================

export type ShareTokenCheck =
  | { ok: true; payload: SharePayload; link: ShareLink }
  | { ok: false; response: NextResponse };

const invalidResponse = () =>
  NextResponse.json(
    { ok: false, error: 'لینک نامعتبر یا منقضی است' },
    { status: 403 },
  );

/**
 * توکن را امضاسنجی می‌کند، ردیف ShareLink را می‌خواند و فعال/منقضی‌نبودن را چک می‌کند.
 * در صورت ناموفق بودن، پاسخ 403 آماده برمی‌گرداند.
 */
export async function checkShareToken(token: unknown): Promise<ShareTokenCheck> {
  if (typeof token !== 'string' || !token) return { ok: false, response: invalidResponse() };

  const payload = verifyShareToken(token);
  if (!payload) return { ok: false, response: invalidResponse() };

  const link = await db.shareLink.findUnique({ where: { id: payload.lid } });
  if (!link || !link.active) return { ok: false, response: invalidResponse() };

  // انقضای ذخیره‌شده در دیتابیس هم مستقلاً چک می‌شود
  if (link.expiresAt.getTime() < Date.now()) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'لینک منقضی شده است' },
        { status: 403 },
      ),
    };
  }

  return { ok: true, payload, link };
}
