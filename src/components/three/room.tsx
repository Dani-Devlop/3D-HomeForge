'use client';

import * as THREE from 'three';
import { useMemo } from 'react';
import type { DoorwaySpec, OutlinePoint, RoomSpec, WindowSpec } from '@/lib/scene-types';
import { edgeFrame, getRoomOutline, type EdgeFrame } from '@/lib/polygon';

// ============================================================
// اتاق بازسازی‌شده — نسخه چندضلعی
// پلان اتاق = outline (۳ تا ۱۲ گوشه، دیوار کج پشتیبانی می‌شود)
// بدون outline → مستطیل مرجع widthM×depthM (رفتار نسخه قبل)
// دیوارها فقط از داخل دیده می‌شوند (افکت dollhouse حفظ می‌شود)
// ============================================================

/** قاب ساده دور یک بازشو (پنجره/درب) */
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
  const mat = <meshStandardMaterial color={color} roughness={0.6} />;
  return (
    <group>
      {/* بالا */}
      <mesh position={[0, height / 2 + thickness / 2, 0]} castShadow>
        <boxGeometry args={[width + thickness * 2, thickness, depth]} />
        {mat}
      </mesh>
      {/* پایین */}
      <mesh position={[0, -height / 2 - thickness / 2, 0]}>
        <boxGeometry args={[width + thickness * 2, thickness, depth]} />
        {mat}
      </mesh>
      {/* چپ و راست */}
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

/** جهت مرجع هر دیوار نامی — برای یافتن نزدیک‌ترین لبه در پلان چندضلعی */
const WALL_DIR: Record<string, [number, number]> = {
  back: [0, -1],
  front: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/** اندیس لبه متناظر با یک بازشو — wallIndex (چندضلعی) یا نزدیک‌ترین لبه به جهت نام دیوار */
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
  // نزدیک‌ترین لبه به جهت نام دیوار — برای مستطیل همان لبه خودش، برای چندضلعی منطقی‌ترین
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

/** clamp آفست در راستای لبه تا بازشو داخل لبه بماند */
function clampEdgeOffset(offsetX: number, edge: EdgeFrame, openingWidth: number): number {
  const maxAbs = edge.len / 2 - openingWidth / 2 - 0.05;
  if (maxAbs <= 0) return 0;
  return Math.min(maxAbs, Math.max(-maxAbs, offsetX));
}

/** گروه جهت‌دار روی یک لبه — محور +z محلی رو به داخل اتاق */
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
        {/* شیشه */}
        <mesh position={[0, 0, 0.005]}>
          <planeGeometry args={[spec.width, spec.height]} />
          <meshStandardMaterial
            color="#d7ecf9"
            emissive="#a8cfe6"
            emissiveIntensity={0.55}
            roughness={0.15}
            metalness={0.1}
          />
        </mesh>
        {/* قاب */}
        <Frame width={spec.width} height={spec.height} />
        {/* میله عمودی وسط */}
        <mesh position={[0, 0, 0.01]}>
          <boxGeometry args={[0.04, spec.height, 0.03]} />
          <meshStandardMaterial color="#f5f2ec" roughness={0.6} />
        </mesh>
        {/* طاقچه پایین */}
        <mesh position={[0, -spec.height / 2 - 0.03, 0.05]} castShadow>
          <boxGeometry args={[spec.width + 0.14, 0.05, 0.14]} />
          <meshStandardMaterial color="#efeae0" roughness={0.7} />
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
        {/* دهانه تیره */}
        <mesh position={[0, 0, 0.002]}>
          <planeGeometry args={[spec.width, spec.height]} />
          <meshStandardMaterial color="#3c342e" roughness={0.9} />
        </mesh>
        <Frame width={spec.width} height={spec.height} thickness={0.06} color="#efe9df" />
      </group>
    </EdgeGroup>
  );
}

