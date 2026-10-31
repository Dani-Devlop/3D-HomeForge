import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============================================================
// Admin (app owner) authentication
// - The admin password (sha256 hash) and the session signing key are stored in the Setting table.
// - Session token: `${expMs}.${hmacSHA256(expMs, session_key)}` — lightweight and compact
// - httpOnly cookie named c3d_admin
// Initial default password: admin1234 (seeded on first check)
// ============================================================

export const OWNER_COOKIE = 'c3d_admin';

const SESSION_DAYS = 30;
const SESSION_MAX_AGE_SEC = SESSION_DAYS * 24 * 60 * 60;
// Temporary default password per user request: admin (until changed from the admin panel)
const DEFAULT_PASSWORD = 'admin';

// ---------------- Setting table helpers ----------------

async function getSetting(key: string): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  await db.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export const sha256 = (s: string): string =>
  crypto.createHash('sha256').update(s).digest('hex');

/** One-time idempotent seed: default password hash + random 48-char session key */
export async function ensureAdminSettings(): Promise<void> {
  if ((await getSetting('admin_pass')) === null) {
    await setSetting('admin_pass', sha256(DEFAULT_PASSWORD));
  }
  if ((await getSetting('session_key')) === null) {
    await setSetting('session_key', crypto.randomBytes(24).toString('hex'));
  }
}

async function getSessionKey(): Promise<string> {
  await ensureAdminSettings();
  const key = await getSetting('session_key');
  // In practice ensure always creates it; this is only for typing
  return key ?? crypto.randomBytes(24).toString('hex');
}

// ---------------- Admin password ----------------

export async function verifyPassword(pw: string): Promise<boolean> {
  await ensureAdminSettings();
  const stored = await getSetting('admin_pass');
  if (!stored) return false;
  const hash = sha256(pw);
  const a = Buffer.from(hash);
  const b = Buffer.from(stored);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Change password — minimum 4 chars; false means the password is too short */
export async function setPassword(pw: string): Promise<boolean> {
  if (pw.length < 4) return false;
  await setSetting('admin_pass', sha256(pw));
  return true;
}

// ---------------- Session (HMAC) ----------------

/** Create a session token: `${expMs}.${hmac(expMs)}` */
export async function createSession(days = SESSION_DAYS): Promise<{ token: string; maxAgeSec: number }> {
  const key = await getSessionKey();
  const exp = Date.now() + days * 24 * 60 * 60 * 1000;
  const expStr = String(exp);
  const sig = crypto.createHmac('sha256', key).update(expStr).digest('hex');
  return { token: `${expStr}.${sig}`, maxAgeSec: SESSION_MAX_AGE_SEC };
}

/** Verify the signature + expiry of a session token */
export async function verifySessionToken(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const expStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const exp = Number.parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const key = await getSessionKey();
  const expected = crypto.createHmac('sha256', key).update(expStr).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------------- Owner guard ----------------

export async function getOwner(req: NextRequest): Promise<boolean> {
  return verifySessionToken(req.cookies.get(OWNER_COOKIE)?.value);
}

/** null means allowed; otherwise a ready-to-return 401 response */
export async function requireOwner(req: NextRequest): Promise<NextResponse | null> {
  if (await getOwner(req)) return null;
  return NextResponse.json(
    { error: 'You must be signed in as an admin for this action' },
    { status: 401 },
  );
}

export async function setOwnerCookie(res: NextResponse): Promise<void> {
  const { token, maxAgeSec } = await createSession();
  res.cookies.set({
    name: OWNER_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSec,
  });
}

export function clearOwnerCookie(res: NextResponse): void {
  res.cookies.set({
    name: OWNER_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
