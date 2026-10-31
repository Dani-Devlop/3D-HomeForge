'use client';

import * as THREE from 'three';
import { useMemo } from 'react';
import type { DoorwaySpec, OutlinePoint, RoomSpec, WindowSpec } from '@/lib/scene-types';
import { edgeFrame, getRoomOutline, type EdgeFrame } from '@/lib/polygon';
import {
  cloneWithRepeat,
  plasterWallBumpTexture,
  plasterWallTexture,
  woodFloorTexture,
} from './textures';

// ============================================================
// Reconstructed room — polygon version
// Room plan = outline (3 to 12 corners, slanted walls supported)
// Without outline → reference rectangle widthM×depthM (previous behavior)
// Walls are visible only from inside (dollhouse effect preserved)
// ============================================================

/** Simple frame around an opening (window/door) */
function Frame({
  width,
  height,
  thickness = 0.07,
  depth = 0.06,
  color = '#f5f2ec',
}: {
  width: number;
  height: number;
  thickness?: number;
  depth?: number;
  color?: string;
}) {
  const mat = <meshStandardMaterial color={color} roughness={0.5} />;
  return (
    <group>
      {/* Top */}
      <mesh position={[0, height / 2 + thickness / 2, 0]} castShadow>
        <boxGeometry args={[width + thickness * 2, thickness, depth]} />
        {mat}
      </mesh>
      {/* Bottom */}
      <mesh position={[0, -height / 2 - thickness / 2, 0]}>
        <boxGeometry args={[width + thickness * 2, thickness, depth]} />
        {mat}
      </mesh>
      {/* Left and right */}
      <mesh position={[-width / 2 - thickness / 2, 0, 0]}>
        <boxGeometry args={[thickness, height + thickness * 2, depth]} />
        {mat}
      </mesh>
      <mesh position={[width / 2 + thickness / 2, 0, 0]}>
        <boxGeometry args={[thickness, height + thickness * 2, depth]} />
        {mat}
      </mesh>
    </group>
  );
}

