import crypto from 'crypto';

// Signed share token (HMAC-SHA256): role and expiry are encoded inside the link
// Format: base64url(payload).base64url(signature)

const SECRET = process.env.SHARE_SECRET || 'cabinet3d-mvp-secret-key-change-in-production';

export interface SharePayload {
  lid: string; // shareLink id
  pid: string; // project id
  role: string; // link default role: viewer | modifier
  exp: number; // expiry (epoch ms)
}

export function signShareToken(p: SharePayload): string {
  const payload = Buffer.from(JSON.stringify(p)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyShareToken(token: string): SharePayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SharePayload;
    if (!p.lid || !p.pid || typeof p.exp !== 'number') return null;
    if (p.exp < Date.now()) return null; // link expired
    return p;
  } catch {
    return null;
  }
}
