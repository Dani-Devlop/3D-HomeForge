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
/** استیل براق با بازتاب محیط — فلز واقعی به‌جای پلاستیک */
const STEEL_MAT = { color: STEEL, metalness: 0.9, roughness: 0.25, envMapIntensity: 1.3 } as const;
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
  metalness = 0.6,
  roughness = 0.35,
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
  metalness?: number;
  roughness?: number;
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
        <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} envMapIntensity={1.1} />
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
        <meshStandardMaterial color={bodyColor} roughness={0.3} metalness={0.7} envMapIntensity={1.2} />
        {selected && <Edges scale={1.02} color={EDGE} />}
      </mesh>

      {/* درب فریزر (ثابت — باز نمی‌شود) — کمی روشن‌تر از بدنه */}
      <mesh position={[0, freezerY, d / 2 + 0.015]} castShadow>
        <boxGeometry args={[w - 0.04, freezerH, 0.03]} />
        <meshStandardMaterial color={doorColor} roughness={0.28} metalness={0.7} envMapIntensity={1.25} />
      </mesh>
      {/* دستگیره افقی فریزر */}
      <mesh position={[0, freezerY - freezerH / 2 + 0.07, d / 2 + 0.045]} castShadow>
        <boxGeometry args={[0.3, 0.026, 0.026]} />
        <meshStandardMaterial {...STEEL_MAT} />
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
        metalness={0.7}
        roughness={0.28}
      >
        {/* دستگیره عمودی کنار لبه بازشو */}
        <mesh position={[-mainW / 2 + 0.07, 0, 0.03]} castShadow>
          <boxGeometry args={[0.026, Math.min(0.55, mainH * 0.45), 0.026]} />
          <meshStandardMaterial {...STEEL_MAT} />
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
        <meshStandardMaterial color={bodyColor} roughness={0.35} metalness={0.6} envMapIntensity={1} />
        {selected && <Edges scale={1.02} color={EDGE} />}
      </mesh>

      {/* صفحه گاز تیره براق (شیشه‌ای) */}
      <mesh position={[0, h + 0.01, 0]} castShadow>
        <boxGeometry args={[w + 0.02, 0.02, d + 0.02]} />
        <meshStandardMaterial color={topColor} roughness={0.15} metalness={0.6} envMapIntensity={1.1} />
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
        <meshStandardMaterial color={bodyColor} roughness={0.35} metalness={0.6} envMapIntensity={1} />
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
          <meshStandardMaterial color="#17191d" roughness={0.35} metalness={0.6} envMapIntensity={1} />
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
          <meshStandardMaterial {...STEEL_MAT} />
        </mesh>
      </HingedDoor>

      {/* نوار کنترل و ولوم‌ها */}
      <mesh position={[0, h - 0.05, d / 2 + 0.009]}>
        <boxGeometry args={[w - 0.04, 0.1, 0.018]} />
        <meshStandardMaterial color="#2e3138" roughness={0.4} metalness={0.5} envMapIntensity={1} />
      </mesh>
      {[-w / 5, 0, w / 5].map((kx, i) => (
        <mesh key={`knob-${i}`} position={[kx, h - 0.05, d / 2 + 0.026]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.02, 0.02, 0.016, 16]} />
          <meshStandardMaterial {...STEEL_MAT} />
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
        <meshStandardMaterial color={bodyColor} roughness={0.35} metalness={0.6} envMapIntensity={1.1} />
        {selected && <Edges scale={1.02} color={EDGE} />}
      </mesh>

      {/* دودکش بالای کلاهک تا سمت سقف */}
      <mesh position={[0, h + 0.25, 0]} castShadow>
        <boxGeometry args={[w * 0.45, 0.5, d * 0.45]} />
        <meshStandardMaterial color={bodyColor} roughness={0.35} metalness={0.6} envMapIntensity={1.1} />
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

/** ماشین لباسشویی — درب گرد لولادار با شیشه تیره براق (هرگز کاملاً سیاه نیست) */
export function WasherMesh(ctx: MeshCtx) {
  const { obj, selected, canInteract, refsMap, onSelect } = ctx;
  const p = obj.params;
  const w = p.w ?? 0.6;
  const h = p.h ?? 0.85;
  const d = p.d ?? 0.6;
  const bodyColor = p.color ?? '#e8eaee';

  const toggleOpen = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (canInteract) ctx.onToggleOpen?.(obj.id);
  };
  const select = (e: { stopPropagation: () => void; shiftKey?: boolean }) => {
    e.stopPropagation();
    onSelect(obj.id, !!e.shiftKey);
  };

  const doorR = 0.21; // شعاع درب گرد
  const doorY = h * 0.44; // مرکز درب
  const openAngle = -1.1; // باز شدن درب به بیرون (لولا چپ)
  const hingeX = w / 2 - 0.035;
  const doorGroup = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!doorGroup.current) return;
    doorGroup.current.rotation.y = THREE.MathUtils.damp(
      doorGroup.current.rotation.y, obj.open ? openAngle : 0, 8, delta
    );
  });

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
        <meshStandardMaterial color={bodyColor} roughness={0.35} metalness={0.5} envMapIntensity={1} />
        {selected && <Edges scale={1.02} color={EDGE} />}
      </mesh>

      {/* پنل کنترل بالای دستگاه (کمی فرورفته) */}
      <mesh position={[0, h - 0.055, d / 2 - 0.004]}>
        <boxGeometry args={[w - 0.05, 0.075, 0.012]} />
        <meshStandardMaterial color="#d7dae0" roughness={0.45} metalness={0.2} />
      </mesh>
      {/* ولوم برنامه‌ها */}
      <mesh position={[w / 2 - 0.1, h - 0.055, d / 2 + 0.01]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.028, 0.028, 0.02, 20]} />
        <meshStandardMaterial color="#b8bcc4" roughness={0.35} metalness={0.5} />
      </mesh>
      {/* دو دکمه کوچک */}
      {[-0.16, -0.08].map((bx, i) => (
        <mesh key={`btn-${i}`} position={[bx, h - 0.055, d / 2 + 0.008]}>
          <boxGeometry args={[0.05, 0.02, 0.008]} />
          <meshStandardMaterial color="#aeb3bb" roughness={0.4} metalness={0.3} />
        </mesh>
      ))}
      {/* نمایشگر کوچک */}
      <mesh position={[0.02, h - 0.055, d / 2 + 0.009]}>
        <boxGeometry args={[0.1, 0.028, 0.006]} />
        <meshStandardMaterial color="#2a2e33" emissive="#7ee0a0" emissiveIntensity={0.5} roughness={0.3} />
      </mesh>

      {/* دیگ داخلی — کمی فرورفته و ثابت (از پشت شیشه دیده می‌شود) */}
      <mesh position={[0, doorY, d / 2 + 0.004]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.15, 0.15, 0.012, 28]} />
        <meshStandardMaterial color="#8b939c" roughness={0.4} metalness={0.5} envMapIntensity={1} />
      </mesh>

      {/* درب گرد لولادار (لولا چپ) — حلقه بیرونی + شیشه تیره براق */}
      <group ref={doorGroup} position={[-hingeX, doorY, d / 2 + 0.02]}>
        <mesh
          position={[doorR + 0.045, 0, 0.012]}
          castShadow
          onClick={toggleOpen}
          onPointerOver={hoverCursor}
          onPointerOut={unhover}
        >
          <torusGeometry args={[doorR, 0.022, 14, 40]} />
          <meshStandardMaterial color="#c9ccd2" roughness={0.25} metalness={0.7} envMapIntensity={1.2} />
        </mesh>
        {/* شیشه درب — تینت تیره براق، شفاف (نه سیاه خالص) */}
        <mesh
          position={[doorR + 0.045, 0, 0]}
          rotation-x={Math.PI / 2}
          castShadow
          onClick={toggleOpen}
          onPointerOver={hoverCursor}
          onPointerOut={unhover}
        >
          <cylinderGeometry args={[doorR - 0.005, doorR - 0.005, 0.018, 32]} />
          <meshPhysicalMaterial
            color="#3a4148"
            metalness={0.35}
            roughness={0.12}
            transparent
            opacity={0.85}
          />
        </mesh>
      </group>
    </group>
  );
}

