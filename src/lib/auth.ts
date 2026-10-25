import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============================================================
// احراز هویت مدیر (مالک برنامه)
// - رمز مدیر (هش sha256) و کلید امضای نشست در جدول Setting ذخیره می‌شوند.
// - توکن نشست: `${expMs}.${hmacSHA256(expMs, session_key)}` — سبک و فشرده
// - کوکی httpOnly با نام c3d_admin
// رمز پیش‌فرض اولیه: admin1234 (با اولین چک seed می‌شود)
// ============================================================

export const OWNER_COOKIE = 'c3d_admin';

const SESSION_DAYS = 30;
const SESSION_MAX_AGE_SEC = SESSION_DAYS * 24 * 60 * 60;
// رمز پیش‌فرض موقت طبق درخواست کاربر: admin (تا تغییر از پنل مدیریت)
const DEFAULT_PASSWORD = 'admin';

// ---------------- هلپرهای جدول Setting ----------------

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

/** seed یک‌باره و idempotent: هش رمز پیش‌فرض + کلید نشست تصادفی ۴۸ کاراکتری */
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
  // عملاً ensure همیشه می‌سازد؛ این فقط برای تایپ است
  return key ?? crypto.randomBytes(24).toString('hex');
}

// ---------------- رمز مدیر ----------------

export async function verifyPassword(pw: string): Promise<boolean> {
  await ensureAdminSettings();
  const stored = await getSetting('admin_pass');
  if (!stored) return false;
  const hash = sha256(pw);
  const a = Buffer.from(hash);
  const b = Buffer.from(stored);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** تعویض رمز — حداقل ۴ کاراکتر؛ false یعنی رمز کوتاه است */
export async function setPassword(pw: string): Promise<boolean> {
  if (pw.length < 4) return false;
  await setSetting('admin_pass', sha256(pw));
  return true;
}

// ---------------- نشست (HMAC) ----------------

/** ساخت توکن نشست: `${expMs}.${hmac(expMs)}` */
export async function createSession(days = SESSION_DAYS): Promise<{ token: string; maxAgeSec: number }> {
  const key = await getSessionKey();
  const exp = Date.now() + days * 24 * 60 * 60 * 1000;
  const expStr = String(exp);
  const sig = crypto.createHmac('sha256', key).update(expStr).digest('hex');
  return { token: `${expStr}.${sig}`, maxAgeSec: SESSION_MAX_AGE_SEC };
}

/** امضاسنجی + بررسی انقضای توکن نشست */
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

// ---------------- گارد مالک ----------------

export async function getOwner(req: NextRequest): Promise<boolean> {
  return verifySessionToken(req.cookies.get(OWNER_COOKIE)?.value);
}

/** null یعنی مجاز؛ در غیر این صورت پاسخ ۴۰۱ آماده برای return */
export async function requireOwner(req: NextRequest): Promise<NextResponse | null> {
  if (await getOwner(req)) return null;
  return NextResponse.json(
    { error: 'برای این عملیات باید به‌عنوان مدیر وارد شوید' },
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
