'use client';

import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import type { SceneObject } from '@/lib/scene-types';
import { shadeHex, stoneCountertopTexture, woodGrainTexture } from './textures';

export type RefsMap = Map<string, THREE.Group>;

/** Handle steel — strong environment reflection for a real-metal feel */
const HANDLE_STEEL = {
  color: '#c9c9cf',
  metalness: 0.95,
  roughness: 0.28,
  envMapIntensity: 1.4,
} as const;

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

const OPEN_ANGLE = 1.75; // Door opening angle (radians)
const DRAWER_OUT = 0.34; // Drawer extension (meters)

function useCursor(pointer: boolean) {
  return (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    document.body.style.cursor = pointer ? 'pointer' : 'auto';
  };
}

/** Hinged door with smooth animation (Mesh States pattern) — glass variant: bright blue-green transparent, never black */
function HingedDoor({
  width,
  height,
  side, // -1 = hinge left, +1 = hinge right
  open,
  color,
  handle,
  zBase,
  hingeX,
  yCenter,
  glass,
  onClick,
}: {
  width: number; // Width of each door
  height: number;
  side: 1 | -1; // -1 = hinge on the cabinet's left, +1 = hinge on the right
  open: boolean;
  color: string;
  handle: string;
  zBase: number;
  hingeX: number; // hinge distance from the cabinet center (≈ w/2)
  yCenter: number; // door center height from the cabinet origin
  glass?: boolean; // transparent glass door with a narrow frame
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

  // Door wood grain — generated once per color (textures module cache)
  const doorTex = useMemo(() => woodGrainTexture(color), [color]);
  const woodMat = doorTex ? (
    <meshPhysicalMaterial
      map={doorTex}
      color="#ffffff"
      roughness={0.4}
      clearcoat={0.55}
      clearcoatRoughness={0.35}
      envMapIntensity={0.7}
    />
  ) : (
    <meshPhysicalMaterial
      color={color}
      roughness={0.4}
      clearcoat={0.55}
      clearcoatRoughness={0.35}
      envMapIntensity={0.7}
    />
  );
  // Narrow frame around the glass door — same grain
  const frameMat = doorTex ? (
    <meshStandardMaterial map={doorTex} color="#ffffff" roughness={0.5} envMapIntensity={0.6} />
  ) : (
    <meshStandardMaterial color={color} roughness={0.5} envMapIntensity={0.6} />
  );

  const handleEl =
    handle === 'bar' ? (
      <mesh
        position={[-side * (width - 0.06), 0, 0.035]}
        castShadow
      >
        <boxGeometry args={[0.025, Math.min(0.16, height * 0.4), 0.025]} />
        <meshStandardMaterial {...HANDLE_STEEL} />
      </mesh>
    ) : handle === 'knob' ? (
      <mesh position={[-side * (width - 0.05), 0, 0.035]} castShadow>
        <sphereGeometry args={[0.022, 16, 16]} />
        <meshStandardMaterial {...HANDLE_STEEL} />
      </mesh>
    ) : null;

  const T = 0.03; // Glass frame thickness
  const D = 0.028; // Frame depth

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
          {/* Bright transparent glass with a very soft glow — never black */}
          <mesh castShadow>
            <boxGeometry args={[width, height, 0.014]} />
            <meshStandardMaterial
              color="#cdeaf2"
              emissive="#a8c8d8"
              emissiveIntensity={0.12}
              transparent
              opacity={0.28}
              roughness={0.08}
              metalness={0}
              envMapIntensity={1.3}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Narrow frame around the glass — top and bottom */}
          <mesh position={[0, height / 2 - T / 2, 0]} castShadow>
            <boxGeometry args={[width, T, D]} />
            {frameMat}
          </mesh>
          <mesh position={[0, -height / 2 + T / 2, 0]} castShadow>
            <boxGeometry args={[width, T, D]} />
            {frameMat}
          </mesh>
          {/* Narrow frame around the glass — left and right */}
          <mesh position={[-width / 2 + T / 2, 0, 0]} castShadow>
            <boxGeometry args={[T, height - T * 2, D]} />
            {frameMat}
          </mesh>
          <mesh position={[width / 2 - T / 2, 0, 0]} castShadow>
            <boxGeometry args={[T, height - T * 2, D]} />
            {frameMat}
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
          {woodMat}
        </mesh>
      )}
      {handleEl}
    </group>
  );
}

