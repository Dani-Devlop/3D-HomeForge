import { create } from 'zustand';
import {
  CATALOG,
  defaultSceneState,
  ensureObjectIds,
  isLightType,
  type ObjectParams,
  type ObjectType,
  type OutlinePoint,
  type RoomSpec,
  type SceneObject,
} from '@/lib/scene-types';
import {
  clampPositionToRoom,
  hasCustomOutline,
  normalizeOutline,
  outlineBBox,
} from '@/lib/polygon';
import { snapNewObject } from '@/components/three/wall-snap';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export const uid = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
};

/** Default placement height based on object type */
export function defaultY(type: ObjectType, params: ObjectParams, roomHeight: number): number {
  if (type === 'wall') return Math.min(params.mountY ?? 1.5, roomHeight - 0.8);
  if (type === 'pendant') return Math.min(params.mountY ?? 2.3, roomHeight - 0.15);
  if (type === 'hood') return Math.min(params.mountY ?? 1.62, roomHeight - 0.4);
  if (type === 'tv') return Math.min(params.mountY ?? 1.4, roomHeight - 0.6);
  if (type === 'microwave') return Math.min(params.mountY ?? 0.9, roomHeight - 0.3);
  return 0;
}

export function catalogDefaults(type: ObjectType, label?: string): { params: ObjectParams; label: string } {
  const item =
    CATALOG.find((c) => c.type === type && (!label || c.label === label)) ??
    CATALOG.find((c) => c.type === type)!;
  return { params: clone(item.defaults), label: item.label };
}

interface EditorState {
  projectId: string | null;
  projectName: string;
  roomSpec: RoomSpec;
  objects: SceneObject[];
  selectedIds: string[];
  past: SceneObject[][];
  future: SceneObject[][];
  dirty: boolean;

  loadProject: (id: string, name: string, spec: RoomSpec, objects: SceneObject[]) => void;
  setProjectName: (name: string) => void;
  /** Direct roomSpec patch (color/dimensions/openings) */
  setRoomSpec: (patch: Partial<RoomSpec>) => void;
  /** Set the room polygon outline — null = back to rectangle */
  setRoomOutline: (outline: OutlinePoint[] | null) => void;

  beginAction: () => void;
  addObject: (
    type: ObjectType,
    position: [number, number, number],
    label?: string,
    rotationY?: number,
  ) => string;
  addGenerated: (
    type: ObjectType,
    label: string,
    params: ObjectParams,
    position: [number, number, number]
  ) => string;
  addObjects: (objs: SceneObject[]) => void;
  updateObject: (id: string, patch: Partial<SceneObject>) => void;
  updateParams: (id: string, params: ObjectParams) => void;
  removeObject: (id: string) => void;
  duplicateObject: (id: string) => void;
  toggleOpen: (id: string) => void;
  toggleLight: (id: string) => void;
  setLightOn: (id: string, on: boolean) => void;

  /** Replace the whole scene (whole-space design from text) — undoable */
  replaceScene: (roomSpec: RoomSpec, objects: SceneObject[]) => void;

  select: (id: string | null, additive?: boolean) => void;
  undo: () => void;
  redo: () => void;
  markSaved: () => void;
}

const MAX_HISTORY = 60;