/** شکل THREE از نقاط پلان — flipZ برای تطبیق جهت + تضمین winding CCW (نرمال +z) */
function shapeFromOutline(pts: OutlinePoint[], flipZ: boolean): THREE.Shape {
  const points = pts.map(([x, z]) => new THREE.Vector2(x, flipZ ? -z : z));
  // ShapeGeometry فقط برای کانتور CCW نرمال +z می‌دهد — در غیر این صورت برعکس کنیم
  if (THREE.ShapeUtils.area(points) < 0) points.reverse();
  const shape = new THREE.Shape();
  points.forEach((p, i) => {
    if (i === 0) shape.moveTo(p.x, p.y);
    else shape.lineTo(p.x, p.y);
  });
  shape.closePath();
  return shape;
}

/** اتاق چندضلعی: کف + دیوار لبه‌به‌لبه + سقف + بازشوها + نور جهت‌دار از پنجره اصلی */
export function RoomMesh({ spec }: { spec: RoomSpec }) {
  const outline = useMemo<OutlinePoint[]>(() => getRoomOutline(spec), [spec]);
  const edges = useMemo<EdgeFrame[]>(
    () => outline.map((_, i) => edgeFrame(outline, i)),
    [outline]
  );
  const h = spec.heightM;

  const floorShape = useMemo(() => shapeFromOutline(outline, true), [outline]);
  const ceilShape = useMemo(() => shapeFromOutline(outline, false), [outline]);

  // پنجره اصلی = بزرگ‌ترین پنجره — نور خورشید از بیرون همان لبه می‌تابد
  const primaryEdge = useMemo<EdgeFrame | null>(() => {
    if (!spec.windows.length) return null;
    let best = spec.windows[0];
    for (const win of spec.windows) {
      if (win.width * win.height > best.width * best.height) best = win;
    }
    return edges[edgeIndexOf(best, edges)] ?? null;
  }, [spec.windows, edges]);

  const sunPos = useMemo<[number, number, number]>(() => {
    if (!primaryEdge) return [2, h * 0.9, 2.5]; // بدون پنجره — نور خنثی
    const reach = Math.max(3, Math.hypot(outlineBBoxSafe(outline).w, outlineBBoxSafe(outline).d) * 0.75);
    return [
      primaryEdge.cx + primaryEdge.outX * reach,
      h * 0.85,
      primaryEdge.cz + primaryEdge.outZ * reach,
    ];
  }, [primaryEdge, h, outline]);

  return (
    <group>
      {/* نور جهت‌دار طبیعی — از سمت پنجره اصلی به مرکز اتاق */}
      <directionalLight
        position={sunPos}
        intensity={primaryEdge ? 1.15 : 0.85}
        color={primaryEdge ? '#fff1da' : '#fffaf2'}
      />

      {/* کف چندضلعی */}
      <mesh rotation-x={-Math.PI / 2} position-y={0} receiveShadow>
        <shapeGeometry args={[floorShape]} />
        <meshStandardMaterial color={spec.floorColor} roughness={0.85} />
      </mesh>

      {/* سقف — فقط از داخل دیده می‌شود */}
      <mesh rotation-x={Math.PI / 2} position-y={h}>
        <shapeGeometry args={[ceilShape]} />
        <meshStandardMaterial color={spec.ceilingColor} roughness={0.95} />
      </mesh>

      {/* دیوارها — یک صفحه رو به داخل برای هر لبه (دیوار کج = صفحه چرخیده) */}
      {edges.map((edge, i) => (
        <mesh
          key={`wall-${i}`}
          position={[edge.cx + edge.inX * 0.005, h / 2, edge.cz + edge.inZ * 0.005]}
          rotation={[0, edge.angleY, 0]}
          receiveShadow
        >
          <planeGeometry args={[edge.len + 0.02, h]} />
          <meshStandardMaterial color={spec.wallColor} roughness={0.95} />
        </mesh>
      ))}

      {/* قرنیز — دنبال‌کننده لبه‌ها */}
      {edges.map((edge, i) => (
        <mesh
          key={`skirt-${i}`}
          position={[edge.cx + edge.inX * 0.025, 0.05, edge.cz + edge.inZ * 0.025]}
          rotation={[0, edge.angleY, 0]}
        >
          <boxGeometry args={[edge.len, 0.1, 0.04]} />
          <meshStandardMaterial color="#e0d8ca" roughness={0.7} />
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

/** bbox بدون وابستگی حلقه‌ای — همین فایل */
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
