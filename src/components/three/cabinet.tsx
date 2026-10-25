'use client';

import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import type { SceneObject } from '@/lib/scene-types';

export type RefsMap = Map<string, THREE.Group>;

export interface MeshCtx {
  obj: SceneObject;
  selected: boolean;
  canInteract: boolean;
  canMove: boolean;
  refsMap: RefsMap;
  onSelect: (id: string, additive: boolean) => void;
  onToggleOpen?: (id: string) => void;
  onToggleLight?: (id: string) => void;
}

const OPEN_ANGLE = 1.75; // زاویه باز شدن درب (رادیان)
const DRAWER_OUT = 0.34; // بیرون آمدن کشو (متر)

function useCursor(pointer: boolean) {
  return (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    document.body.style.cursor = pointer ? 'pointer' : 'auto';
  };
}

/** درب لولادار با انیمیشن نرم (الگوی Mesh States) — حالت شیشه‌ای: شفاف آبی-سبز روشن، هرگز سیاه */
function HingedDoor({
  width,
  height,
  side, // -1 = لولا چپ، +1 = لولا راست
  open,
  color,
  handle,
  zBase,
  hingeX,
  yCenter,
  glass,
  onClick,
}: {
  width: number; // عرض هر درب
  height: number;
  side: 1 | -1; // -1 = لولا سمت چپ کابینت، +1 = لولا سمت راست
  open: boolean;
  color: string;
  handle: string;
  zBase: number;
  hingeX: number; // فاصله لولا از مرکز کابینت (≈ w/2)
  yCenter: number; // ارتفاع مرکز درب از مبدأ کابینت
  glass?: boolean; // درب شیشه‌ای شفاف با قاب باریک
  onClick: (e: { stopPropagation: () => void }) => void;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!group.current) return;
    const target = open ? side * OPEN_ANGLE : 0;
    group.current.rotation.y = THREE.MathUtils.damp(
      group.current.rotation.y, target, 8, delta
    );
  });
  const hover = useCursor(true);

  const handleEl =
    handle === 'bar' ? (
      <mesh
        position={[-side * (width - 0.06), 0, 0.035]}
        castShadow
      >
        <boxGeometry args={[0.025, Math.min(0.16, height * 0.4), 0.025]} />
        <meshStandardMaterial color="#c8b89a" metalness={0.7} roughness={0.3} />
      </mesh>
    ) : handle === 'knob' ? (
      <mesh position={[-side * (width - 0.05), 0, 0.035]} castShadow>
        <sphereGeometry args={[0.022, 16, 16]} />
        <meshStandardMaterial color="#c8b89a" metalness={0.7} roughness={0.3} />
      </mesh>
    ) : null;

  const T = 0.03; // ضخامت قاب دور شیشه
  const D = 0.028; // عمق قاب

  return (
    <group
      ref={group}
      position={[side * hingeX, yCenter, zBase]}
    >
      {glass ? (
        <group
          position={[-side * (width / 2), 0, 0]}
          onClick={onClick}
          onPointerOver={hover}
          onPointerOut={() => {
            document.body.style.cursor = 'auto';
          }}
        >
          {/* شیشه شفاف با تینت روشن آبی-سبز */}
          <mesh castShadow>
            <boxGeometry args={[width, height, 0.014]} />
            <meshPhysicalMaterial
              color="#cdeaf2"
              transparent
              opacity={0.26}
              roughness={0.06}
              metalness={0.05}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* قاب باریک دور شیشه — بالا و پایین */}
          <mesh position={[0, height / 2 - T / 2, 0]} castShadow>
            <boxGeometry args={[width, T, D]} />
            <meshStandardMaterial color={color} roughness={0.65} />
          </mesh>
          <mesh position={[0, -height / 2 + T / 2, 0]} castShadow>
            <boxGeometry args={[width, T, D]} />
            <meshStandardMaterial color={color} roughness={0.65} />
          </mesh>
          {/* قاب باریک دور شیشه — چپ و راست */}
          <mesh position={[-width / 2 + T / 2, 0, 0]} castShadow>
            <boxGeometry args={[T, height - T * 2, D]} />
            <meshStandardMaterial color={color} roughness={0.65} />
          </mesh>
          <mesh position={[width / 2 - T / 2, 0, 0]} castShadow>
            <boxGeometry args={[T, height - T * 2, D]} />
            <meshStandardMaterial color={color} roughness={0.65} />
          </mesh>
        </group>
      ) : (
        <mesh
          position={[-side * (width / 2), 0, 0]}
          castShadow
          onClick={onClick}
          onPointerOver={hover}
          onPointerOut={() => {
            document.body.style.cursor = 'auto';
          }}
        >
          <boxGeometry args={[width, height, 0.028]} />
          <meshStandardMaterial color={color} roughness={0.65} />
        </mesh>
      )}
      {handleEl}
    </group>
  );
}

/** کشوی کشیدنی با انیمیشن نرم */
function Drawer({
  width,
  height,
  y,
  open,
  color,
  handle,
  zBase,
  onClick,
}: {
  width: number;
  height: number;
  y: number;
  open: boolean;
  color: string;
  handle: string;
  zBase: number;
  onClick: (e: { stopPropagation: () => void }) => void;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!group.current) return;
    const target = open ? DRAWER_OUT : 0;
    group.current.position.z = THREE.MathUtils.damp(
      group.current.position.z, target, 8, delta
    );
  });
  const hover = useCursor(true);
  return (
    <group ref={group} position={[0, y, zBase]}>
      <mesh castShadow onClick={onClick} onPointerOver={hover} onPointerOut={() => (document.body.style.cursor = 'auto')}>
        <boxGeometry args={[width, height, 0.032]} />
        <meshStandardMaterial color={color} roughness={0.65} />
      </mesh>
      {handle === 'bar' && (
        <mesh position={[0, 0, 0.03]} castShadow>
          <boxGeometry args={[Math.min(0.2, width * 0.4), 0.022, 0.022]} />
          <meshStandardMaterial color="#c8b89a" metalness={0.7} roughness={0.3} />
        </mesh>
      )}
    </group>
  );
}

