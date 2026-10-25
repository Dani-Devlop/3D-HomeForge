import type { HandleType, ObjectParams, WallName } from '@/lib/scene-types';

// ============================================================
// هلپرهای مشترک نرمال‌سازی خروجی مدل‌های زبانی
// (مشترک بین /api/reconstruct و /api/ai/*)
// ============================================================

export const WALLS: readonly WallName[] = ['back', 'left', 'right', 'front'];

export const ROOM_TYPES: readonly string[] = [
  'kitchen', 'bedroom', 'living', 'dining', 'bathroom', 'office', 'other',
];

export const FURNITURE_KINDS = [
  'base', 'wall', 'tall', 'island', 'shelf', 'fridge', 'stove', 'hood',
  'tv', 'sofa', 'bed', 'table', 'chair', 'washer', 'dishwasher', 'microwave',
] as const;

export type FurnitureKind = (typeof FURNITURE_KINDS)[number];

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

export const toFinite = (v: unknown, fallback: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number.parseFloat(v) : Number.NaN;
  return Number.isFinite(n) ? n : fallback;
};

export const toWall = (v: unknown): WallName =>
  typeof v === 'string' && (WALLS as readonly string[]).includes(v) ? (v as WallName) : 'back';

export const toColor = (v: unknown, fallback: string): string =>
  typeof v === 'string' && HEX_RE.test(v) ? v.toLowerCase() : fallback;

export const toHandle = (v: unknown, fallback: HandleType = 'bar'): HandleType =>
  v === 'bar' || v === 'knob' || v === 'none' ? v : fallback;

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

export const toFurnitureKind = (v: unknown, fallback: FurnitureKind = 'base'): FurnitureKind =>
  typeof v === 'string' && (FURNITURE_KINDS as readonly string[]).includes(v)
    ? (v as FurnitureKind)
    : fallback;

