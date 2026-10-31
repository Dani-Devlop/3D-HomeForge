'use client';

import { useMemo, useRef, useState } from 'react';
import { useInView } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { RoomSpec, SceneObject } from '@/lib/scene-types';
import { normalizeOutline, outlineBBox } from '@/lib/polygon';
import { SceneEnvironment } from './editor-scene';
import { applyToneMapping } from './scene-quality';
import { useSceneBackground } from './scene-background';
import { RoomMesh } from './room';
import { CabinetMesh, type MeshCtx, type RefsMap } from './cabinet';
import { FloorLampMesh, PendantMesh, PlantMesh, RugMesh } from './decor';
import { BedMesh, ChairMesh, SofaMesh, TableMesh, TvMesh } from './furniture';
import {
  DishwasherMesh,
  FridgeMesh,
  HoodMesh,
  MicrowaveMesh,
  StoveMesh,
  WasherMesh,
} from './appliance';

// ============================================================
// Portfolio live 3D scene — the same engine as the editor, inside a landing card
// Auto-rotate + drag rotation + door/light interaction (Mesh States)
// ============================================================

const clampNum = (v: unknown, min: number, max: number, dflt: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : Number.NaN;
  return Number.isNaN(n) ? dflt : Math.min(max, Math.max(min, n));
};

/** Normalize an incomplete database roomSpec into a complete, safe RoomSpec */
export function normalizeRoomSpec(
  raw: Partial<RoomSpec> | Record<string, never> | null | undefined,
): RoomSpec {
  const s = (raw ?? {}) as Partial<RoomSpec>;
  const outline = normalizeOutline(s.outline) ?? undefined;
  // With a valid outline, the reference dimensions must be the plan's bbox
  let widthM = clampNum(s.widthM, 2, 15, 4.2);
  let depthM = clampNum(s.depthM, 2, 15, 3.6);
  if (outline) {
    const bb = outlineBBox(outline);
    widthM = Math.min(15, Math.max(2, Math.round(bb.w * 100) / 100));
    depthM = Math.min(15, Math.max(2, Math.round(bb.d * 100) / 100));
  }
  return {
    widthM,
    depthM,
    heightM: clampNum(s.heightM, 2.2, 4.2, 2.7),
    ...(outline ? { outline } : {}),
    wallColor: typeof s.wallColor === 'string' ? s.wallColor : '#efe9df',
    floorColor: typeof s.floorColor === 'string' ? s.floorColor : '#c8b294',
    ceilingColor: typeof s.ceilingColor === 'string' ? s.ceilingColor : '#f7f4ee',
    windows: Array.isArray(s.windows) ? s.windows : [],
    doorways: Array.isArray(s.doorways) ? s.doorways : [],
  };
}

/** Valid scene objects (drops broken/incomplete ones) — a missing id is guaranteed to be filled (React key) */
export function normalizeSceneObjects(raw: unknown): SceneObject[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (o): o is SceneObject =>
        !!o &&
        typeof o === 'object' &&
        typeof (o as SceneObject).type === 'string' &&
        Array.isArray((o as SceneObject).position) &&
        ((o as SceneObject).position as unknown[]).length === 3,
    )
    .map((o, i) => ({
      ...o,
      id: typeof o.id === 'string' && o.id ? o.id : `po-${i}`,
    }));
}

/** Does this portfolio item have a live 3D model? */
export function hasLiveScene(sceneState: unknown): boolean {
  return (
    !!sceneState &&
    typeof sceneState === 'object' &&
    normalizeSceneObjects((sceneState as { objects?: unknown }).objects).length > 0
  );
}

type Override = { open?: boolean; on?: boolean };

