import type { RoomSpec } from './scene-types';

// ============================================================
// هندسه چندضلعی اتاق — پشتیبانی از دیوارهای کج و گوشه‌های غیر۴گانه
// مشترک بین API (بازسازی) و کلاینت (ویرایشگر/نمایشگر/نمونه‌کار)
//
// قرارداد مختصات:
//  - هر نقطه [x, z] بر حسب متر، مرکز اتاق مبدأ
//  - x مثبت = راست، z مثبت = جلو (سمت دوربین پیش‌فرض)
//  - ترتیب نقاط طوری نرمال می‌شود که مساحت علامت‌دار (در صفحه x,z) مثبت باشد
//  - لبه i = پاره‌خط از نقطه i تا نقطه (i+1) mod n
//  - مستطیل مرجع: لبه ۰=back (z-)، ۱=right (x+)، ۲=front (z+)، ۳=left (x-)
// ============================================================

export type Pt = [number, number]; // [x, z] متر

/** مساحت علامت‌دار دوبرابر (شومaker) در صفحه x,z — مثبت = winding مرجع */
export function signedAreaXZ(pts: Pt[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[(i + 1) % pts.length];
    s += x1 * z2 - x2 * z1;
  }
  return s / 2;
}

/** مستطیل مرجع به‌ترتیب لبه‌های back/right/front/left */
export function rectangleOutline(widthM: number, depthM: number): Pt[] {
  const w = Math.max(0.5, widthM) / 2;
  const d = Math.max(0.5, depthM) / 2;
  return [
    [-w, -d], // back-left
    [w, -d], // back-right  → لبه ۰ = back
    [w, d], // front-right → لبه ۱ = right
    [-w, d], // front-left  → لبه ۲ = front
  ]; // بستن حلقه → لبه ۳ = left
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export interface OutlineOptions {
  maxPts?: number; // پیش‌فرض ۱۲
  minArea?: number; // مترمربع — پیش‌فرض ۰٫۸
  bound?: number; // حد مختصات ± — پیش‌فرض ۱۵
}

/**
 * اعتبارسنجی تدافعی خروجی outline (از AI یا UI):
 * - ۳ تا maxPts نقطه با مختصات عددی معتبر
 * - حذف نقاط تکراری/خیلی نزدیک (< ۸ سانت)
 * - winding یکسان (مساحت مثبت)
 * - مساحت حداقلی
 * نامعتبر → null
 */
export function normalizeOutline(raw: unknown, opts?: OutlineOptions): Pt[] | null {
  const maxPts = opts?.maxPts ?? 12;
  const minArea = opts?.minArea ?? 0.8;
  const bound = opts?.bound ?? 15;

  if (!Array.isArray(raw)) return null;

  const pts: Pt[] = [];
  for (const item of raw.slice(0, maxPts * 2)) {
    if (!Array.isArray(item) || item.length < 2) continue;
    const x = typeof item[0] === 'number' ? item[0] : Number(item[0]);
    const z = typeof item[1] === 'number' ? item[1] : Number(item[1]);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    const p: Pt = [round3(Math.min(bound, Math.max(-bound, x))), round3(Math.min(bound, Math.max(-bound, z)))];
    const last = pts[pts.length - 1];
    // نقطه تکراری متوالی یا تکرار نقطه اول در انتها
    if (last && Math.hypot(last[0] - p[0], last[1] - p[1]) < 0.08) continue;
    if (pts.length > 0 && pts.length === maxPts) break;
    pts.push(p);
  }
  // نزدیکی آخرین نقطه به اولین
  while (pts.length > 2) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 0.08) pts.pop();
    else break;
  }
  if (pts.length < 3) return null;

  const area = Math.abs(signedAreaXZ(pts));
  if (area < minArea) return null;

  // winding مرجع
  if (signedAreaXZ(pts) < 0) pts.reverse();
  return pts;
}

export interface OutlineBBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  w: number;
  d: number;
}

export function outlineBBox(pts: Pt[]): OutlineBBox {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of pts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { minX, maxX, minZ, maxZ, w: maxX - minX, d: maxZ - minZ };
}

/** مساحت چندضلع (مترمربع) */
export function outlineArea(pts: Pt[]): number {
  return Math.abs(signedAreaXZ(pts));
}

/** تست داخل‌بودن نقطه (ray casting) */
export function pointInPolygon(x: number, z: number, pts: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i];
    const [xj, zj] = pts[j];
    const intersect =
      zi > z !== zj > z &&
      x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** مرکز سطح چندضلع (centroid چندضلعی) */
