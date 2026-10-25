'use client';

import * as THREE from 'three';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import type { MeshCtx } from './cabinet';

const hoverCursor = (e: { stopPropagation: () => void }) => {
  e.stopPropagation();
  document.body.style.cursor = 'pointer';
};
const unhover = () => {
  document.body.style.cursor = 'auto';
};

/** چراغ آویز با نور قابل کنترل */
export function PendantMesh(ctx: MeshCtx) {
  const { obj, selected, canInteract, refsMap, onSelect, onToggleLight } = ctx;
  const p = obj.params;
  const scale = p.scale ?? 1;
  const color = p.color ?? '#f59e0b';
  const on = !!obj.on;
  const intensity = p.intensity ?? 1.4;

  const click = (e: { stopPropagation: () => void }) => {
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
      onClick={select}
    >
      {/* سیم */}
      <mesh position={[0, -0.25 * scale, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.5 * scale, 8]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.6} />
      </mesh>
      {/* کاسه */}
      <mesh position={[0, -0.55 * scale, 0]} castShadow onClick={click} onPointerOver={hoverCursor} onPointerOut={unhover}>
        <cylinderGeometry args={[0.05 * scale, 0.2 * scale, 0.22 * scale, 24, 1, true]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.4} side={THREE.DoubleSide} />
        {selected && <Edges scale={1.03} color="#f59e0b" />}
      </mesh>
      {/* لامپ */}
      <mesh position={[0, -0.63 * scale, 0]}>
        <sphereGeometry args={[0.055 * scale, 16, 16]} />
        <meshStandardMaterial
          color={on ? '#fff3d6' : '#8a8578'}
          emissive={on ? '#ffd9a0' : '#000000'}
          emissiveIntensity={on ? 2.2 : 0}
        />
      </mesh>
      {on && (
        <pointLight
          position={[0, -0.7 * scale, 0]}
          intensity={intensity}
          distance={4.5}
          decay={2}
          color="#ffdcae"
        />
      )}
    </group>
  );
}

/** چراغ ایستاده (آباژور) با نور قابل کنترل */
export function FloorLampMesh(ctx: MeshCtx) {
  const { obj, selected, canInteract, refsMap, onSelect, onToggleLight } = ctx;
  const p = obj.params;
  const scale = p.scale ?? 1;
  const color = p.color ?? '#b45309';
  const on = !!obj.on;
  const intensity = p.intensity ?? 1.1;

  const click = (e: { stopPropagation: () => void }) => {
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
      onClick={select}
    >
      {/* پایه */}
      <mesh position={[0, 0.02 * scale, 0]} castShadow>
        <cylinderGeometry args={[0.16 * scale, 0.19 * scale, 0.04 * scale, 24]} />
        <meshStandardMaterial color="#3a3532" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* میله */}
      <mesh position={[0, 0.75 * scale, 0]} castShadow>
        <cylinderGeometry args={[0.018 * scale, 0.018 * scale, 1.42 * scale, 12]} />
        <meshStandardMaterial color="#4a4540" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* کاسه */}
      <mesh position={[0, 1.52 * scale, 0]} castShadow onClick={click} onPointerOver={hoverCursor} onPointerOut={unhover}>
        <cylinderGeometry args={[0.14 * scale, 0.2 * scale, 0.26 * scale, 24, 1, true]} />
        <meshStandardMaterial
          color={on ? '#ffe9c4' : color}
          emissive={on ? '#ffcf8a' : '#000000'}
          emissiveIntensity={on ? 0.7 : 0}
          roughness={0.6}
          side={THREE.DoubleSide}
        />
        {selected && <Edges scale={1.03} color="#f59e0b" />}
      </mesh>
      {on && (
        <pointLight
          position={[0, 1.48 * scale, 0]}
          intensity={intensity}
          distance={3.8}
          decay={2}
          color="#ffd9a8"
        />
      )}
    </group>
  );
}

/** گیاه دکوری */
export function PlantMesh(ctx: MeshCtx) {
  const { obj, selected, refsMap, onSelect } = ctx;
  const p = obj.params;
  const scale = p.scale ?? 1;
  const color = p.color ?? '#2e7d32';

  const select = (e: { stopPropagation: () => void; shiftKey?: boolean }) => {
    e.stopPropagation();
    onSelect(obj.id, !!e.shiftKey);
  };

  const blobs: Array<[number, number, number, number]> = [
    [0, 0.52, 0, 0.2],
    [0.14, 0.4, 0.06, 0.15],
    [-0.13, 0.42, -0.05, 0.14],
    [0.02, 0.62, -0.1, 0.16],
    [-0.06, 0.34, 0.12, 0.13],
  ];

  return (
    <group
      ref={(g) => {
        if (g) refsMap.set(obj.id, g);
      }}
      position={obj.position}
      rotation-y={obj.rotationY}
      scale={scale}
      onClick={select}
    >
      {/* گلدان */}
      <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.13, 0.1, 0.32, 20]} />
        <meshStandardMaterial color="#b0663f" roughness={0.6} envMapIntensity={0.5} />
        {selected && <Edges scale={1.03} color="#f59e0b" />}
      </mesh>
      {/* خاک */}
      <mesh position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.115, 0.115, 0.02, 20]} />
        <meshStandardMaterial color="#3d2f24" roughness={1} />
      </mesh>
      {/* برگ‌ها */}
      {blobs.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={color} roughness={0.8} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/** فرش */
export function RugMesh(ctx: MeshCtx) {
  const { obj, selected, refsMap, onSelect } = ctx;
  const p = obj.params;
  const scale = p.scale ?? 1;
  const color = p.color ?? '#9c4a3c';

  const select = (e: { stopPropagation: () => void; shiftKey?: boolean }) => {
    e.stopPropagation();
    onSelect(obj.id, !!e.shiftKey);
  };

  return (
    <group
      ref={(g) => {
        if (g) refsMap.set(obj.id, g);
      }}
      position={[obj.position[0], 0.012, obj.position[2]]}
      rotation-y={obj.rotationY}
      onClick={select}
    >
      <mesh receiveShadow>
        <boxGeometry args={[1.9 * scale, 0.024, 1.3 * scale]} />
        <meshStandardMaterial color={color} roughness={1} />
        {selected && <Edges scale={1.01} color="#f59e0b" />}
      </mesh>
      {/* حاشیه */}
      <mesh position={[0, 0.002, 0]}>
        <boxGeometry args={[1.78 * scale, 0.03, 1.18 * scale]} />
        <meshStandardMaterial color="#d9c5ae" roughness={1} />
      </mesh>
    </group>
  );
}