export const useEditorStore = create<EditorState>((set, get) => ({
  projectId: null,
  projectName: 'Untitled project',
  roomSpec: {
    widthM: 4, depthM: 3.4, heightM: 2.8,
    wallColor: '#ece7dd', floorColor: '#a97c50', ceilingColor: '#fafafa',
    windows: [], doorways: [],
  },
  objects: [],
  selectedIds: [],
  past: [],
  future: [],
  dirty: false,

  loadProject: (id, name, spec, objects) =>
    set({
      projectId: id, projectName: name, roomSpec: spec,
      objects: objects.length ? objects : defaultSceneState().objects,
      selectedIds: [], past: [], future: [], dirty: false,
    }),

  setProjectName: (name) => set({ projectName: name, dirty: true }),

  setRoomSpec: (patch) =>
    set((s) => ({ roomSpec: { ...s.roomSpec, ...patch }, dirty: true })),

  setRoomOutline: (outline) =>
    set((s) => {
      if (!outline) {
        // explicitly null → fall back to the plain rectangle
        const { outline: _ignored, ...rest } = s.roomSpec;
        return { roomSpec: rest as RoomSpec, dirty: true };
      }
      const pts = normalizeOutline(outline);
      if (!pts || pts.length < 3) return {}; // invalid transient state while dragging — leave untouched
      // reference dimensions = plan bbox so camera/grid/placement stay in sync with the shape
      const bb = outlineBBox(pts);
      return {
        roomSpec: {
          ...s.roomSpec,
          outline: pts,
          widthM: Math.round(bb.w * 100) / 100,
          depthM: Math.round(bb.d * 100) / 100,
        },
        dirty: true,
      };
    }),

  beginAction: () =>
    set((s) => ({
      past: [...s.past.slice(-MAX_HISTORY), clone(s.objects)],
      future: [],
    })),

  addObject: (type, position, label, rotationY) => {
    get().beginAction();
    const { params, label: catLabel } = catalogDefaults(type, label);
    const roomSpec = get().roomSpec;
    const y = defaultY(type, params, roomSpec.heightM);
    const [cx, , cz] = clampPositionToRoom(roomSpec, position);
    const id = uid();
    const obj: SceneObject = {
      id, type, label: catLabel, params,
      position: [cx, y, cz],
      rotationY: rotationY ?? 0,
      open: false,
      on: isLightType(type),
    };
    set((s) => ({ objects: [...s.objects, obj], selectedIds: [id], dirty: true }));
    return id;
  },

  /** Add an object generated by text/AI with custom params */
  addGenerated: (type, label, params, position) => {
    get().beginAction();
    const roomSpec = get().roomSpec;
    const y = defaultY(type, params, roomSpec.heightM);
    const [cx, , cz] = clampPositionToRoom(roomSpec, position);
    const id = uid();
    const obj: SceneObject = {
      id, type, label, params,
      position: [cx, y, cz],
      rotationY: 0,
      open: false,
      on: isLightType(type),
    };
    set((s) => ({ objects: [...s.objects, obj], selectedIds: [id], dirty: true }));
    return id;
  },

  addObjects: (objs) => {
    if (!objs.length) return;
    get().beginAction();
    const roomSpec = get().roomSpec;
    const safe = clone(objs).map((o) => {
      const [cx, , cz] = clampPositionToRoom(roomSpec, o.position);
      return { ...o, position: [cx, o.position[1], cz] as [number, number, number] };
    });
    set((s) => ({ objects: [...s.objects, ...safe], dirty: true }));
  },

  /** Replace the whole scene — past is saved before applying (undoable) */
  replaceScene: (roomSpec, objects) => {
    get().beginAction();
    const prev = get().roomSpec;
    // Defensive coverage of missing fields in the AI's roomSpec output
    const spec: RoomSpec = {
      ...roomSpec,
      widthM: roomSpec.widthM > 0 ? roomSpec.widthM : prev.widthM,
      depthM: roomSpec.depthM > 0 ? roomSpec.depthM : prev.depthM,
      heightM: roomSpec.heightM > 0 ? roomSpec.heightM : prev.heightM,
      wallColor: roomSpec.wallColor || prev.wallColor,
      floorColor: roomSpec.floorColor || prev.floorColor,
      ceilingColor: roomSpec.ceilingColor || prev.ceilingColor,
      windows: Array.isArray(roomSpec.windows) ? roomSpec.windows : [],
      doorways: Array.isArray(roomSpec.doorways) ? roomSpec.doorways : [],
    };
    const safe = ensureObjectIds(clone(objects)).map((o) => {
      const [cx, , cz] = clampPositionToRoom(spec, o.position);
      return { ...o, position: [cx, o.position[1], cz] as [number, number, number] };
    });
    set({ roomSpec: spec, objects: safe, selectedIds: [], dirty: true });
  },

  updateObject: (id, patch) =>
    set((s) => ({
      objects: s.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
      dirty: true,
    })),

  updateParams: (id, params) =>
    set((s) => ({
      objects: s.objects.map((o) => (o.id === id ? { ...o, params: { ...o.params, ...params } } : o)),
      dirty: true,
    })),

  removeObject: (id) => {
    get().beginAction();
    set((s) => ({
      objects: s.objects.filter((o) => o.id !== id),
      selectedIds: s.selectedIds.filter((x) => x !== id),
      dirty: true,
    }));
  },

  duplicateObject: (id) => {
    const src = get().objects.find((o) => o.id === id);
    if (!src) return;
    get().beginAction();
    const newId = uid();
    const copy: SceneObject = {
      ...clone(src), id: newId,
      position: [src.position[0] + 0.4, src.position[1], src.position[2] + 0.4],
    };
    set((s) => ({ objects: [...s.objects, copy], selectedIds: [newId], dirty: true }));
  },

  toggleOpen: (id) =>
    set((s) => ({
      objects: s.objects.map((o) => (o.id === id ? { ...o, open: !o.open } : o)),
      dirty: true,
    })),

  toggleLight: (id) =>
    set((s) => ({
      objects: s.objects.map((o) =>
        o.id === id && isLightType(o.type) ? { ...o, on: !o.on } : o
      ),
      dirty: true,
    })),

  setLightOn: (id, on) =>
    set((s) => ({
      objects: s.objects.map((o) => (o.id === id ? { ...o, on } : o)),
      dirty: true,
    })),

  select: (id, additive) =>
    set((s) => {
      if (!id) return { selectedIds: [] };
      if (additive) {
        const has = s.selectedIds.includes(id);
        return { selectedIds: has ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id] };
      }
      return { selectedIds: [id] };
    }),

  undo: () =>
    set((s) => {
      if (!s.past.length) return s;
      const prev = s.past[s.past.length - 1];
      return {
        objects: prev,
        past: s.past.slice(0, -1),
        future: [clone(s.objects), ...s.future].slice(0, MAX_HISTORY),
        dirty: true,
        selectedIds: [],
      };
    }),

  redo: () =>
    set((s) => {
      if (!s.future.length) return s;
      const next = s.future[0];
      return {
        objects: next,
        past: [...s.past, clone(s.objects)],
        future: s.future.slice(1),
        dirty: true,
        selectedIds: [],
      };
    }),

  markSaved: () => set({ dirty: false }),
}));