/** Pull-out drawer with smooth animation */
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
  const drawerTex = useMemo(() => woodGrainTexture(color), [color]);
  return (
    <group ref={group} position={[0, y, zBase]}>
      <mesh castShadow onClick={onClick} onPointerOver={hover} onPointerOut={() => (document.body.style.cursor = 'auto')}>
        <boxGeometry args={[width, height, 0.032]} />
        <meshPhysicalMaterial
          map={drawerTex ?? undefined}
          color={drawerTex ? '#ffffff' : color}
          roughness={0.4}
          clearcoat={0.55}
          clearcoatRoughness={0.35}
          envMapIntensity={0.7}
        />
      </mesh>
      {handle === 'bar' && (
        <mesh position={[0, 0, 0.03]} castShadow>
          <boxGeometry args={[Math.min(0.2, width * 0.4), 0.022, 0.022]} />
          <meshStandardMaterial {...HANDLE_STEEL} />
        </mesh>
      )}
    </group>
  );
}

/** Parametric cabinet: body + door/drawer + handle + countertop + shelf */
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

  // Door section height: drawers sit above the doors
  const drawerH = drawerCount > 0 ? Math.min(0.22, h / (drawerCount + 1)) : 0;
  const drawersTop = drawerCount * drawerH;
  const doorsH = h - drawersTop;

  const shelves = useMemo(() => {
    if (!isShelf) return [];
    const n = 3;
    return Array.from({ length: n }, (_, i) => ((i + 1) * h) / (n + 1));
  }, [isShelf, h]);

  // Textures — body slightly darker than the doors, polished stone countertop (textures module cache)
  const bodyTex = useMemo(() => woodGrainTexture(shadeHex(bodyColor, -0.18)), [bodyColor]);
  const counterTex = useMemo(() => stoneCountertopTexture(counterColor), [counterColor]);
  const shelfTex = useMemo(() => woodGrainTexture(doorColor), [doorColor]);

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
      {/* Body — darker wood grain */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial
          map={bodyTex ?? undefined}
          color={bodyTex ? '#ffffff' : bodyColor}
          roughness={0.55}
          envMapIntensity={0.5}
        />
        {selected && <Edges scale={1.02} color="#f59e0b" />}
      </mesh>

      {/* Dark interior (visible when the door opens) */}
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

      {/* Interior shelves of the open shelf unit */}
      {isShelf &&
        shelves.map((y, i) => (
          <mesh key={i} position={[0, y, 0.01]} castShadow>
            <boxGeometry args={[w * 0.92, 0.03, d * 0.9]} />
            <meshStandardMaterial
              map={shelfTex ?? undefined}
              color={shelfTex ? '#ffffff' : doorColor}
              roughness={0.55}
              envMapIntensity={0.5}
            />
          </mesh>
        ))}

      {/* Stone/wood countertop — polished stone with environment reflection */}
      {hasCounter && (
        <mesh position={[0, h + 0.02, 0]} castShadow receiveShadow>
          <boxGeometry args={[w + 0.05, 0.04, d + 0.05]} />
          <meshStandardMaterial
            map={counterTex ?? undefined}
            color={counterTex ? '#ffffff' : counterColor}
            roughness={0.25}
            metalness={0.05}
            envMapIntensity={0.9}
          />
        </mesh>
      )}

      {/* Doors */}
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

      {/* Drawers */}
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