export function polygonCentroid(pts: Pt[]): Pt {
  let cx = 0;
  let cz = 0;
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[(i + 1) % pts.length];
    const cross = x1 * z2 - x2 * z1;
    a += cross;
    cx += (x1 + x2) * cross;
    cz += (z1 + z2) * cross;
  }
  if (Math.abs(a) < 1e-9) {
    // افتاده به مرکز bbox
    const bb = outlineBBox(pts);
    return [(bb.minX + bb.maxX) / 2, (bb.minZ + bb.maxZ) / 2];
  }
  a *= 3;
  return [cx / a, cz / a];
}

/**
 * محدودکردن نقطه به داخل چندضلع:
 * داخل → همان نقطه؛ بیرون → دورترین نقطه داخل روی پاره‌خط مرکز→هدف
 */
export function clampPointToOutline(x: number, z: number, pts: Pt[]): Pt {
  if (pointInPolygon(x, z, pts)) return [x, z];
  const [cx, cz] = polygonCentroid(pts);
  const STEPS = 96;
  let best: Pt = [cx, cz];
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS;
    const px = cx + (x - cx) * t;
    const pz = cz + (z - cz) * t;
    if (pointInPolygon(px, pz, pts)) best = [px, pz];
    else break;
  }
  return best;
}

export interface EdgeFrame {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  /** مرکز لبه */
  cx: number;
  cz: number;
  /** طول لبه (متر) */
  len: number;
  /** بردار واحد در راستای لبه (a→b) */
  dirX: number;
  dirZ: number;
  /** نرمال واحد رو به بیرون اتاق */
  outX: number;
  outZ: number;
  /** نرمال واحد رو به داخل اتاق */
  inX: number;
  inZ: number;
  /** زاویه yaw برای صفحه‌ای که رو به داخل است */
  angleY: number;
}

/** قاب هندسی لبه i (پاره‌خط نقطه i تا i+1) */
export function edgeFrame(pts: Pt[], i: number): EdgeFrame {
  const n = pts.length;
  const idx = ((i % n) + n) % n;
  const [ax, az] = pts[idx];
  const [bx, bz] = pts[(idx + 1) % n];
  const len = Math.max(0.05, Math.hypot(bx - ax, bz - az));
  const dirX = (bx - ax) / len;
  const dirZ = (bz - az) / len;
  // برای winding مثبت در صفحه x,z نرمال بیرونی = (dz, -dx)
  const outX = dirZ;
  const outZ = -dirX;
  const inX = -outX;
  const inZ = -outZ;
  const cx = (ax + bx) / 2;
  const cz = (az + bz) / 2;
  const angleY = Math.atan2(inX, inZ);
  return { ax, az, bx, bz, cx, cz, len, dirX, dirZ, outX, outZ, inX, inZ, angleY };
}

/** outline معتبر اتاق — بدون outline یا نامعتبر → مستطیل مرجع */
export function getRoomOutline(spec: Pick<RoomSpec, 'widthM' | 'depthM' | 'outline'>): Pt[] {
  const fromSpec = (spec as { outline?: unknown }).outline;
  return normalizeOutline(fromSpec) ?? rectangleOutline(spec.widthM, spec.depthM);
}

/** آیا اتاق شکل غیرمستطیلی دارد؟ */
export function hasCustomOutline(spec: Pick<RoomSpec, 'outline'>): boolean {
  return normalizeOutline((spec as { outline?: unknown }).outline) != null;
}

/**
 * clamp موقعیت سه‌بعدی آبجکت داخل اتاق (مستطیل یا چندضلع):
 * x,z با bbox + چندضلع؛ y دست‌نخورده (تماس‌گیرنده clamp ارتفاع می‌کند)
 */
export function clampPositionToRoom(
  spec: Pick<RoomSpec, 'widthM' | 'depthM' | 'outline'>,
  position: readonly [number, number, number],
): [number, number, number] {
  const outline = getRoomOutline(spec);
  const bb = outlineBBox(outline);
  const margin = 0.02;
  const x = Math.min(bb.maxX - margin, Math.max(bb.minX + margin, position[0]));
  const z = Math.min(bb.maxZ - margin, Math.max(bb.minZ + margin, position[2]));
  const [cx, cz] = clampPointToOutline(x, z, outline);
  return [cx, position[1], cz];
}
