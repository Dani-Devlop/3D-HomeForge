import { create } from 'zustand';
import {
  CATALOG,
  defaultSceneState,
  isLightType,
  type ObjectParams,
  type ObjectType,
  type RoomSpec,
  type SceneObject,
} from '@/lib/scene-types';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export const uid = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
};

/** ارتفاع پیش‌فرض قرارگیری بر اساس نوع آبجکت */
export function defaultY(type: ObjectType, params: ObjectParams, roomHeight: number): number {
  if (type === 'wall') return Math.min(params.mountY ?? 1.5, roomHeight - 0.8);
  if (type === 'pendant') return Math.min(params.mountY ?? 2.3, roomHeight - 0.15);
  if (type === 'hood') return Math.min(params.mountY ?? 1.62, roomHeight - 0.4);
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

  beginAction: () => void;
  addObject: (type: ObjectType, position: [number, number, number], label?: string) => string;
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

  select: (id: string | null, additive?: boolean) => void;
  undo: () => void;
  redo: () => void;
  markSaved: () => void;
}

const MAX_HISTORY = 60;

export const useEditorStore = create<EditorState>((set, get) => ({
  projectId: null,
  projectName: 'پروژه بدون نام',
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

  beginAction: () =>
    set((s) => ({
      past: [...s.past.slice(-MAX_HISTORY), clone(s.objects)],
      future: [],
    })),

  addObject: (type, position, label) => {
    get().beginAction();
    const { params, label: catLabel } = catalogDefaults(type, label);
    const y = defaultY(type, params, get().roomSpec.heightM);
    const id = uid();
    const obj: SceneObject = {
      id, type, label: catLabel, params,
      position: [position[0], y, position[2]],
      rotationY: 0,
      open: false,
      on: isLightType(type),
    };
    set((s) => ({ objects: [...s.objects, obj], selectedIds: [id], dirty: true }));
    return id;
  },

  /** افزودن آبجکت تولیدشده با متن/AI با پارامترهای سفارشی */
  addGenerated: (type, label, params, position) => {
    get().beginAction();
    const y = defaultY(type, params, get().roomSpec.heightM);
    const id = uid();
    const obj: SceneObject = {
      id, type, label, params,
      position: [position[0], y, position[2]],
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
    set((s) => ({ objects: [...s.objects, ...clone(objs)], dirty: true }));
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

/** پیدا کردن جای خالی برای افزودن آبجکت با کلیک (بدون درگ) */
export function findFreeSpot(
  objects: SceneObject[],
  type: ObjectType,
  spec: RoomSpec
): [number, number] {
  const w = spec.widthM;
  const d = spec.depthM;
  if (type === 'base' || type === 'tall' || type === 'wall' || type === 'shelf' || type === 'fridge' || type === 'stove' || type === 'hood') {
    // ردیف پشت دیوار
    const backZ = -d / 2 + 0.35;
    for (let x = -w / 2 + 0.5; x <= w / 2 - 0.5; x += 0.05) {
      const occupied = objects.some(
        (o) => o.type !== 'pendant' && Math.abs(o.position[0] - x) < 0.45 && Math.abs(o.position[2] - backZ) < 0.5
      );
      if (!occupied) return [Math.round(x * 20) / 20, backZ];
    }
    return [0, backZ];
  }
  if (type === 'island') return [0, 0];
  // دکور: جای خالی در وسط
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