/** ماشین ظرفشویی — درب تمام‌صفحه لولادار با دستگیره افقی */
export function DishwasherMesh(ctx: MeshCtx) {
  const { obj, selected, canInteract, refsMap, onSelect } = ctx;
  const p = obj.params;
  const w = p.w ?? 0.6;
  const h = p.h ?? 0.85;
  const d = p.d ?? 0.6;
  const bodyColor = p.bodyColor ?? '#c2c7cf';
  const doorColor = p.color ?? '#c9cdd4';

  const toggleOpen = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (canInteract) ctx.onToggleOpen?.(obj.id);
  };
  const select = (e: { stopPropagation: () => void; shiftKey?: boolean }) => {
    e.stopPropagation();
    onSelect(obj.id, !!e.shiftKey);
  };

  const doorH = h - 0.07;

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
        <meshStandardMaterial color={bodyColor} roughness={0.35} metalness={0.5} envMapIntensity={1} />
        {selected && <Edges scale={1.02} color={EDGE} />}
      </mesh>

      {/* نوار کنترل باریک بالای درب */}
      <mesh position={[0, h - 0.026, d / 2 + 0.008]} castShadow>
        <boxGeometry args={[w - 0.06, 0.042, 0.014]} />
        <meshStandardMaterial color="#9aa0a8" roughness={0.4} metalness={0.35} />
      </mesh>

      {/* درب لولادار (لولا چپ) با دستگیره افقی نزدیک لبه بالا */}
      <HingedDoor
        width={w - 0.02}
        height={doorH}
        side={-1}
        open={!!obj.open}
        color={doorColor}
        zBase={d / 2 + 0.015}
        hingeX={w / 2 - 0.01}
        yCenter={doorH / 2 + 0.005}
        onClick={toggleOpen}
      >
        <mesh position={[0, doorH / 2 - 0.06, 0.032]} castShadow>
          <boxGeometry args={[Math.min(0.42, (w - 0.02) * 0.62), 0.026, 0.026]} />
          <meshStandardMaterial {...STEEL_MAT} />
        </mesh>
      </HingedDoor>
    </group>
  );
}

