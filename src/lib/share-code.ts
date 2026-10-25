// ============================================================
// کد کوتاه لینک اشتراکی — URL کوتاه و خوانا برای مشتری
// حروف/اعداد بدون ابهام (بدون 0/O، 1/l/I) — طول ۷
// ============================================================

import crypto from 'crypto';

// حذف کاراکترهای گیج‌کننده از الفبا
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const SHORT_CODE_LENGTH = 7;

/** یک کد کوتاه تصادفی تولید می‌کند */
export function generateShortCode(length = SHORT_CODE_LENGTH): string {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

/**
 * ورودی resolve: توکن کامل امضاشده (شامل نقطه) یا کد کوتاه
 */
export function isFullToken(value: string): boolean {
  return value.includes('.');
}