/** کابینت پارامتریک: بدنه + درب/کشو + دستگیره + رویه + قفسه */
export function CabinetMesh(ctx: MeshCtx) {
  const { obj, selected, canInteract, refsMap, onSelect } = ctx;
  const p = obj.params;
  const w = p.w ?? 0.8;
  const h = p.h ?? 0.85;
  const d = p.d ?? 0.6;
  const bodyColor = p.bodyColor ?? '#6b4f3a';
  const doorColor = p.doorColor ?? '#7d5f45';
  const counterColor = p.countertopColor ?? '#d8d3c8';
  const handles = p.handles ?? 'bar';
  const doorCount = p.doors ?? 0;
  const drawerCount = p.drawers ?? 0;
  const hasCounter = obj.type === 'base' || obj.type === 'island';
  const isShelf = obj.type === 'shelf';

  const groupRef = useRef<THREE.Group>(null);
  const selectHandler = (e: { stopPropagation: () => void; shiftKey?: boolean }) => {
    e.stopPropagation();
    onSelect(obj.id, !!e.shiftKey);
  };

  // ارتفاع بخش درب‌ها: کشوها بالای درب‌ها هستند
  const drawerH = drawerCount > 0 ? Math.min(0.22, h / (drawerCount + 1)) : 0;
  const drawersTop = drawerCount * drawerH;
  const doorsH = h - drawersTop;

  const shelves = useMemo(() => {
    if (!isShelf) return [];
    const n = 3;
    return Array.from({ length: n }, (_, i) => ((i + 1) * h) / (n + 1));
  }, [isShelf, h]);

  const toggle = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (canInteract) ctx.onToggleOpen?.(obj.id);
  };

  return (
    <group
      ref={(g) => {
        if (g) {
          groupRef.current = g;
          refsMap.set(obj.id, g);
        }
      }}
      position={obj.position}
      rotation-y={obj.rotationY}
      onClick={selectHandler}
    >
      {/* بدنه */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={bodyColor} roughness={0.7} />
        {selected && <Edges scale={1.02} color="#f59e0b" />}
      </mesh>

      {/* داخل تیره (وقتی درب باز می‌شود دیده می‌شود) */}
      {!isShelf && (
        <mesh position={[0, drawersTop + doorsH / 2, d / 2 + 0.002]}>
          <boxGeometry args={[w * 0.94, Math.max(0.05, doorsH * 0.94), 0.008]} />
          <meshStandardMaterial color="#241c16" roughness={0.9} />
        </mesh>
      )}
      {drawerCount > 0 && (
        <mesh position={[0, h - drawersTop / 2, d / 2 + 0.002]}>
          <boxGeometry args={[w * 0.94, Math.max(0.05, drawersTop * 0.9), 0.008]} />
          <meshStandardMaterial color="#241c16" roughness={0.9} />
        </mesh>
      )}

      {/* قفسه‌های داخلی قفسه باز */}
      {isShelf &&
        shelves.map((y, i) => (
          <mesh key={i} position={[0, y, 0.01]} castShadow>
            <boxGeometry args={[w * 0.92, 0.03, d * 0.9]} />
            <meshStandardMaterial color={doorColor} roughness={0.7} />
          </mesh>
        ))}

      {/* رویه سنگی/چوبی */}
      {hasCounter && (
        <mesh position={[0, h + 0.02, 0]} castShadow receiveShadow>
          <boxGeometry args={[w + 0.05, 0.04, d + 0.05]} />
          <meshStandardMaterial color={counterColor} roughness={0.35} metalness={0.1} />
        </mesh>
      )}

      {/* درب‌ها */}
      {doorCount === 1 && doorsH > 0.05 && (
        <HingedDoor
          width={w - 0.02}
          height={doorsH - 0.02}
          side={-1}
          open={!!obj.open}
          color={doorColor}
          handle={handles}
          zBase={d / 2 + 0.025}
          hingeX={w / 2 - 0.01}
          yCenter={drawersTop + doorsH / 2}
          glass={!!p.glass}
          onClick={toggle}
        />
      )}
      {doorCount === 2 && doorsH > 0.05 && (
        <>
          <HingedDoor
            width={w / 2 - 0.015}
            height={doorsH - 0.02}
            side={-1}
            open={!!obj.open}
            color={doorColor}
            handle={handles}
            zBase={d / 2 + 0.025}
            hingeX={w / 2 - 0.01}
            yCenter={drawersTop + doorsH / 2}
            glass={!!p.glass}
            onClick={toggle}
          />
          <HingedDoor
            width={w / 2 - 0.015}
            height={doorsH - 0.02}
            side={1}
            open={!!obj.open}
            color={doorColor}
            handle={handles}
            zBase={d / 2 + 0.025}
            hingeX={w / 2 - 0.01}
            yCenter={drawersTop + doorsH / 2}
            glass={!!p.glass}
            onClick={toggle}
          />
        </>
      )}

      {/* کشوها */}
      {Array.from({ length: drawerCount }, (_, i) => (
        <Drawer
          key={i}
          width={w - 0.03}
          height={drawerH - 0.01}
          y={h - (i + 0.5) * drawerH}
          open={!!obj.open}
          color={doorColor}
          handle={handles}
          zBase={d / 2 + 0.025}
          onClick={toggle}
        />
      ))}
    </group>
  );
}