/** Find a free spot to add an object by clicking (no drag) */
export function findFreeSpot(
  objects: SceneObject[],
  type: ObjectType,
  spec: RoomSpec
): [number, number] {
  const w = spec.widthM;
  const d = spec.depthM;
  // Wall/back-to-wall types: row along the back wall
  const WALL_ROW_TYPES: readonly ObjectType[] = [
    'base', 'tall', 'wall', 'shelf', 'fridge', 'stove', 'hood',
    'tv', 'sofa', 'bed', 'washer', 'dishwasher', 'microwave',
  ];
  if (WALL_ROW_TYPES.includes(type)) {
    // The TV is thin and must hug the wall; the rest use the standard offset
    const backZ = -d / 2 + (type === 'tv' ? 0.09 : 0.35);
    let spot: [number, number] = [0, backZ];
    for (let x = -w / 2 + 0.5; x <= w / 2 - 0.5; x += 0.05) {
      const occupied = objects.some(
        (o) => o.type !== 'pendant' && Math.abs(o.position[0] - x) < 0.45 && Math.abs(o.position[2] - backZ) < 0.5
      );
      if (!occupied) {
        spot = [Math.round(x * 20) / 20, backZ];
        break;
      }
    }
    // Non-rectangular plan: the hard-coded row may fall outside the polygon → snap to the nearest edge
    if (spec.outline && hasCustomOutline(spec)) {
      const snapped = snapNewObject(spec, type, spot[0], spot[1]);
      return [snapped.x, snapped.z];
    }
    return spot;
  }
  if (type === 'island') return [0, 0];
  // Decor/table/chair: free spot in the middle (central spiral)
  for (let r = 0; r < 2; r += 0.4) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r * 0.7 + 0.5;
      const occupied = objects.some(
        (o) => Math.abs(o.position[0] - x) < 0.4 && Math.abs(o.position[2] - z) < 0.4
      );
      if (!occupied) return [x, z];
    }
  }
  return [0, 0.5];
}
