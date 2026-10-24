'use client';

import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, TransformControls } from '@react-three/drei';
import type { RoomSpec, SceneObject } from '@/lib/scene-types';
import { CabinetMesh, type MeshCtx, type RefsMap } from './cabinet';
import { FloorLampMesh, PendantMesh, PlantMesh, RugMesh } from './decor';
import { RoomMesh } from './room';
import { SceneEnvironment } from './editor-scene';

function ViewerTransform({
  targetId,
  refsMap,
  enabled,
  onBegin,
  onEnd,
}: {
  targetId: string | null;
  refsMap: RefsMap;
  enabled: boolean;
  onBegin: () => void;
  onEnd: (id: string) => void;
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
      onMouseUp={() => onEnd(targetId)}
    />
  );
}

export interface ViewerSceneProps {
  roomSpec: RoomSpec;
  objects: SceneObject[];
  canMove: boolean;
  refsMap: RefsMap;
  onSelect: (id: string | null) => void;
  onToggleOpen: (id: string) => void;
  onToggleLight: (id: string) => void;
  onBeginAction: () => void;
  onMoved: (id: string) => void;
  cameraKey: number;
}

export default function ViewerScene(props: ViewerSceneProps) {
  const {
    roomSpec, objects, canMove, refsMap,
    onSelect, onToggleOpen, onToggleLight, onBeginAction, onMoved, cameraKey,
  } = props;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cameraPos = useMemo<[number, number, number]>(
    () => [0.8, 1.6, roomSpec.depthM / 2 + 1.8],
    [roomSpec]
  );

  const handleSelect = (id: string | null) => {
    setSelectedId(id);
    onSelect(id);
  };

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      key={cameraKey}
      camera={{ position: cameraPos, fov: 50 }}
      gl={{ antialias: true }}
      onCreated={({ gl }) => gl.setClearColor('#d9d2c7')}
      onPointerMissed={() => handleSelect(null)}
    >
      <SceneEnvironment />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        target={[0, 1.1, 0]}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={0.8}
        maxDistance={12}
      />
      <RoomMesh spec={roomSpec} />
      {objects.map((obj) => (
        <ObjectEntryV
          key={obj.id}
          obj={obj}
          selected={selectedId === obj.id}
          canInteract
          canMove={canMove}
          refsMap={refsMap}
          onSelect={(id) => handleSelect(id)}
          onToggleOpen={onToggleOpen}
          onToggleLight={onToggleLight}
        />
      ))}
      <ViewerTransform
        targetId={selectedId}
        refsMap={refsMap}
        enabled={canMove}
        onBegin={onBeginAction}
        onEnd={onMoved}
      />
    </Canvas>
  );
}

function ObjectEntryV(ctx: MeshCtx) {
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
