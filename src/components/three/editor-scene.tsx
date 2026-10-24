'use client';

import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, TransformControls, Grid } from '@react-three/drei';
import type { ObjectType, RoomSpec, SceneObject } from '@/lib/scene-types';
import { CabinetMesh, type MeshCtx, type RefsMap } from './cabinet';
import { FloorLampMesh, PendantMesh, PlantMesh, RugMesh } from './decor';
import { RoomMesh } from './room';

/** نور محیطی مشترک */
export function SceneEnvironment() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <hemisphereLight intensity={0.35} groundColor="#b8a58c" color="#ffffff" />
      <directionalLight
        position={[3.5, 6, 2.5]}
        intensity={0.85}
        color="#fff4e0"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      <directionalLight position={[-4, 3, -3]} intensity={0.18} />
    </>
  );
}

function ObjectEntry(ctx: MeshCtx) {
  switch (ctx.obj.type) {
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

/** کنترل جابه‌جایی آبجکت انتخاب‌شده */
function SelectionTransform({
  targetId,
  refsMap,
  enabled,
  onBegin,
  onChange,
  onEnd,
}: {
  targetId: string | null;
  refsMap: RefsMap;
  enabled: boolean;
  onBegin: () => void;
  onChange: (id: string) => void;
  onEnd: () => void;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setTick((x) => x + 1), 50);
    return () => clearTimeout(t);
  }, [targetId]);

  const target = enabled && targetId ? refsMap.get(targetId) : undefined;
  if (!target || !targetId) return null;
  return (
    <TransformControls
      object={target}
      mode="translate"
      translationSnap={0.05}
      size={0.8}
      onMouseDown={onBegin}
      onObjectChange={() => onChange(targetId)}
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
}

export default function EditorScene(props: EditorSceneProps) {
  const {
    roomSpec, objects, selectedIds, canTransform, showGrid,
    refsMap, glRef, sceneRootRef, placeRequestRef,
    onSelect, onToggleOpen, onToggleLight, onBeginAction, onMoved, onPlace,
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
        gl.setClearColor('#d9d2c7');
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
