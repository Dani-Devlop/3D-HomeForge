'use client';

// ============================================================
// 3D home furniture — TV, sofa, bed, table, chair
// Patterns adapted from cabinet.tsx (MeshCtx/Edges) and appliance.tsx (hover/light)
// ============================================================

import { useMemo } from 'react';
import { Edges } from '@react-three/drei';
import type { MeshCtx } from './cabinet';
import { woodGrainTexture } from './textures';

const EDGE = '#f59e0b'; // Selection edge color
const LEG_DARK = '#2a2118'; // Dark wooden legs

const hoverCursor = (e: { stopPropagation: () => void }) => {
  e.stopPropagation();
  document.body.style.cursor = 'pointer';
};
const unhover = () => {
  document.body.style.cursor = 'auto';
};

/** Lighten/darken a hex color (positive amount = mix with white, negative = with black) */
function shadeColor(hex: string, amount: number): string {
  const n = hex.replace('#', '');
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const mix = (c: number) =>
    Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  return `#${((mix(r) << 16) | (mix(g) << 8) | mix(b)).toString(16).padStart(6, '0')}`;
}

/** Wall-mounted TV — group origin at the mount height (position.y = mountY); click screen = toggle power */
export function TvMesh(ctx: MeshCtx) {
  const { obj, selected, canInteract, refsMap, onSelect, onToggleLight } = ctx;
  const p = obj.params;
  const w = p.w ?? 1.2;
  const h = p.h ?? 0.7;
  const d = p.d ?? 0.06;
  const screenColor = p.color ?? '#101318';
  const frameColor = p.bodyColor ?? '#1b1f26';
  const on = !!obj.on;

  const toggleLight = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (canInteract) onToggleLight?.(obj.id);
    else onSelect(obj.id, false);
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
      {/* Wall bracket behind the panel */}
      <mesh position={[0, 0, -d / 2 - 0.025]} castShadow>
        <boxGeometry args={[0.2, 0.2, 0.05]} />
        <meshStandardMaterial color="#3a3d42" roughness={0.5} metalness={0.5} />
      </mesh>

      {/* Main panel frame (click = light/screen) */}
      <mesh
        position={[0, 0, 0]}
        castShadow
        receiveShadow
        onClick={toggleLight}
        onPointerOver={hoverCursor}
        onPointerOut={unhover}
      >
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={frameColor} roughness={0.3} metalness={0.4} envMapIntensity={0.9} />
        {selected && <Edges scale={1.02} color={EDGE} />}
      </mesh>

      {/* Display — glows bright and lively when on */}
      <mesh
        position={[0, 0, d / 2 + 0.006]}
        castShadow
        onClick={toggleLight}
        onPointerOver={hoverCursor}
        onPointerOut={unhover}
      >
        <boxGeometry args={[w - 0.04, h - 0.04, 0.01]} />
        <meshStandardMaterial
          color={screenColor}
          emissive={on ? '#cfe6f5' : '#000000'}
          emissiveIntensity={on ? 1.6 : 0}
          metalness={0.35}
          roughness={0.15}
        />
        {selected && <Edges scale={1.01} color={EDGE} />}
      </mesh>

      {/* Screen glow light while on */}
      {on && (
        <pointLight
          position={[0, 0, 0.35]}
          intensity={0.5}
          distance={2.5}
          decay={2}
          color="#bfe3ff"
        />
      )}
    </group>
  );
}

