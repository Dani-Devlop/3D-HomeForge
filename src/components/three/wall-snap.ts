// ============================================================
// چسبیدن آبجکت‌های دیواری به دیوار (Wall Snap) — ریاضی محض
// ⚠️ این ماژول هیچ وابستگی به three ندارد تا در استور (zustand)
//    هم قابل ایمپورت باشد.
//
// قرارداد: آبجکت‌های دیواری (کابینت/لوازم/تلویزیون) حین درگ
// روی «دیوار سُر می‌خورند» — نه اینکه شناور روی بقیه صحنه بروند:
//  • در شروع درگ نزدیک‌ترین لبه outline قفل می‌شود (beginWallDrag)
//  • در هر رویداد تغییر، موقعیت خام گیزموت روی خط همان لبه
//    پروجکت می‌شود (applyWallDrag) و چرخش رو به داخل تنظیم می‌شود
//  • ارتفاع (y) حین سُرخوردن قفل می‌ماند
// ============================================================

import { edgeFrame, getRoomOutline, type Pt } from '@/lib/polygon';
import type { ObjectType, RoomSpec, SceneObject } from '@/lib/scene-types';

/** انواعی که هنگام درگ به دیوار می‌چسبند (کابینت‌ها، لوازم، تلویزیون) */
export const WALL_SNAP_TYPES: readonly ObjectType[] = [
  'base', 'wall', 'tall', 'shelf',
  'fridge', 'stove', 'washer', 'dishwasher', 'microwave', 'hood', 'tv',
];

export const isWallSnapType = (t: ObjectType): boolean => WALL_SNAP_TYPES.includes(t);

/** وضعیت درگ روی دیوار — در شروع درگ ساخته می‌شود */
export interface WallDragState {
  /** اندیس لبه‌ای که آبجکت به آن چسبیده (لبه i = نقطه i تا i+1) */
  edgeIndex: number;
  /** فاصله مرکز آبجکت از دیوار (depth/2 + 0.02) */
  inset: number;
  /** ارتفاع قفل‌شده حین سُرخوردن */
  y: number;
  /** نصف عرض آبجکت برای محدودسازی طول لبه */
  halfW: number;
}

/** فاصله² نقطه تا پاره‌خط — پروجکشن clamp به انتهای نزدیک‌تر */
function pointSegmentDist2(
  px: number, pz: number,
  ax: number, az: number,
  bx: number, bz: number,
): number {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = px - ax;
  const wz = pz - az;
  const len2 = vx * vx + vz * vz;
  let t = len2 > 1e-9 ? (wx * vx + wz * vz) / len2 : 0;
  t = Math.min(1, Math.max(0, t));
  const dx = px - (ax + vx * t);
  const dz = pz - (az + vz * t);
  return dx * dx + dz * dz;
}

/** نزدیک‌ترین لبه outline به یک نقطه (فاصله تا پاره‌خط هر لبه) */
export function nearestEdgeIndex(outline: Pt[], x: number, z: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < outline.length; i++) {
    const [ax, az] = outline[i];
    const [bx, bz] = outline[(i + 1) % outline.length];
    const d2 = pointSegmentDist2(x, z, ax, az, bx, bz);
    if (d2 < bestD) {
      bestD = d2;
      best = i;
    }
  }
  return best;
}

/**
 * شروع درگ روی دیوار — نزدیک‌ترین لبه به موقعیت فعلی آبجکت قفل می‌شود.
 * inset از عمق آبجکت و halfW از عرض آن محاسبه می‌شود.
 */
export function beginWallDrag(spec: RoomSpec, obj: SceneObject): WallDragState {
  const outline = getRoomOutline(spec);
  return {
    edgeIndex: nearestEdgeIndex(outline, obj.position[0], obj.position[2]),
    inset: (obj.params?.d ?? 0.6) / 2 + 0.02,
    y: obj.position[1],
    halfW: (obj.params?.w ?? 0.8) / 2,
  };
}

/**
 * اعمال درگ: موقعیت خام گیزموت (rawX, rawZ) روی خطِ لبه قفل‌شده پروجکت و
 * محدود می‌شود؛ خروجی موقعیت چسبیده به دیوار + چرخش رو به داخل اتاق است.
 * y خروجی = y قفل‌شده در beginWallDrag (سُرخوردن در ارتفاع ثابت).
 */
export function applyWallDrag(
  spec: RoomSpec,
  st: WallDragState,
  rawX: number,
  rawZ: number,
): { position: [number, number, number]; rotationY: number } {
  const edge = edgeFrame(getRoomOutline(spec), st.edgeIndex);
  // پروجکشن نقطه خام روی خط لبه → محدود به داخل طول لبه با حاشیه نصف‌عرض
  const rawT = (rawX - edge.cx) * edge.dirX + (rawZ - edge.cz) * edge.dirZ;
  const maxT = Math.max(0, edge.len / 2 - st.halfW - 0.05);
  const t = Math.min(maxT, Math.max(-maxT, rawT));
  return {
    position: [
      edge.cx + edge.dirX * t + edge.inX * st.inset,
      st.y,
      edge.cz + edge.dirZ * t + edge.inZ * st.inset,
    ],
    // زاویه‌ای که +z آبجکت را رو به داخل اتاق می‌کند (مطابق EdgeGroup در room.tsx)
    rotationY: edge.angleY,
  };
}

/**
 * جانمایی یک آبجکت جدید (دراپ/افزودن) روی نزدیک‌ترین لبه به (x, z) —
 * inset پیش‌فرض = (d 0.6)/2 + 0.02 = 0.32 (وقتی پارامترها هنوز ساخته نشده‌اند)
 */
export function snapNewObject(
  spec: RoomSpec,
  type: ObjectType,
  x: number,
  z: number,
  params?: { d?: number; w?: number },
): { x: number; z: number; rotationY: number } {
  const outline = getRoomOutline(spec);
  const edgeIndex = nearestEdgeIndex(outline, x, z);
  // تلویزیون بسیار نازک است — پیش‌فرض عمقی معقول تا از دیوار جدا نیفتد
  const d = params?.d ?? (type === 'tv' ? 0.08 : 0.6);
  const w = params?.w ?? (type === 'tv' ? 1.2 : 0.8);
  const st: WallDragState = {
    edgeIndex,
    inset: d / 2 + 0.02,
    y: 0,
    halfW: w / 2,
  };
  const { position, rotationY } = applyWallDrag(spec, st, x, z);
  return { x: position[0], z: position[2], rotationY };
}
