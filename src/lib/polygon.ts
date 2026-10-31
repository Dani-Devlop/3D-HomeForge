import type { RoomSpec } from './scene-types';

// ============================================================
// Room polygon geometry — supports slanted walls and non-rectangular corners
// Shared between the API (reconstruction) and the client (editor/viewer/portfolio)
//
// Coordinate convention:
//  - Each point [x, z] is in meters, room center is the origin
//  - Positive x = right, positive z = front (toward the default camera)
//  - Point order is normalized so the signed area (in the x,z plane) is positive
//  - Edge i = segment from point i to point (i+1) mod n
//  - Reference rectangle: edge 0=back (z-), 1=right (x+), 2=front (z+), 3=left (x-)
// ============================================================

export type Pt = [number, number]; // [x, z] in meters

/** Doubled signed area (shoelace) in the x,z plane — positive = reference winding */
export function signedAreaXZ(pts: Pt[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[(i + 1) % pts.length];
    s += x1 * z2 - x2 * z1;
  }
  return s / 2;
}

/** Reference rectangle ordered back/right/front/left */
export function rectangleOutline(widthM: number, depthM: number): Pt[] {
  const w = Math.max(0.5, widthM) / 2;
  const d = Math.max(0.5, depthM) / 2;
  return [
    [-w, -d], // back-left
    [w, -d], // back-right  → edge 0 = back
    [w, d], // front-right → edge 1 = right
    [-w, d], // front-left  → edge 2 = front
  ]; // closing the loop → edge 3 = left
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export interface OutlineOptions {
  maxPts?: number; // default 12
  minArea?: number; // square meters — default 0.8
  bound?: number; // coordinate limit ± — default 15
}

/**
 * Defensively validate an outline result (from AI or UI):
 * - 3..maxPts points with valid numeric coordinates
 * - Remove duplicate/too-close points (< 8 cm)
 * - Consistent winding (positive area)
 * - Minimum area
 * Invalid → null
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
    // consecutive duplicate point or first point repeated at the end
    if (last && Math.hypot(last[0] - p[0], last[1] - p[1]) < 0.08) continue;
    if (pts.length > 0 && pts.length === maxPts) break;
    pts.push(p);
  }
  // last point too close to the first
  while (pts.length > 2) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 0.08) pts.pop();
    else break;
  }
  if (pts.length < 3) return null;

  const area = Math.abs(signedAreaXZ(pts));
  if (area < minArea) return null;

  // reference winding
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

/** Polygon area (square meters) */
export function outlineArea(pts: Pt[]): number {
  return Math.abs(signedAreaXZ(pts));
}

/** Point-in-polygon test (ray casting) */
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

/** Polygon area centroid */
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
    // degenerate — fall back to bbox center
    const bb = outlineBBox(pts);
    return [(bb.minX + bb.maxX) / 2, (bb.minZ + bb.maxZ) / 2];
  }
  a *= 3;
  return [cx / a, cz / a];
}

/**
 * Clamp a point inside the polygon:
 * inside → same point; outside → the farthest inside point along the center→target segment
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
  /** Edge midpoint */
  cx: number;
  cz: number;
  /** Edge length (meters) */
  len: number;
  /** Unit vector along the edge (a→b) */
  dirX: number;
  dirZ: number;
  /** Unit normal pointing outward from the room */
  outX: number;
  outZ: number;
  /** Unit normal pointing into the room */
  inX: number;
  inZ: number;
  /** Yaw angle for a plane facing inward */
  angleY: number;
}

/** Geometric frame of edge i (segment from point i to i+1) */
export function edgeFrame(pts: Pt[], i: number): EdgeFrame {
  const n = pts.length;
  const idx = ((i % n) + n) % n;
  const [ax, az] = pts[idx];
  const [bx, bz] = pts[(idx + 1) % n];
  const len = Math.max(0.05, Math.hypot(bx - ax, bz - az));
  const dirX = (bx - ax) / len;
  const dirZ = (bz - az) / len;
  // For positive winding in the x,z plane the outward normal = (dz, -dx)
  const outX = dirZ;
  const outZ = -dirX;
  const inX = -outX;
  const inZ = -outZ;
  const cx = (ax + bx) / 2;
  const cz = (az + bz) / 2;
  const angleY = Math.atan2(inX, inZ);
  return { ax, az, bx, bz, cx, cz, len, dirX, dirZ, outX, outZ, inX, inZ, angleY };
}

/** Valid room outline — missing or invalid outline → reference rectangle */
export function getRoomOutline(spec: Pick<RoomSpec, 'widthM' | 'depthM' | 'outline'>): Pt[] {
  const fromSpec = (spec as { outline?: unknown }).outline;
  return normalizeOutline(fromSpec) ?? rectangleOutline(spec.widthM, spec.depthM);
}

/** Does the room have a non-rectangular shape? */
export function hasCustomOutline(spec: Pick<RoomSpec, 'outline'>): boolean {
  return normalizeOutline((spec as { outline?: unknown }).outline) != null;
}

/**
 * Clamp a 3D object position inside the room (rectangle or polygon):
 * x,z via bbox + polygon; y untouched (the caller clamps height)
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
