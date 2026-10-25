'use client';

import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, TransformControls, Grid } from '@react-three/drei';
import type { RoomSpec, SceneObject } from '@/lib/scene-types';
import { applyWallDrag, beginWallDrag, isWallSnapType } from './wall-snap';
import { DishwasherMesh, FridgeMesh, HoodMesh, MicrowaveMesh, StoveMesh, WasherMesh } from './appliance';
import { CabinetMesh, type MeshCtx, type RefsMap } from './cabinet';
import { FloorLampMesh, PendantMesh, PlantMesh, RugMesh } from './decor';
import { BedMesh, ChairMesh, SofaMesh, TableMesh, TvMesh } from './furniture';
import { RoomMesh } from './room';
import { SceneQuality, applyToneMapping } from './scene-quality';

/**
 * نور محیطی مشترک — لایه کیفیت (سایه نرم PCSS + محیط استودیویی PBR) هم اینجاست
 * سایه فقط از خورشید RoomMesh می‌آید (دقیقاً یک نور سایه‌انداز در هر صحنه)
 */
export function SceneEnvironment() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <hemisphereLight intensity={0.3} groundColor="#b8a58c" color="#ffffff" />
      {/* پرکن گرم نرم — بدون سایه (جهت و سایه از خورشید اتاق) */}
      <directionalLight position={[3.5, 6, 2.5]} intensity={0.5} color="#fff4e0" />
      {/* ریم‌لایت ملایم از پشت */}
      <directionalLight position={[-4, 3, -3]} intensity={0.15} />
      <SceneQuality />
    </>
  );
}

function ObjectEntry(ctx: MeshCtx) {
  switch (ctx.obj.type) {
    case 'fridge':
      return <FridgeMesh {...ctx} />;
    case 'stove':
      return <StoveMesh {...ctx} />;
    case 'hood':
      return <HoodMesh {...ctx} />;
    case 'washer':
      return <WasherMesh {...ctx} />;
    case 'dishwasher':
      return <DishwasherMesh {...ctx} />;
    case 'microwave':
      return <MicrowaveMesh {...ctx} />;
    case 'tv':
      return <TvMesh {...ctx} />;
    case 'sofa':
      return <SofaMesh {...ctx} />;
    case 'bed':
      return <BedMesh {...ctx} />;
    case 'table':
      return <TableMesh {...ctx} />;
    case 'chair':
      return <ChairMesh {...ctx} />;
    case 'pendant':
      return <PendantMesh {...ctx} />;
    case 'floor-lamp':
      return <FloorLampMesh {...ctx} />;
    case 'plant':
      return <PlantMesh {...ctx} />;
    case 'rug':
      return <RugMesh {...ctx} />;
    default:
      return <CabinetMesh {...ctx} />;
  }
}

/** دریافت مختصات صفحه → نقطه روی کف (برای Drag & Drop) */
function DropReceiver({
  placeRequestRef,
  onPlace,
}: {
  placeRequestRef: MutableRefObject<((sx: number, sy: number) => void) | null>;
  onPlace: (x: number, z: number) => void;
}) {
  const { camera, gl } = useThree();
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);

  useEffect(() => {
    placeRequestRef.current = (sx: number, sy: number) => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((sx - rect.left) / rect.width) * 2 - 1,
        -((sy - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      const pt = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, pt)) {
        onPlace(pt.x, pt.z);
      }
    };
    return () => {
      placeRequestRef.current = null;
    };
  }, [camera, gl, plane, raycaster, onPlace, placeRequestRef]);

  return null;
}

