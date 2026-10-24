'use client';

import * as THREE from 'three';
import { useMemo } from 'react';
import type { DoorwaySpec, RoomSpec, WindowSpec } from '@/lib/scene-types';

interface RoomDims {
  w: number;
  d: number;
  h: number;
}

/** موقعیت و چرخش یک صفحه روی دیوار داخلی (با آفست در طول دیوار) */
function wallPlacement(wall: string, room: RoomDims, offsetX = 0) {
  const inset = 0.015;
  switch (wall) {
    case 'front':
      return { position: [offsetX, 0, room.d / 2 - inset] as const, rotationY: Math.PI };
    case 'left':
      return { position: [-room.w / 2 + inset, 0, offsetX] as const, rotationY: Math.PI / 2 };
    case 'right':
      return { position: [room.w / 2 - inset, 0, offsetX] as const, rotationY: -Math.PI / 2 };
    case 'back':
    default:
      return { position: [offsetX, 0, -room.d / 2 + inset] as const, rotationY: 0 };
  }
}

/** قاب ساده دور یک بازشو (پنجره/درب) روی دیوار */
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

function WindowCutout({ spec, room }: { spec: WindowSpec; room: RoomDims }) {
  const { position, rotationY } = wallPlacement(spec.wall, room, spec.offsetX);
  const cy = spec.sillY + spec.height / 2;
  return (
    <group
      position={[position[0], cy, position[2]]}
      rotation={[0, rotationY, 0]}
    >
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
  );
}

function DoorwayCutout({ spec, room }: { spec: DoorwaySpec; room: RoomDims }) {
  const { position, rotationY } = wallPlacement(spec.wall, room, spec.offsetX);
  return (
    <group position={[position[0], spec.height / 2, position[2]]} rotation={[0, rotationY, 0]}>
      {/* دهانه تیره */}
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[spec.width, spec.height]} />
        <meshStandardMaterial color="#3c342e" roughness={0.9} />
      </mesh>
      <Frame width={spec.width} height={spec.height} thickness={0.06} color="#efe9df" />
    </group>
  );
}

/** اتاق بازسازی‌شده: کف + دیوارها (BackSide برای دید داخلی) + بازشوها */
export function RoomMesh({ spec }: { spec: RoomSpec }) {
  const room = useMemo<RoomDims>(
    () => ({ w: spec.widthM, d: spec.depthM, h: spec.heightM }),
    [spec]
  );

  return (
    <group>
      {/* کف */}
      <mesh rotation-x={-Math.PI / 2} position-y={0} receiveShadow>
        <planeGeometry args={[room.w, room.d]} />
        <meshStandardMaterial color={spec.floorColor} roughness={0.85} />
      </mesh>

      {/* دیوارها + سقف — فقط از داخل دیده می‌شوند */}
      <mesh position={[0, room.h / 2, 0]} receiveShadow>
        <boxGeometry args={[room.w, room.h, room.d]} />
        <meshStandardMaterial color={spec.wallColor} side={THREE.BackSide} roughness={0.95} />
      </mesh>

      {/* قرنیز */}
      <group>
        <mesh position={[0, 0.05, -room.d / 2 + 0.02]}>
          <boxGeometry args={[room.w, 0.1, 0.04]} />
          <meshStandardMaterial color="#e0d8ca" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.05, room.d / 2 - 0.02]}>
          <boxGeometry args={[room.w, 0.1, 0.04]} />
          <meshStandardMaterial color="#e0d8ca" roughness={0.7} />
        </mesh>
        <mesh position={[-room.w / 2 + 0.02, 0.05, 0]}>
          <boxGeometry args={[0.04, 0.1, room.d]} />
          <meshStandardMaterial color="#e0d8ca" roughness={0.7} />
        </mesh>
        <mesh position={[room.w / 2 - 0.02, 0.05, 0]}>
          <boxGeometry args={[0.04, 0.1, room.d]} />
          <meshStandardMaterial color="#e0d8ca" roughness={0.7} />
        </mesh>
      </group>

      {spec.windows.map((win, i) => (
        <WindowCutout key={`w-${i}`} spec={win} room={room} />
      ))}
      {spec.doorways.map((dr, i) => (
        <DoorwayCutout key={`d-${i}`} spec={dr} room={room} />
      ))}
    </group>
  );
}
