// ============================================================
// Wall snapping for wall-mounted objects (Wall Snap) — pure math
// ⚠️ This module has no three dependency so it can also be
//    imported in the store (zustand).
//
// Contract: wall objects (cabinets/appliances/TV) "slide along the
// wall" while dragging — instead of floating over the rest of the scene:
//  • On drag start, the nearest outline edge is locked (beginWallDrag)
//  • On every change event, the raw gizmo position is projected onto
//    that edge's line (applyWallDrag) and the inward-facing rotation is set
//  • The height (y) stays locked while sliding
// ============================================================

import { edgeFrame, getRoomOutline, type Pt } from '@/lib/polygon';
import type { ObjectType, RoomSpec, SceneObject } from '@/lib/scene-types';

/** Types that snap to the wall while dragging (cabinets, appliances, TV) */
export const WALL_SNAP_TYPES: readonly ObjectType[] = [
  'base', 'wall', 'tall', 'shelf',
  'fridge', 'stove', 'washer', 'dishwasher', 'microwave', 'hood', 'tv',
];

export const isWallSnapType = (t: ObjectType): boolean => WALL_SNAP_TYPES.includes(t);

/** Wall drag state — created at drag start */
export interface WallDragState {
  /** Index of the edge the object is snapped to (edge i = point i to i+1) */
  edgeIndex: number;
  /** Distance of the object center from the wall (depth/2 + 0.02) */
  inset: number;
  /** Height locked while sliding */
  y: number;
  /** Half of the object width to limit movement along the edge */
  halfW: number;
}

/** Point-to-segment distance² — projection clamped to the nearest end */
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

/** Nearest outline edge to a point (distance to each edge segment) */
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
 * Begin a wall drag — the edge nearest the object's current position is locked.
 * inset is derived from the object depth and halfW from its width.
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
 * Apply the drag: the raw gizmo position (rawX, rawZ) is projected onto the
 * locked edge's line and clamped; the output is a wall-snapped position +
 * inward-facing rotation. Output y = the y locked in beginWallDrag (slides at a constant height).
 */
export function applyWallDrag(
  spec: RoomSpec,
  st: WallDragState,
  rawX: number,
  rawZ: number,
): { position: [number, number, number]; rotationY: number } {
  const edge = edgeFrame(getRoomOutline(spec), st.edgeIndex);
  // Project the raw point onto the edge line → clamp within the edge length with a half-width margin
  const rawT = (rawX - edge.cx) * edge.dirX + (rawZ - edge.cz) * edge.dirZ;
  const maxT = Math.max(0, edge.len / 2 - st.halfW - 0.05);
  const t = Math.min(maxT, Math.max(-maxT, rawT));
  return {
    position: [
      edge.cx + edge.dirX * t + edge.inX * st.inset,
      st.y,
      edge.cz + edge.dirZ * t + edge.inZ * st.inset,
    ],
    // Angle that makes the object's +z face into the room (matches EdgeGroup in room.tsx)
    rotationY: edge.angleY,
  };
}

/**
 * Place a new object (drop/add) on the nearest edge to (x, z) —
 * default inset = (d 0.6)/2 + 0.02 = 0.32 (when params are not built yet)
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
  // TVs are very thin — a sensible default depth so they don't detach from the wall
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