/** Reference direction for each named wall — to find the nearest edge in a polygon plan */
const WALL_DIR: Record<string, [number, number]> = {
  back: [0, -1],
  front: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/** Edge index matching an opening — wallIndex (polygon) or the nearest edge to the named wall direction */
function edgeIndexOf(
  opening: { wall?: string; wallIndex?: number },
  edges: EdgeFrame[]
): number {
  const n = edges.length;
  if (
    typeof opening.wallIndex === 'number' &&
    Number.isInteger(opening.wallIndex) &&
    opening.wallIndex >= 0
  ) {
    return Math.min(opening.wallIndex, n - 1);
  }
  const dir = WALL_DIR[opening.wall ?? 'back'] ?? WALL_DIR.back;
  // Nearest edge to the named wall direction — the exact edge for a rectangle, the most sensible for a polygon
  let bestIdx = 0;
  let bestDot = -Infinity;
  edges.forEach((e, i) => {
    const dot = e.outX * dir[0] + e.outZ * dir[1];
    if (dot > bestDot) {
      bestDot = dot;
      bestIdx = i;
    }
  });
  return bestIdx;
}

/** Clamp the offset along the edge so the opening stays within the edge */
function clampEdgeOffset(offsetX: number, edge: EdgeFrame, openingWidth: number): number {
  const maxAbs = edge.len / 2 - openingWidth / 2 - 0.05;
  if (maxAbs <= 0) return 0;
  return Math.min(maxAbs, Math.max(-maxAbs, offsetX));
}

/** Oriented group on an edge — the local +z axis faces into the room */
function EdgeGroup({
  edge,
  offsetAlong = 0,
  children,
}: {
  edge: EdgeFrame;
  offsetAlong?: number;
  children: React.ReactNode;
}) {
  return (
    <group
      position={[
        edge.cx + edge.dirX * offsetAlong + edge.inX * 0.01,
        0,
        edge.cz + edge.dirZ * offsetAlong + edge.inZ * 0.01,
      ]}
      rotation={[0, edge.angleY, 0]}
    >
      {children}
    </group>
  );
}

function WindowCutout({ spec, edge }: { spec: WindowSpec; edge: EdgeFrame }) {
  const offsetAlong = clampEdgeOffset(spec.offsetX, edge, spec.width);
  const cy = spec.sillY + spec.height / 2;
  return (
    <EdgeGroup edge={edge} offsetAlong={offsetAlong}>
      <group position={[0, cy, 0]}>
        {/* Glass — bright transparent with a soft glow; never renders dark/black */}
        <mesh position={[0, 0, 0.005]}>
          <planeGeometry args={[spec.width, spec.height]} />
          <meshStandardMaterial
            color="#d7ecf9"
            emissive="#b8d9ea"
            emissiveIntensity={0.35}
            transparent
            opacity={0.3}
            roughness={0.05}
            metalness={0}
            envMapIntensity={1.2}
          />
        </mesh>
        {/* Frame */}
        <Frame width={spec.width} height={spec.height} />
        {/* Center vertical mullion */}
        <mesh position={[0, 0, 0.01]}>
          <boxGeometry args={[0.04, spec.height, 0.03]} />
          <meshStandardMaterial color="#f5f2ec" roughness={0.5} />
        </mesh>
        {/* Bottom sill */}
        <mesh position={[0, -spec.height / 2 - 0.03, 0.05]} castShadow>
          <boxGeometry args={[spec.width + 0.14, 0.05, 0.14]} />
          <meshStandardMaterial color="#efeae0" roughness={0.5} envMapIntensity={0.4} />
        </mesh>
      </group>
    </EdgeGroup>
  );
}

function DoorwayCutout({ spec, edge }: { spec: DoorwaySpec; edge: EdgeFrame }) {
  const offsetAlong = clampEdgeOffset(spec.offsetX, edge, spec.width);
  return (
    <EdgeGroup edge={edge} offsetAlong={offsetAlong}>
      <group position={[0, spec.height / 2, 0]}>
        {/* Dark opening */}
        <mesh position={[0, 0, 0.002]}>
          <planeGeometry args={[spec.width, spec.height]} />
          <meshStandardMaterial color="#3c342e" roughness={0.9} />
        </mesh>
        <Frame width={spec.width} height={spec.height} thickness={0.06} color="#efe9df" />
      </group>
    </EdgeGroup>
  );
}

/** THREE shape from plan points — flipZ for orientation + CCW winding guaranteed (+z normal) */
function shapeFromOutline(pts: OutlinePoint[], flipZ: boolean): THREE.Shape {
  const points = pts.map(([x, z]) => new THREE.Vector2(x, flipZ ? -z : z));
  // ShapeGeometry only yields a +z normal for a CCW contour — reverse it otherwise
  if (THREE.ShapeUtils.area(points) < 0) points.reverse();
  const shape = new THREE.Shape();
  points.forEach((p, i) => {
    if (i === 0) shape.moveTo(p.x, p.y);
    else shape.lineTo(p.x, p.y);
  });
  shape.closePath();
  return shape;
}

/** Polygon room: floor + edge-by-edge walls + ceiling + openings + directional light from the main window */
export function RoomMesh({ spec }: { spec: RoomSpec }) {
  const outline = useMemo<OutlinePoint[]>(() => getRoomOutline(spec), [spec]);
  const edges = useMemo<EdgeFrame[]>(
    () => outline.map((_, i) => edgeFrame(outline, i)),
    [outline]
  );
  const h = spec.heightM;

  const floorShape = useMemo(() => shapeFromOutline(outline, true), [outline]);
  const ceilShape = useMemo(() => shapeFromOutline(outline, false), [outline]);

  // Primary window = the largest window — sunlight shines from outside along that edge
  const primaryEdge = useMemo<EdgeFrame | null>(() => {
    if (!spec.windows.length) return null;
    let best = spec.windows[0];
    for (const win of spec.windows) {
      if (win.width * win.height > best.width * best.height) best = win;
    }
    return edges[edgeIndexOf(best, edges)] ?? null;
  }, [spec.windows, edges]);

  const sunPos = useMemo<[number, number, number]>(() => {
    if (!primaryEdge) return [2, h * 0.9, 2.5]; // No window — neutral light
    const reach = Math.max(3, Math.hypot(outlineBBoxSafe(outline).w, outlineBBoxSafe(outline).d) * 0.75);
    return [
      primaryEdge.cx + primaryEdge.outX * reach,
      h * 0.85,
      primaryEdge.cz + primaryEdge.outZ * reach,
    ];
  }, [primaryEdge, h, outline]);

  // Textures — generated once in the textures module (cache keyed by color); null = SSR/color fallback
  const bbox = useMemo(() => outlineBBoxSafe(outline), [outline]);
  const floorTex = useMemo(() => {
    const t = woodFloorTexture(spec.floorColor);
    if (!t) return null;
    // Parquet planks ~1.2 m
    return cloneWithRepeat(t, Math.max(1, bbox.w / 1.2), Math.max(1, bbox.d / 1.2));
  }, [spec.floorColor, bbox.w, bbox.d]);

  // Each wall needs its own repeat — clone with a shared source (cheap on the GPU)
  const wallTex = useMemo(
    () =>
      edges.map((edge) => {
        const rx = Math.max(1, edge.len / 1.5);
        const ry = Math.max(1, h / 1.5);
        return {
          map: cloneWithRepeat(plasterWallTexture(spec.wallColor), rx, ry),
          bump: cloneWithRepeat(plasterWallBumpTexture(spec.wallColor), rx, ry),
        };
      }),
    [edges, spec.wallColor, h],
  );

  return (
    <group>
      {/* Natural directional light — from the main window toward the room center (the scene's only shadow-casting light) */}
      <directionalLight
        position={sunPos}
        intensity={primaryEdge ? 1.15 : 0.85}
        color={primaryEdge ? '#fff1da' : '#fffaf2'}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />

      {/* Polygon floor — procedural parquet (carries the color map; white color) */}
      <mesh rotation-x={-Math.PI / 2} position-y={0} receiveShadow>
        <shapeGeometry args={[floorShape]} />
        {floorTex ? (
          <meshStandardMaterial map={floorTex} color="#ffffff" roughness={0.55} envMapIntensity={0.6} />
        ) : (
          <meshStandardMaterial color={spec.floorColor} roughness={0.55} envMapIntensity={0.6} />
        )}
      </mesh>

      {/* Ceiling — visible only from inside */}
      <mesh rotation-x={Math.PI / 2} position-y={h}>
        <shapeGeometry args={[ceilShape]} />
        <meshStandardMaterial color={spec.ceilingColor} roughness={0.95} />
      </mesh>

      {/* Walls — procedural plaster with a subtle bump; each edge has its own repeat */}
      {edges.map((edge, i) => (
        <mesh
          key={`wall-${i}`}
          position={[edge.cx + edge.inX * 0.005, h / 2, edge.cz + edge.inZ * 0.005]}
          rotation={[0, edge.angleY, 0]}
          receiveShadow
        >
          <planeGeometry args={[edge.len + 0.02, h]} />
          <meshStandardMaterial
            map={wallTex[i].map ?? undefined}
            bumpMap={wallTex[i].bump ?? undefined}
            bumpScale={0.015}
            color={wallTex[i].map ? '#ffffff' : spec.wallColor}
            roughness={0.9}
            envMapIntensity={0.45}
          />
        </mesh>
      ))}

      {/* Skirting board — follows the edges */}
      {edges.map((edge, i) => (
        <mesh
          key={`skirt-${i}`}
          position={[edge.cx + edge.inX * 0.025, 0.05, edge.cz + edge.inZ * 0.025]}
          rotation={[0, edge.angleY, 0]}
        >
          <boxGeometry args={[edge.len, 0.1, 0.04]} />
          <meshStandardMaterial color="#e0d8ca" roughness={0.5} envMapIntensity={0.4} />
        </mesh>
      ))}

      {spec.windows.map((win, i) => (
        <WindowCutout
          key={`w-${i}`}
          spec={win}
          edge={edges[edgeIndexOf(win, edges)]}
        />
      ))}
      {spec.doorways.map((dr, i) => (
        <DoorwayCutout
          key={`d-${i}`}
          spec={dr}
          edge={edges[edgeIndexOf(dr, edges)]}
        />
      ))}
    </group>
  );
}

/** bbox without a circular dependency — local to this file */
function outlineBBoxSafe(pts: OutlinePoint[]): { w: number; d: number } {
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
  return { w: maxX - minX, d: maxZ - minZ };
}