/** کنترل جابه‌جایی آبجکت انتخاب‌شده — انواع دیواری روی دیوار سُر می‌خورند */
function SelectionTransform({
  targetId,
  refsMap,
  enabled,
  spec,
  objects,
  wallSnap,
  onBegin,
  onChange,
  onEnd,
}: {
  targetId: string | null;
  refsMap: RefsMap;
  enabled: boolean;
  spec: RoomSpec;
  objects: SceneObject[];
  wallSnap: boolean;
  onBegin: () => void;
  onChange: (id: string) => void;
  onEnd: () => void;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setTick((x) => x + 1), 50);
    return () => clearTimeout(t);
  }, [targetId]);

  // پل ref به گروه هدف — دست‌کاری مستقیم در هندلرها از مسیر ref انجام می‌شود
  const targetGroupRef = useRef<THREE.Group | null>(null);
  useEffect(() => {
    targetGroupRef.current = (enabled && targetId ? refsMap.get(targetId) : undefined) ?? null;
  }, [enabled, targetId, refsMap]);

  // وضعیت درگ روی دیوار (در mouseDown قفل می‌شود)
  const wallDragRef = useRef<ReturnType<typeof beginWallDrag> | null>(null);
  // Alt نگه‌داشته شده → موقتاً آزاد (بدون چسبیدن)
  const altRef = useRef(false);
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === 'Alt') altRef.current = true;
    };
    const ku = (e: KeyboardEvent) => {
      if (e.key === 'Alt') altRef.current = false;
    };
    const blur = () => {
      altRef.current = false;
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
    };
  }, []);

  const target = enabled && targetId ? refsMap.get(targetId) : undefined;
  if (!target || !targetId) return null;

  const handleMouseDown = () => {
    // قفل لبه/ارتفاع در لحظه شروع درگ (برای انواع دیواری)
    const obj = objects.find((o) => o.id === targetId);
    wallDragRef.current =
      wallSnap && obj && isWallSnapType(obj.type)
        ? beginWallDrag(spec, {
            ...obj,
            position: [target.position.x, target.position.y, target.position.z],
          })
        : null;
    onBegin();
  };

  const handleObjectChange = () => {
    const g = targetGroupRef.current;
    const st = wallDragRef.current;
    if (st && wallSnap && !altRef.current && g) {
      // موقعیت خام گیزموت → پروجکت روی لبه قفل‌شده و بازنویسی روی همان آبجکت
      const { position, rotationY } = applyWallDrag(spec, st, g.position.x, g.position.z);
      g.position.set(position[0], position[1], position[2]);
      g.rotation.y = rotationY;
    }
    onChange(targetId);
  };

  return (
    <TransformControls
      object={target}
      mode="translate"
      translationSnap={0.05}
      size={0.8}
      onMouseDown={handleMouseDown}
      onObjectChange={handleObjectChange}
      onMouseUp={onEnd}
    />
  );
}

export interface EditorSceneProps {
  roomSpec: RoomSpec;
  objects: SceneObject[];
  selectedIds: string[];
  canTransform: boolean;
  showGrid: boolean;
  refsMap: RefsMap;
  glRef: MutableRefObject<THREE.WebGLRenderer | null>;
  sceneRootRef: MutableRefObject<THREE.Group | null>;
  placeRequestRef: MutableRefObject<((sx: number, sy: number) => void) | null>;
  onSelect: (id: string | null, additive?: boolean) => void;
  onToggleOpen: (id: string) => void;
  onToggleLight: (id: string) => void;
  onBeginAction: () => void;
  onMoved: (id: string) => void;
  onPlace: (x: number, z: number) => void;
  /** چسبیدن انواع دیواری به دیوار حین درگ (با Alt موقتاً آزاد) */
  wallSnapEnabled: boolean;
}

export default function EditorScene(props: EditorSceneProps) {
  const {
    roomSpec, objects, selectedIds, canTransform, showGrid,
    refsMap, glRef, sceneRootRef, placeRequestRef,
    onSelect, onToggleOpen, onToggleLight, onBeginAction, onMoved, onPlace,
    wallSnapEnabled,
  } = props;

  const primaryId = selectedIds.length ? selectedIds[selectedIds.length - 1] : null;
  const cameraPos = useMemo<[number, number, number]>(
    () => [roomSpec.widthM * 0.9, roomSpec.heightM * 1.6, roomSpec.depthM * 1.4 + 1.5],
    [roomSpec]
  );

  const missed = (e: MouseEvent) => {
    if (!e.shiftKey) onSelect(null);
  };

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: cameraPos, fov: 45 }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      onCreated={({ gl }) => {
        glRef.current = gl;
        gl.setClearColor('#cdc6ba');
        applyToneMapping(gl);
      }}
      onPointerMissed={missed}
    >
      <SceneEnvironment />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        target={[0, 1, 0]}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={1.2}
        maxDistance={16}
      />

      <group ref={(g) => { sceneRootRef.current = g; }}>
        <RoomMesh spec={roomSpec} />
        {objects.map((obj) => (
          <ObjectEntry
            key={obj.id}
            obj={obj}
            selected={selectedIds.includes(obj.id)}
            canInteract
            canMove={canTransform}
            refsMap={refsMap}
            onSelect={onSelect}
            onToggleOpen={onToggleOpen}
            onToggleLight={onToggleLight}
          />
        ))}
      </group>

      {showGrid && (
        <Grid
          position={[0, 0.004, 0]}
          args={[roomSpec.widthM, roomSpec.depthM]}
          cellSize={0.25}
          cellThickness={0.5}
          cellColor="#c9bfae"
          sectionSize={1}
          sectionThickness={1}
          sectionColor="#b3a48d"
          fadeDistance={22}
          fadeStrength={1}
          infiniteGrid={false}
        />
      )}

      <SelectionTransform
        targetId={primaryId}
        refsMap={refsMap}
        enabled={canTransform}
        spec={roomSpec}
        objects={objects}
        wallSnap={wallSnapEnabled}
        onBegin={onBeginAction}
        onChange={onMoved}
        onEnd={() => {
          if (primaryId) onMoved(primaryId);
        }}
      />

      <DropReceiver placeRequestRef={placeRequestRef} onPlace={onPlace} />
    </Canvas>
  );
}
