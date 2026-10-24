'use client';

// ============================================================
// لوازم خانگی سه‌بعدی — یخچال، اجاق گاز، هود
// الگوها اقتباس‌شده از cabinet.tsx (MeshCtx/HingedDoor/Edges) و decor.tsx (نور)
// ============================================================

import * as THREE from 'three';
import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import type { MeshCtx } from './cabinet';

const OPEN_ANGLE = 1.75; // زاویه باز شدن درب (رادیان) — مطابق کابینت
const STEEL = '#d9dde2'; // رنگ دستگیره‌های استیل
const EDGE = '#f59e0b'; // رنگ لبه‌های حالت انتخاب

const hoverCursor = (e: { stopPropagation: () => void }) => {
  e.stopPropagation();
  document.body.style.cursor = 'pointer';
};
const unhover = () => {
  document.body.style.cursor = 'auto';
};

/** درب لولادار با انیمیشن نرم (الگوی Mesh States — اقتباس از cabinet.tsx) */
function HingedDoor({
  width,
  height,
  side, // -1 = لولا چپ، +1 = لولا راست
  open,
  color,
  zBase,
  hingeX,
  yCenter,
  onClick,
  children,
}: {
  width: number;
  height: number;
  side: 1 | -1;
  open: boolean;
  color: string;
  zBase: number;
  hingeX: number; // فاصله لولا از مرکز دستگاه (≈ w/2)
  yCenter: number; // ارتفاع مرکز درب از مبدأ دستگاه
  onClick: (e: { stopPropagation: () => void }) => void;
  children?: ReactNode; // اضافه‌های روی درب (پنجره/دستگیره) — مختصات نسبت به مرکز درب
}) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!group.current) return;
    const target = open ? side * OPEN_ANGLE : 0;
    group.current.rotation.y = THREE.MathUtils.damp(
      group.current.rotation.y, target, 8, delta
    );
  });

  return (
    <group ref={group} position={[side * hingeX, yCenter, zBase]}>
      <mesh
        position={[-side * (width / 2), 0, 0]}
        castShadow
        onClick={onClick}
        onPointerOver={hoverCursor}
        onPointerOut={unhover}
      >
        <boxGeometry args={[width, height, 0.03]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.35} />
      </mesh>
      <group position={[-side * (width / 2), 0, 0]}>{children}</group>
    </group>
  );
}

/** یخچال ایستاده — جلو رو به +Z */
export function FridgeMesh(ctx: MeshCtx) {
  const { obj, selected, canInteract, refsMap, onSelect } = ctx;
  const p = obj.params;
  const w = p.w ?? 0.75;
  const h = p.h ?? 1.8;
  const d = p.d ?? 0.7;
  const bodyColor = p.bodyColor ?? '#b9bec6';
  const doorColor = p.doorColor ?? '#cdd2d9';

  const toggle = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (canInteract) ctx.onToggleOpen?.(obj.id);
  };
  const select = (e: { stopPropagation: () => void; shiftKey?: boolean }) => {
    e.stopPropagation();
    onSelect(obj.id, !!e.shiftKey);
  };

  // چیدمان جلو: درب اصلی پایین (~۷۲٪) + درب فریزر ثابت بالا + درز تیره بین آن‌ها
  const freezerH = h * 0.26;
  const mainH = h - freezerH - 0.06;
  const mainW = w - 0.02;
  const mainY = 0.02 + mainH / 2;
  const seamY = 0.02 + mainH + 0.01;
  const freezerY = h - 0.02 - freezerH / 2;

  return (
    <group
      ref={(g) => {
        if (g) refsMap.set(obj.id, g);
      }}
      position={obj.position}
      rotation-y={obj.rotationY}
      onClick={select}
    >
      {/* بدنه استیل */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={bodyColor} roughness={0.35} metalness={0.55} />
        {selected && <Edges scale={1.02} color={EDGE} />}
      </mesh>

      {/* درب فریزر (ثابت — باز نمی‌شود) */}
      <mesh position={[0, freezerY, d / 2 + 0.015]} castShadow>
        <boxGeometry args={[w - 0.04, freezerH, 0.03]} />
        <meshStandardMaterial color={doorColor} roughness={0.4} metalness={0.35} />
      </mesh>
      {/* دستگیره افقی فریزر */}
      <mesh position={[0, freezerY - freezerH / 2 + 0.07, d / 2 + 0.045]} castShadow>
        <boxGeometry args={[0.3, 0.026, 0.026]} />
        <meshStandardMaterial color={STEEL} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* درز تیره بین دو درب */}
      <mesh position={[0, seamY, d / 2 + 0.004]}>
        <boxGeometry args={[w - 0.02, 0.012, 0.008]} />
        <meshStandardMaterial color="#2a2c30" roughness={0.6} />
      </mesh>

      {/* درب اصلی لولادار (لولا راست، بازشو به سمت چپ) */}
      <HingedDoor
        width={mainW}
        height={mainH}
        side={1}
        open={!!obj.open}
        color={doorColor}
        zBase={d / 2 + 0.015}
        hingeX={w / 2 - 0.01}
        yCenter={mainY}
        onClick={toggle}
      >
        {/* دستگیره عمودی کنار لبه بازشو */}
        <mesh position={[-mainW / 2 + 0.07, 0, 0.03]} castShadow>
          <boxGeometry args={[0.026, Math.min(0.55, mainH * 0.45), 0.026]} />
          <meshStandardMaterial color={STEEL} metalness={0.7} roughness={0.3} />
        </mesh>
      </HingedDoor>
    </group>
  );
}