/** Three-seat sofa — body + seat cushions + backrest + arms + pillows */
export function SofaMesh(ctx: MeshCtx) {
  const { obj, selected, refsMap, onSelect } = ctx;
  const p = obj.params;
  const w = p.w ?? 2.0;
  const h = p.h ?? 0.8;
  const d = p.d ?? 0.9;
  const color = p.color ?? '#5d6b7a';
  const bodyColor = p.bodyColor ?? '#4e5a68';

  const select = (e: { stopPropagation: () => void; shiftKey?: boolean }) => {
    e.stopPropagation();
    onSelect(obj.id, !!e.shiftKey);
  };

  const legH = 0.1;
  const baseH = 0.32;
  const baseY = legH + baseH / 2; // Body center
  const seatTop = legH + baseH; // 0.42
  const cushionH = 0.14;
  const armW = 0.16;
  const innerW = w - armW * 2;
  const nCushions = w >= 1.8 ? 3 : 2;
  const cushionW = (innerW - (nCushions - 1) * 0.02) / nCushions;
  const backH = h * 0.45;

  return (
    <group
      ref={(g) => {
        if (g) refsMap.set(obj.id, g);
      }}
      position={obj.position}
      rotation-y={obj.rotationY}
      onClick={select}
    >
      {/* Wooden legs */}
      {[
        [-w / 2 + 0.12, -d / 2 + 0.12],
        [w / 2 - 0.12, -d / 2 + 0.12],
        [-w / 2 + 0.12, d / 2 - 0.12],
        [w / 2 - 0.12, d / 2 - 0.12],
      ].map(([lx, lz], i) => (
        <mesh key={`leg-${i}`} position={[lx, legH / 2, lz]} castShadow>
          <cylinderGeometry args={[0.03, 0.025, legH, 10]} />
          <meshStandardMaterial color={LEG_DARK} roughness={0.6} />
        </mesh>
      ))}

      {/* Main body */}
      <mesh position={[0, baseY, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, baseH, d]} />
        <meshStandardMaterial color={bodyColor} roughness={0.95} />
        {selected && <Edges scale={1.02} color={EDGE} />}
      </mesh>

      {/* Seat cushions (2 or 3 pieces) */}
      {Array.from({ length: nCushions }, (_, i) => (
        <mesh
          key={`cushion-${i}`}
          position={[
            (i - (nCushions - 1) / 2) * (cushionW + 0.02),
            seatTop + cushionH / 2 - 0.01,
            0.03,
          ]}
          castShadow
        >
          <boxGeometry args={[cushionW, cushionH, d - 0.24]} />
          <meshStandardMaterial color={color} roughness={0.95} />
        </mesh>
      ))}

      {/* Backrest */}
      <mesh position={[0, seatTop + backH / 2 - 0.02, -d / 2 + 0.09]} castShadow>
        <boxGeometry args={[w, backH, 0.18]} />
        <meshStandardMaterial color={bodyColor} roughness={0.95} />
        {selected && <Edges scale={1.02} color={EDGE} />}
      </mesh>

      {/* Side arms */}
      <mesh position={[-w / 2 + armW / 2, seatTop / 2 + 0.06, 0]} castShadow>
        <boxGeometry args={[armW, seatTop + 0.12, d]} />
        <meshStandardMaterial color={bodyColor} roughness={0.95} />
      </mesh>
      <mesh position={[w / 2 - armW / 2, seatTop / 2 + 0.06, 0]} castShadow>
        <boxGeometry args={[armW, seatTop + 0.12, d]} />
        <meshStandardMaterial color={bodyColor} roughness={0.95} />
      </mesh>

      {/* Two tilted decorative pillows */}
      <mesh position={[-w / 4, seatTop + 0.14, -d / 2 + 0.3]} rotation={[-0.18, 0, 0.22]} castShadow>
        <boxGeometry args={[0.34, 0.34, 0.1]} />
        <meshStandardMaterial color={shadeColor(color, 0.25)} roughness={0.95} />
      </mesh>
      <mesh position={[w / 4, seatTop + 0.14, -d / 2 + 0.3]} rotation={[-0.18, 0, -0.22]} castShadow>
        <boxGeometry args={[0.34, 0.34, 0.1]} />
        <meshStandardMaterial color={shadeColor(color, 0.25)} roughness={0.95} />
      </mesh>
    </group>
  );
}

