import { NextResponse } from 'next/server';
import type { ShareLink } from '@prisma/client';
import { db } from '@/lib/db';
import { verifyShareToken, type SharePayload } from '@/lib/share-token';
import { isFullToken } from '@/lib/share-code';

// ============================================================
// Shared validation of the share-link token/code (for resolve and guest sign-in)
// Full token: payload.signature — short code: 7 characters without a dot
// ============================================================

export type ShareTokenCheck =
  | { ok: true; payload: SharePayload; link: ShareLink }
  | { ok: false; response: NextResponse };

const invalidResponse = () =>
  NextResponse.json(
    { ok: false, error: 'Invalid or expired link' },
    { status: 403 },
  );

/**
 * Validates a signed token or short code, reads the ShareLink row
 * and checks that it is active and not expired. On failure returns a ready 403 response.
 */
export async function checkShareToken(tokenOrCode: unknown): Promise<ShareTokenCheck> {
  if (typeof tokenOrCode !== 'string' || !tokenOrCode) {
    return { ok: false, response: invalidResponse() };
  }

  const value = tokenOrCode.trim();
  let link: ShareLink | null = null;

  if (isFullToken(value)) {
    // Legacy path — full signed token
    const payload = verifyShareToken(value);
    if (!payload) return { ok: false, response: invalidResponse() };
    link = await db.shareLink.findUnique({ where: { id: payload.lid } });
    if (link && link.token !== value) link = null; // The token must exactly match the stored token
  } else {
    // Short code — the link row is found directly and the stored token is signature-verified
    const byCode = await db.shareLink.findUnique({ where: { shortCode: value } });
    if (!byCode) return { ok: false, response: invalidResponse() };
    const payload = verifyShareToken(byCode.token);
    if (!payload) return { ok: false, response: invalidResponse() };
    link = byCode;
  }

  if (!link || !link.active) return { ok: false, response: invalidResponse() };

  // The expiry stored in the database is checked independently as well
  if (link.expiresAt.getTime() < Date.now()) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Link has expired' },
        { status: 403 },
      ),
    };
  }

  // The token stored in the row always has a valid signature — the payload is re-read from it
  const payload: SharePayload = verifyShareToken(link.token) ?? {
    lid: link.id,
    pid: link.projectId,
    role: link.role,
    exp: link.expiresAt.getTime(),
  };

  return { ok: true, payload, link };
}