/** اجاق گاز (فر + صفحه) — جلو رو به +Z */
export function StoveMesh(ctx: MeshCtx) {
  const { obj, selected, canInteract, refsMap, onSelect, onToggleLight } = ctx;
  const p = obj.params;
  const w = p.w ?? 0.6;
  const h = p.h ?? 0.9;
  const d = p.d ?? 0.6;
  const bodyColor = p.bodyColor ?? '#4a4e55';
  const doorColor = p.doorColor ?? '#34373c';
  const topColor = p.countertopColor ?? '#1e2024';
  const on = !!obj.on;

  const toggleOpen = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (canInteract) ctx.onToggleOpen?.(obj.id);
  };
  const toggleLight = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (canInteract) onToggleLight?.(obj.id);
  };
  const select = (e: { stopPropagation: () => void; shiftKey?: boolean }) => {
    e.stopPropagation();
    onSelect(obj.id, !!e.shiftKey);
  };

  // شبکه ۲×۲ شعله‌پخش‌کن‌ها روی صفحه
  const burners: Array<[number, number]> = [
    [-w / 4, -d / 4],
    [w / 4, -d / 4],
    [-w / 4, d / 4],
    [w / 4, d / 4],
  ];

  const doorH = h * 0.6;
  const doorY = 0.03 + doorH / 2;

  return (
    <group
      ref={(g) => {
        if (g) refsMap.set(obj.id, g);
      }}
      position={obj.position}
      rotation-y={obj.rotationY}
      onClick={select}
    >
      {/* بدنه */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={bodyColor} roughness={0.5} metalness={0.4} />
        {selected && <Edges scale={1.02} color={EDGE} />}
      </mesh>

      {/* صفحه گاز تیره براق */}
      <mesh position={[0, h + 0.01, 0]} castShadow>
        <boxGeometry args={[w + 0.02, 0.02, d + 0.02]} />
        <meshStandardMaterial color={topColor} roughness={0.25} metalness={0.6} />
      </mesh>

      {/* پنل پشتی (کلیک = روشن/خاموش شعله‌ها) */}
      <mesh
        position={[0, h + 0.04, -d / 2 + 0.012]}
        castShadow
        onClick={toggleLight}
        onPointerOver={hoverCursor}
        onPointerOut={unhover}
      >
        <boxGeometry args={[w - 0.04, 0.08, 0.02]} />
        <meshStandardMaterial color={bodyColor} roughness={0.5} metalness={0.4} />
      </mesh>

      {/* شعله‌پخش‌کن‌ها (کلیک = روشن/خاموش شعله‌ها) */}
      {burners.map(([bx, bz], i) => (
        <mesh
          key={`burner-${i}`}
          position={[bx, h + 0.026, bz]}
          castShadow
          onClick={toggleLight}
          onPointerOver={hoverCursor}
          onPointerOut={unhover}
        >
          <cylinderGeometry args={[0.07, 0.07, 0.012, 24]} />
          <meshStandardMaterial color="#17191d" roughness={0.45} metalness={0.6} />
        </mesh>
      ))}

      {/* حلقه‌های شعله هنگام روشن بودن */}
      {on &&
        burners.map(([bx, bz], i) => (
          <mesh key={`flame-${i}`} position={[bx, h + 0.034, bz]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.05, 0.008, 12, 32]} />
            <meshStandardMaterial color="#ff5a1f" emissive="#ff5a1f" emissiveIntensity={2.5} />
          </mesh>
        ))}
      {on && (
        <pointLight
          position={[0, h + 0.12, 0]}
          intensity={0.6}
          distance={1.2}
          decay={2}
          color="#ff8c42"
        />
      )}

      {/* درب فر لولادار (لولا چپ) با پنجره تیره */}
      <HingedDoor
        width={w - 0.02}
        height={doorH}
        side={-1}
        open={!!obj.open}
        color={doorColor}
        zBase={d / 2 + 0.015}
        hingeX={w / 2 - 0.01}
        yCenter={doorY}
        onClick={toggleOpen}
      >
        {/* پنجره شیشه‌ای تیره (~۶۰٪ سطح درب) */}
        <mesh position={[0, 0, 0.02]}>
          <boxGeometry args={[(w - 0.02) * 0.6, doorH * 0.6, 0.01]} />
          <meshStandardMaterial color="#14161a" roughness={0.1} metalness={0.3} />
        </mesh>
        {/* دستگیره افقی بالای درب */}
        <mesh position={[0, doorH / 2 - 0.06, 0.03]} castShadow>
          <boxGeometry args={[Math.min(0.36, (w - 0.02) * 0.5), 0.024, 0.024]} />
          <meshStandardMaterial color={STEEL} metalness={0.7} roughness={0.3} />
        </mesh>
      </HingedDoor>

      {/* نوار کنترل و ولوم‌ها */}
      <mesh position={[0, h - 0.05, d / 2 + 0.009]}>
        <boxGeometry args={[w - 0.04, 0.1, 0.018]} />
        <meshStandardMaterial color="#2e3138" roughness={0.45} metalness={0.4} />
      </mesh>
      {[-w / 5, 0, w / 5].map((kx, i) => (
        <mesh key={`knob-${i}`} position={[kx, h - 0.05, d / 2 + 0.026]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.02, 0.02, 0.016, 16]} />
          <meshStandardMaterial color={STEEL} metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

/** هود دیواری — مبدأ گروه روی نقطه نصب (position.y = mountY) */
export function HoodMesh(ctx: MeshCtx) {
  const { obj, selected, canInteract, refsMap, onSelect, onToggleLight } = ctx;
  const p = obj.params;
  const w = p.w ?? 0.6;
  const h = p.h ?? 0.14;
  const d = p.d ?? 0.5;
  const bodyColor = p.bodyColor ?? '#aab0b8';
  const on = !!obj.on;
  const intensity = p.intensity ?? 0.9;

  const toggleLight = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (canInteract) onToggleLight?.(obj.id);
  };
  const select = (e: { stopPropagation: () => void; shiftKey?: boolean }) => {
    e.stopPropagation();
    onSelect(obj.id, !!e.shiftKey);
  };

  return (
    <group
      ref={(g) => {
        if (g) refsMap.set(obj.id, g);
      }}
      position={obj.position}
      rotation-y={obj.rotationY}
      onClick={select}
    >
      {/* کلاهک اصلی — روی نقطه نصب می‌نشیند (کلیک = چراغ) */}
      <mesh
        position={[0, h / 2, 0]}
        castShadow
        receiveShadow
        onClick={toggleLight}
        onPointerOver={hoverCursor}
        onPointerOut={unhover}
      >
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={bodyColor} roughness={0.35} metalness={0.5} />
        {selected && <Edges scale={1.02} color={EDGE} />}
      </mesh>

      {/* دودکش بالای کلاهک تا سمت سقف */}
      <mesh position={[0, h + 0.25, 0]} castShadow>
        <boxGeometry args={[w * 0.45, 0.5, d * 0.45]} />
        <meshStandardMaterial color={bodyColor} roughness={0.35} metalness={0.5} />
        {selected && <Edges scale={1.02} color={EDGE} />}
      </mesh>

      {/* نوار نور زیر کلاهک (کلیک = چراغ) */}
      <mesh
        position={[0, -0.008, 0]}
        onClick={toggleLight}
        onPointerOver={hoverCursor}
        onPointerOut={unhover}
      >
        <boxGeometry args={[w * 0.7, 0.015, 0.06]} />
        <meshStandardMaterial
          color={on ? '#fff3d6' : '#d8d5cc'}
          emissive={on ? '#fff3d6' : '#000000'}
          emissiveIntensity={on ? 2 : 0}
        />
      </mesh>

      {on && (
        <pointLight
          position={[0, -0.18, 0]}
          intensity={intensity}
          distance={2.2}
          decay={2}
          color="#ffe9c8"
        />
      )}
    </group>
  );
}