/** Double bed — frame + mattress + blanket + pillows + headboard */
export function BedMesh(ctx: MeshCtx) {
  const { obj, selected, refsMap, onSelect } = ctx;
  const p = obj.params;
  const w = p.w ?? 1.6;
  const h = p.h ?? 0.55;
  const d = p.d ?? 2.0;
  const color = p.color ?? '#8d6e63'; // Blanket color
  const bodyColor = p.bodyColor ?? '#6d4c41';
  const mattressColor = '#e8e2d8';

  const select = (e: { stopPropagation: () => void; shiftKey?: boolean }) => {
    e.stopPropagation();
    onSelect(obj.id, !!e.shiftKey);
  };

  const legH = 0.12;
  const mattressH = 0.2;
  const frameH = Math.min(0.4, Math.max(0.15, h - legH - mattressH)); // Frame height derived from the h param
  const frameTop = legH + frameH;
  const mattressD = d - 0.15;
  const mattressTop = frameTop + mattressH;
  const blanketD = mattressD * 0.55 + 0.06; // Covers the bottom 55% + a bit more
  const blanketZ = mattressD / 2 - blanketD / 2 + 0.03;

  return (
    <group
      ref={(g) => {
        if (g) refsMap.set(obj.id, g);
      }}
      position={obj.position}
      rotation-y={obj.rotationY}
      onClick={select}
    >
      {/* Legs */}
      {[
        [-w / 2 + 0.1, -d / 2 + 0.1],
        [w / 2 - 0.1, -d / 2 + 0.1],
        [-w / 2 + 0.1, d / 2 - 0.1],
        [w / 2 - 0.1, d / 2 - 0.1],
      ].map(([lx, lz], i) => (
        <mesh key={`leg-${i}`} position={[lx, legH / 2, lz]} castShadow>
          <boxGeometry args={[0.08, legH, 0.08]} />
          <meshStandardMaterial color={bodyColor} roughness={0.7} />
        </mesh>
      ))}

      {/* Bed frame */}
      <mesh position={[0, legH + frameH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, frameH, d]} />
        <meshStandardMaterial color={bodyColor} roughness={0.75} />
        {selected && <Edges scale={1.02} color={EDGE} />}
      </mesh>

      {/* Headboard (head side — toward the back) */}
      <mesh position={[0, legH + 0.35, -d / 2 + 0.04]} castShadow>
        <boxGeometry args={[w, 0.7, 0.08]} />
        <meshStandardMaterial color={bodyColor} roughness={0.75} />
        {selected && <Edges scale={1.02} color={EDGE} />}
      </mesh>

      {/* Light mattress */}
      <mesh position={[0, frameTop + mattressH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w - 0.1, mattressH, mattressD]} />
        <meshStandardMaterial color={mattressColor} roughness={0.95} />
      </mesh>

      {/* Blanket over the lower half (foot side) */}
      <mesh position={[0, mattressTop + 0.04, blanketZ]} castShadow>
        <boxGeometry args={[w + 0.02, 0.1, blanketD]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      {/* Blanket draping down the mattress sides */}
      <mesh position={[0, mattressTop - 0.06, blanketZ]}>
        <boxGeometry args={[w + 0.045, 0.12, blanketD - 0.06]} />
        <meshStandardMaterial color={shadeColor(color, -0.12)} roughness={0.95} />
      </mesh>

      {/* Two white pillows on the head side */}
      <mesh position={[-w / 4 - 0.02, mattressTop + 0.07, -mattressD / 2 + 0.26]} rotation-x={-0.12} castShadow>
        <boxGeometry args={[0.55, 0.12, 0.35]} />
        <meshStandardMaterial color="#f4f1ea" roughness={0.95} />
      </mesh>
      <mesh position={[w / 4 + 0.02, mattressTop + 0.07, -mattressD / 2 + 0.26]} rotation-x={-0.12} castShadow>
        <boxGeometry args={[0.55, 0.12, 0.35]} />
        <meshStandardMaterial color="#f4f1ea" roughness={0.95} />
      </mesh>
    </group>
  );
}

/** Dining table — top + four legs */
export function TableMesh(ctx: MeshCtx) {
  const { obj, selected, refsMap, onSelect } = ctx;
  const p = obj.params;
  const w = p.w ?? 1.5;
  const h = p.h ?? 0.75;
  const d = p.d ?? 0.9;
  const color = p.color ?? '#7a5c3f';
  const bodyColor = p.bodyColor ?? '#6b4e34';

  const select = (e: { stopPropagation: () => void; shiftKey?: boolean }) => {
    e.stopPropagation();
    onSelect(obj.id, !!e.shiftKey);
  };

  const topH = 0.05;
  const legH = h - topH;
  const inset = 0.08;

  // Table wood grain — generated once per color (textures module cache)
  const topTex = useMemo(() => woodGrainTexture(color), [color]);
  const legTex = useMemo(() => woodGrainTexture(bodyColor), [bodyColor]);

  return (
    <group
      ref={(g) => {
        if (g) refsMap.set(obj.id, g);
      }}
      position={obj.position}
      rotation-y={obj.rotationY}
      onClick={select}
    >
      {/* Tabletop */}
      <mesh position={[0, h - topH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, topH, d]} />
        <meshStandardMaterial
          map={topTex ?? undefined}
          color={topTex ? '#ffffff' : color}
          roughness={0.5}
          envMapIntensity={0.5}
        />
        {selected && <Edges scale={1.02} color={EDGE} />}
      </mesh>

      {/* Four legs */}
      {[
        [-w / 2 + inset, -d / 2 + inset],
        [w / 2 - inset, -d / 2 + inset],
        [-w / 2 + inset, d / 2 - inset],
        [w / 2 - inset, d / 2 - inset],
      ].map(([lx, lz], i) => (
        <mesh key={`leg-${i}`} position={[lx, legH / 2, lz]} castShadow receiveShadow>
          <boxGeometry args={[0.06, legH, 0.06]} />
          <meshStandardMaterial
            map={legTex ?? undefined}
            color={legTex ? '#ffffff' : bodyColor}
            roughness={0.55}
            envMapIntensity={0.5}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Chair — seat + backrest + four legs */
export function ChairMesh(ctx: MeshCtx) {
  const { obj, selected, refsMap, onSelect } = ctx;
  const p = obj.params;
  const h = p.h ?? 0.9;
  const color = p.color ?? '#6b4e34';
  const bodyColor = p.bodyColor ?? shadeColor(color, -0.35);

  const select = (e: { stopPropagation: () => void; shiftKey?: boolean }) => {
    e.stopPropagation();
    onSelect(obj.id, !!e.shiftKey);
  };

  const seatY = 0.45;
  const seatH = 0.05;
  const seatW = 0.42;
  const seatD = 0.42;
  const legH = seatY - seatH / 2;
  const legInset = 0.045;
  const backH = Math.max(0.3, h - seatY); // Backrest from the seat up to full height

  // Chair wood grain (textures module cache)
  const seatTex = useMemo(() => woodGrainTexture(color), [color]);
  const legTex = useMemo(() => woodGrainTexture(bodyColor), [bodyColor]);

  return (
    <group
      ref={(g) => {
        if (g) refsMap.set(obj.id, g);
      }}
      position={obj.position}
      rotation-y={obj.rotationY}
      onClick={select}
    >
      {/* Seat */}
      <mesh position={[0, seatY, 0]} castShadow receiveShadow>
        <boxGeometry args={[seatW, seatH, seatD]} />
        <meshStandardMaterial
          map={seatTex ?? undefined}
          color={seatTex ? '#ffffff' : color}
          roughness={0.5}
          envMapIntensity={0.5}
        />
        {selected && <Edges scale={1.03} color={EDGE} />}
      </mesh>

      {/* Backrest */}
      <mesh position={[0, seatY + backH / 2, -seatD / 2 + 0.02]} castShadow>
        <boxGeometry args={[seatW, backH, 0.04]} />
        <meshStandardMaterial
          map={seatTex ?? undefined}
          color={seatTex ? '#ffffff' : color}
          roughness={0.5}
          envMapIntensity={0.5}
        />
        {selected && <Edges scale={1.03} color={EDGE} />}
      </mesh>

      {/* Four legs */}
      {[
        [-seatW / 2 + legInset, -seatD / 2 + legInset],
        [seatW / 2 - legInset, -seatD / 2 + legInset],
        [-seatW / 2 + legInset, seatD / 2 - legInset],
        [seatW / 2 - legInset, seatD / 2 - legInset],
      ].map(([lx, lz], i) => (
        <mesh key={`leg-${i}`} position={[lx, legH / 2, lz]} castShadow>
          <boxGeometry args={[0.035, legH, 0.035]} />
          <meshStandardMaterial
            map={legTex ?? undefined}
            color={legTex ? '#ffffff' : bodyColor}
            roughness={0.55}
            envMapIntensity={0.5}
          />
        </mesh>
      ))}
    </group>
  );
}