/** مایکروویو رومیزی — پنجره شیشه‌ای روشن + ستون کنترل؛ درب کامل باز می‌شود */
export function MicrowaveMesh(ctx: MeshCtx) {
  const { obj, selected, canInteract, refsMap, onSelect } = ctx;
  const p = obj.params;
  const w = p.w ?? 0.5;
  const h = p.h ?? 0.3;
  const d = p.d ?? 0.38;
  const bodyColor = p.bodyColor ?? '#33373e';

  const toggleOpen = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (canInteract) ctx.onToggleOpen?.(obj.id);
  };
  const select = (e: { stopPropagation: () => void; shiftKey?: boolean }) => {
    e.stopPropagation();
    onSelect(obj.id, !!e.shiftKey);
  };

  const doorW = w * 0.62; // درب = ۶۵٪ عرض جلو (بدون احتساب لبه)
  const doorH = h - 0.04;

  return (
    <group
      ref={(g) => {
        if (g) refsMap.set(obj.id, g);
      }}
      position={obj.position}
      rotation-y={obj.rotationY}
      onClick={select}
    >
      {/* بدنه — کف روی نقطه نصب (position.y = mountY) */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={bodyColor} roughness={0.4} metalness={0.5} envMapIntensity={1} />
        {selected && <Edges scale={1.02} color={EDGE} />}
      </mesh>

      {/* درب چپ لولادار (لولا چپ) با پنجره شیشه‌ای روشن */}
      <HingedDoor
        width={doorW}
        height={doorH}
        side={-1}
        open={!!obj.open}
        color={bodyColor}
        zBase={d / 2 + 0.012}
        hingeX={w / 2 - 0.008}
        yCenter={h / 2}
        onClick={toggleOpen}
      >
        {/* قاب تیره پنجره */}
        <mesh position={[0, 0, 0.014]} onClick={toggleOpen} onPointerOver={hoverCursor} onPointerOut={unhover}>
          <boxGeometry args={[w * 0.4, h * 0.66, 0.007]} />
          <meshStandardMaterial color="#1d2025" roughness={0.4} metalness={0.3} />
        </mesh>
        {/* شیشه پنجره — سبز-آبی روشن و شفاف (هرگز سیاه) */}
        <mesh position={[0, 0, 0.019]} onClick={toggleOpen} onPointerOver={hoverCursor} onPointerOut={unhover}>
          <boxGeometry args={[w * 0.34, h * 0.55, 0.008]} />
          <meshStandardMaterial
            color="#9fb4bd"
            transparent
            opacity={0.4}
            roughness={0.1}
            metalness={0.1}
          />
        </mesh>
        {/* دستگیره عمودی لبه بازشو (سمت ستون کنترل) */}
        <mesh position={[doorW / 2 - 0.02, 0, 0.032]} castShadow>
          <boxGeometry args={[0.02, doorH - 0.06, 0.026]} />
          <meshStandardMaterial {...STEEL_MAT} />
        </mesh>
      </HingedDoor>

      {/* ستون کنترل راست (کلیک = انتخاب) */}
      <group
        position={[w / 2 - w * 0.175, h / 2, d / 2 + 0.012]}
        onClick={select}
        onPointerOver={hoverCursor}
        onPointerOut={unhover}
      >
        {/* نمایشگر کوچک سبز */}
        <mesh position={[0, h * 0.28, 0.002]}>
          <boxGeometry args={[w * 0.15, 0.03, 0.006]} />
          <meshStandardMaterial color="#181b1f" emissive="#7ee0a0" emissiveIntensity={0.8} roughness={0.3} />
        </mesh>
        {/* دو ولوم */}
        {[-w * 0.09, w * 0.09].map((kx, i) => (
          <mesh key={`knob-${i}`} position={[kx, -h * 0.08, 0.004]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.02, 0.02, 0.014, 18]} />
            <meshStandardMaterial {...STEEL_MAT} />
          </mesh>
        ))}
        {/* سه دکمه کوچک */}
        {[-w * 0.09, 0, w * 0.09].map((bx, i) => (
          <mesh key={`btn-${i}`} position={[bx, -h * 0.28, 0.002]}>
            <boxGeometry args={[0.032, 0.02, 0.006]} />
            <meshStandardMaterial color="#565b63" roughness={0.4} metalness={0.4} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