/** حذف فنس‌های markdown و استخراج اولین آبجکت JSON از متن پاسخ مدل */
export function extractJsonObject(text: string): unknown {
  const stripped = text.replace(/```[a-zA-Z]*/g, '').trim();
  const first = stripped.indexOf('{');
  const last = stripped.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(stripped.slice(first, last + 1));
    } catch {
      // تلاش برای parse مستقیم در ادامه
    }
  }
  return JSON.parse(stripped);
}

/** ترکیب رنگ hex با سفید (amount مثبت) یا سیاه (amount منفی) — hex اعتبارسنجی‌شده ورودی */
export function shadeColor(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const target = amount >= 0 ? 255 : 0;
  const a = Math.min(1, Math.abs(amount));
  const mix = (c: number) => clamp(Math.round(c + (target - c) * a), 0, 255);
  return `#${[mix(r), mix(g), mix(b)]
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')}`;
}

// ---------------- برچسب‌های فارسی انواع مبلمان ----------------

export const KIND_LABELS: Record<FurnitureKind, string> = {
  base: 'کابینت زمینی',
  wall: 'کابینت دیواری',
  tall: 'کابینت بلند',
  island: 'جزیره',
  shelf: 'قفسه باز',
  fridge: 'یخچال',
  stove: 'اجاق گاز',
  hood: 'هود',
  tv: 'تلویزیون',
  sofa: 'مبل',
  bed: 'تخت',
  table: 'میز',
  chair: 'صندلی',
  washer: 'ماشین لباسشویی',
  dishwasher: 'ماشین ظرفشویی',
  microwave: 'مایکروویو',
};

/** ابعاد پیش‌فرض هر نوع (متر) — برای مقادیر غایب در خروجی مدل */
export const KIND_DEFAULT_H: Record<FurnitureKind, number> = {
  base: 0.85, wall: 0.7, tall: 2.1, island: 0.9,
  shelf: 1.8, fridge: 1.8, stove: 0.9, hood: 0.14,
  tv: 0.7, sofa: 0.8, bed: 0.55, table: 0.75,
  chair: 0.9, washer: 0.85, dishwasher: 0.85, microwave: 0.3,
};

export const KIND_DEFAULT_D: Record<FurnitureKind, number> = {
  base: 0.6, wall: 0.35, tall: 0.6, island: 0.9,
  shelf: 0.35, fridge: 0.7, stove: 0.6, hood: 0.5,
  tv: 0.06, sofa: 0.9, bed: 2.0, table: 0.9,
  chair: 0.5, washer: 0.6, dishwasher: 0.6, microwave: 0.38,
};

// ---------------- پارامترهای کامل آیتم (خروجی /api/ai/cabinet) ----------------

export interface FullItemParams {
  w: number;
  h: number;
  d: number;
  bodyColor: string;
  doorColor: string;
  countertopColor: string;
  doors: number;
  drawers: number;
  handles: HandleType;
  mountY?: number;
  glass?: boolean;
}

/** کلیدهای mountY فقط برای wall و hood و tv و microwave مجاز است (بازه‌های متفاوت) */
function mountYRange(kind: string): [number, number, number] | null {
  if (kind === 'wall') return [1.5, 0.8, 2.3]; // [پیش‌فرض, حداقل, حداکثر]
  if (kind === 'hood') return [1.62, 1.3, 2.0];
  if (kind === 'tv') return [1.4, 0.4, 2.2]; // نصب روی دیوار
  if (kind === 'microwave') return [0.9, 0.3, 1.6]; // روی کانتر
  return null;
}

/** بازه‌های h/d خاص هر نوع (تلویزیون نازک، تخت بلندتر) */
function kindRanges(kind: string): { h: [number, number]; d: [number, number] } {
  switch (kind) {
    case 'hood':
      return { h: [0.1, 0.5], d: [0.25, 1.2] };
    case 'tv':
      return { h: [0.3, 1.2], d: [0.04, 0.3] };
    case 'bed':
      return { h: [0.3, 2.4], d: [0.25, 2.3] };
    default:
      return { h: [0.3, 2.4], d: [0.25, 1.2] };
  }
}

/** نرمال‌سازی کامل پارامترها با fallback برای همه کلیدها (تولید text-to-3D) */
export function normalizeFullParams(raw: unknown, kind: FurnitureKind): FullItemParams {
  const p = isRecord(raw) ? raw : {};
  const hr = kindRanges(kind).h;
  const dr = kindRanges(kind).d;
  const out: FullItemParams = {
    w: clamp(toFinite(p.w, 0.8), 0.3, 3),
    h: clamp(toFinite(p.h, KIND_DEFAULT_H[kind]), hr[0], hr[1]),
    d: clamp(toFinite(p.d, KIND_DEFAULT_D[kind]), dr[0], dr[1]),
    bodyColor: toColor(p.bodyColor, '#6b4f3a'),
    doorColor: toColor(p.doorColor, '#7d5f45'),
    countertopColor: toColor(p.countertopColor, '#d8d3c8'),
    doors: Math.round(clamp(toFinite(p.doors, 2), 0, 2)),
    drawers: Math.round(clamp(toFinite(p.drawers, 0), 0, 3)),
    handles: toHandle(p.handles),
  };
  // شیشه فقط وقتی صریحاً true است خروجی می‌رود (شیشه هرگز سیاه نیست)
  if (p.glass === true) out.glass = true;
  const my = mountYRange(kind);
  if (my) out.mountY = clamp(toFinite(p.mountY, my[0]), my[1], my[2]);
  return out;
}

// ---------------- پارامترهای جزئی (پچ /api/ai/edit و ساخت آبجکت بازسازی) ----------------

/**
 * نرمال‌سازی سخت‌گیرانه پارامترهای جزئی: فقط کلیدهای شناخته‌شده با مقدار معتبر
 * نگه داشته می‌شوند؛ بقیه حذف می‌شوند. kind برای بازه‌های h/mountY استفاده می‌شود.
 */
export function normalizePartialParams(raw: unknown, kind: string): ObjectParams {
  const p = isRecord(raw) ? raw : {};
  const out: ObjectParams = {};
  const kindKey = (FURNITURE_KINDS as readonly string[]).includes(kind)
    ? (kind as FurnitureKind)
    : 'base';
  const hr = kindRanges(kind).h;
  const dr = kindRanges(kind).d;

  if (p.w !== undefined) out.w = clamp(toFinite(p.w, 0.8), 0.3, 3);
  if (p.h !== undefined) {
    out.h = clamp(toFinite(p.h, KIND_DEFAULT_H[kindKey]), hr[0], hr[1]);
  }
  if (p.d !== undefined) out.d = clamp(toFinite(p.d, KIND_DEFAULT_D[kindKey]), dr[0], dr[1]);

  if (p.bodyColor !== undefined) out.bodyColor = toColor(p.bodyColor, '#6b4f3a');
  if (p.doorColor !== undefined) out.doorColor = toColor(p.doorColor, '#7d5f45');
  if (p.countertopColor !== undefined) out.countertopColor = toColor(p.countertopColor, '#d8d3c8');
  if (p.color !== undefined) out.color = toColor(p.color, '#888888');

  if (p.doors !== undefined) out.doors = Math.round(clamp(toFinite(p.doors, 0), 0, 2));
  if (p.drawers !== undefined) out.drawers = Math.round(clamp(toFinite(p.drawers, 0), 0, 3));
  if (p.handles !== undefined) out.handles = toHandle(p.handles, 'none');

  const my = mountYRange(kind);
  if (my && p.mountY !== undefined) out.mountY = clamp(toFinite(p.mountY, my[0]), my[1], my[2]);

  // درب شیشه‌ای — عبور کنترل‌شده (شیشه هرگز رنگ تیره نمی‌گیرد)
  if (p.glass !== undefined) out.glass = p.glass === true;

  if (p.scale !== undefined) out.scale = clamp(toFinite(p.scale, 1), 0.2, 5);
  if (p.intensity !== undefined) out.intensity = clamp(toFinite(p.intensity, 1), 0, 5);

  return out;
}