function ObjectEntryP({ obj, ctx }: { obj: SceneObject; ctx: (o: SceneObject) => MeshCtx }) {
  switch (obj.type) {
    case 'fridge':
      return <FridgeMesh {...ctx(obj)} />;
    case 'stove':
      return <StoveMesh {...ctx(obj)} />;
    case 'hood':
      return <HoodMesh {...ctx(obj)} />;
    case 'washer':
      return <WasherMesh {...ctx(obj)} />;
    case 'dishwasher':
      return <DishwasherMesh {...ctx(obj)} />;
    case 'microwave':
      return <MicrowaveMesh {...ctx(obj)} />;
    case 'tv':
      return <TvMesh {...ctx(obj)} />;
    case 'sofa':
      return <SofaMesh {...ctx(obj)} />;
    case 'bed':
      return <BedMesh {...ctx(obj)} />;
    case 'table':
      return <TableMesh {...ctx(obj)} />;
    case 'chair':
      return <ChairMesh {...ctx(obj)} />;
    case 'pendant':
      return <PendantMesh {...ctx(obj)} />;
    case 'floor-lamp':
      return <FloorLampMesh {...ctx(obj)} />;
    case 'plant':
      return <PlantMesh {...ctx(obj)} />;
    case 'rug':
      return <RugMesh {...ctx(obj)} />;
    default:
      return <CabinetMesh {...ctx(obj)} />;
  }
}

export default function PortfolioScene({
  roomSpec,
  sceneState,
  autoRotate = true,
}: {
  roomSpec: Partial<RoomSpec> | Record<string, never> | null | undefined;
  sceneState: { objects?: SceneObject[] } | Record<string, never> | null | undefined;
  /** Auto-rotate (turned off in the preview) */
  autoRotate?: boolean;
}) {
  const spec = useMemo(() => normalizeRoomSpec(roomSpec), [roomSpec]);
  const baseObjects = useMemo(
    () => normalizeSceneObjects((sceneState as { objects?: unknown } | null)?.objects),
    [sceneState],
  );

  // Live interaction: open/close doors and toggle lights without changing the underlying data
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const refsMap = useRef<RefsMap>(new Map()).current;

  const objects = useMemo(
    () =>
      baseObjects.map((o) => {
        const ov = overrides[o.id];
        if (!ov) return o;
        return {
          ...o,
          open: ov.open ?? o.open,
          on: ov.on ?? o.on,
        };
      }),
    [baseObjects, overrides],
  );

  const toggleOpen = (id: string) =>
    setOverrides((prev) => {
      const cur = prev[id]?.open ?? baseObjects.find((o) => o.id === id)?.open ?? false;
      return { ...prev, [id]: { ...prev[id], open: !cur } };
    });
  const toggleLight = (id: string) =>
    setOverrides((prev) => {
      const cur = prev[id]?.on ?? baseObjects.find((o) => o.id === id)?.on ?? false;
      return { ...prev, [id]: { ...prev[id], on: !cur } };
    });

  const ctx = (obj: SceneObject): MeshCtx => ({
    obj,
    selected: false,
    canInteract: true,
    canMove: false,
    refsMap,
    onSelect: () => {},
    onToggleOpen: toggleOpen,
    onToggleLight: toggleLight,
  });

  // Camera: dollhouse view from above-front scaled to the room size
  const dist = useMemo(() => Math.hypot(spec.widthM, spec.depthM) * 0.95 + 1.0, [spec]);
  const cameraPos = useMemo<[number, number, number]>(
    () => [dist * 0.72, Math.max(2.4, dist * 0.5), dist * 0.85],
    [dist],
  );
  const target = useMemo<[number, number, number]>(() => [0, spec.heightM * 0.32, 0], [spec]);

  // Render only while the card is in view (performance — multiple scenes on one page)
  const holderRef = useRef<HTMLDivElement>(null);
  const inView = useInView(holderRef, { once: true, margin: '160px' });

  const sceneBg = useSceneBackground();

  return (
    <div ref={holderRef} className="absolute inset-0">
      {inView ? (
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ position: cameraPos, fov: 46 }}
          gl={{ antialias: true }}
          onCreated={({ gl }) => {
            applyToneMapping(gl);
          }}
        >
          <SceneEnvironment />
          <color attach="background" args={[sceneBg]} />
          <OrbitControls
            makeDefault={false}
            enableDamping
            dampingFactor={0.08}
            autoRotate={autoRotate}
            autoRotateSpeed={0.9}
            enableZoom={false}
            enablePan={false}
            target={target}
            minPolarAngle={0.25}
            maxPolarAngle={Math.PI / 2.05}
          />
          <RoomMesh spec={spec} />
          {objects.map((obj) => (
            <ObjectEntryP key={obj.id} obj={obj} ctx={ctx} />
          ))}
        </Canvas>
      ) : (
        <div className="absolute inset-0 bg-muted animate-pulse" aria-hidden />
      )}
    </div>
  );
}
