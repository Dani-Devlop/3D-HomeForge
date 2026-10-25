import { NextResponse } from 'next/server';
import type { ShareLink } from '@prisma/client';
import { db } from '@/lib/db';
import { verifyShareToken, type SharePayload } from '@/lib/share-token';
import { isFullToken } from '@/lib/share-code';

// ============================================================
// اعتبارسنجی مشترک توکن/کد لینک اشتراکی (برای resolve و ورود مهمان)
// توکن کامل: payload.signature — کد کوتاه: ۷ کاراکتر بدون نقطه
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
 * توکن امضاشده یا کد کوتاه را اعتبارسنجی می‌کند، ردیف ShareLink را می‌خواند
 * و فعال/منقضی‌نبودن را چک می‌کند. در صورت ناموفق بودن، پاسخ 403 آماده برمی‌گرداند.
 */
export async function checkShareToken(tokenOrCode: unknown): Promise<ShareTokenCheck> {
  if (typeof tokenOrCode !== 'string' || !tokenOrCode) {
    return { ok: false, response: invalidResponse() };
  }

  const value = tokenOrCode.trim();
  let link: ShareLink | null = null;

  if (isFullToken(value)) {
    // مسیر قدیمی — توکن کامل امضاشده
    const payload = verifyShareToken(value);
    if (!payload) return { ok: false, response: invalidResponse() };
    link = await db.shareLink.findUnique({ where: { id: payload.lid } });
    if (link && link.token !== value) link = null; // توکن باید دقیقاً همان توکن ذخیره‌شده باشد
  } else {
    // کد کوتاه — ردیف لینک مستقیماً پیدا می‌شود و توکن ذخیره‌شده امضاسنجی می‌شود
    const byCode = await db.shareLink.findUnique({ where: { shortCode: value } });
    if (!byCode) return { ok: false, response: invalidResponse() };
    const payload = verifyShareToken(byCode.token);
    if (!payload) return { ok: false, response: invalidResponse() };
    link = byCode;
  }

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

  // توکن ذخیره‌شده در ردیف همیشه امضای سالم دارد — payload از آن بازخوانی می‌شود
  const payload: SharePayload = verifyShareToken(link.token) ?? {
    lid: link.id,
    pid: link.projectId,
    role: link.role,
    exp: link.expiresAt.getTime(),
  };

  return { ok: true, payload, link };
}
