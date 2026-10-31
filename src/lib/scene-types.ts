// ============================================================
// Shared 3D scene types — between API, editor and client viewer
// ============================================================

export type WallName = 'back' | 'front' | 'left' | 'right';

/** Room outline point [x, z] in meters — room center is the origin */
export type OutlinePoint = [number, number];

export interface WindowSpec {
  wall: WallName;
  /** Outline edge index for polygonal rooms (slanted wall) — takes priority over wall when present */
  wallIndex?: number;
  offsetX: number; // distance from the wall/edge center (meters)
  sillY: number; // window sill height
  width: number;
  height: number;
}

export interface DoorwaySpec {
  wall: WallName;
  /** Outline edge index for polygonal rooms */
  wallIndex?: number;
  offsetX: number;
  width: number;
  height: number;
}

/** Room spec reconstructed from a photo */
export interface RoomSpec {
  widthM: number;
  depthM: number;
  heightM: number;
  /**
   * Room floor plan as a polygon (3..12 corners) — for slanted walls/extra corners.
   * Absent = plain widthM×depthM rectangle. widthM/depthM must be the polygon bbox.
   */
  outline?: OutlinePoint[];
  wallColor: string;
  floorColor: string;
  ceilingColor: string;
  windows: WindowSpec[];
  doorways: DoorwaySpec[];
}

export type ObjectType =
  | 'base' // base cabinet
  | 'wall' // wall cabinet
  | 'tall' // tall / fridge cabinet
  | 'island' // kitchen island
  | 'shelf' // open shelf
  | 'fridge' // refrigerator
  | 'stove' // stove / oven
  | 'hood' // range hood
  | 'tv' // TV
  | 'sofa' // sofa
  | 'bed' // bed
  | 'table' // table
  | 'chair' // chair
  | 'washer' // washing machine
  | 'dishwasher' // dishwasher
  | 'microwave' // microwave
  | 'pendant' // pendant light
  | 'floor-lamp' // floor lamp
  | 'plant' // plant
  | 'rug'; // rug

/** Types detectable/reconstructable by AI and text generation (everything for whole-home design) */
export const RECONSTRUCTABLE_TYPES: readonly ObjectType[] = [
  'base', 'wall', 'tall', 'island', 'shelf', 'fridge', 'stove', 'hood',
  'tv', 'sofa', 'bed', 'table', 'chair', 'washer', 'dishwasher', 'microwave',
];

/** Types with openable doors (Mesh States) */
export const DOOR_TYPES: readonly ObjectType[] = ['base', 'wall', 'tall', 'island', 'shelf', 'fridge', 'stove', 'washer', 'dishwasher', 'microwave'];

/** Types with on/off state (light or lit surface) */
export const LIGHT_TYPES: readonly ObjectType[] = ['pendant', 'floor-lamp', 'hood', 'stove', 'tv'];

export const isDoorType = (t: ObjectType) => DOOR_TYPES.includes(t);
export const isLightType = (t: ObjectType) => LIGHT_TYPES.includes(t);

export type HandleType = 'bar' | 'knob' | 'none';

export interface ObjectParams {
  // Cabinet
  w?: number;
  h?: number;
  d?: number;
  bodyColor?: string;
  doorColor?: string;
  countertopColor?: string;
  doors?: number; // 0..2
  drawers?: number; // 0..3
  handles?: HandleType;
  mountY?: number; // mount height (wall cabinet/hood/TV/microwave above the counter)
  glass?: boolean; // glass doors (transparent — never black)
  // Decor/light
  color?: string;
  scale?: number;
  intensity?: number;
}

export interface SceneObject {
  id: string;
  type: ObjectType;
  label?: string;
  params: ObjectParams;
  position: [number, number, number];
  rotationY: number;
  open?: boolean; // is the door/drawer open? (Mesh State)
  on?: boolean; // is the light on?
}

export interface SceneState {
  objects: SceneObject[];
}

export const defaultSceneState = (): SceneState => ({ objects: [] });

/**
 * Guarantee an id for objects without one (legacy data / imported from the API) —
 * required for React keys, selection and guest saving.
 */
export function ensureObjectIds(objects: SceneObject[]): SceneObject[] {
  return objects.map((o, i) =>
    o && typeof o.id === 'string' && o.id
      ? o
      : { ...o, id: `auto-${i}-${objects.length}` },
  );
}

// ---------------- Library catalog (parametric) ----------------

export type CatalogCategory = 'cabinet' | 'appliance' | 'furniture' | 'light' | 'decor';

export const CATALOG_CATEGORY_LABEL: Record<CatalogCategory, string> = {
  cabinet: 'Cabinets',
  appliance: 'Appliances',
  furniture: 'Furniture',
  light: 'Lights',
  decor: 'Decor',
};

export interface CatalogItem {
  type: ObjectType;
  label: string;
  category: CatalogCategory;
  description: string;
  defaults: ObjectParams;
}

export const CATALOG: CatalogItem[] = [
  {
    type: 'base',
    label: 'Base cabinet',
    category: 'cabinet',
    description: 'Base cabinet with doors, drawers and a countertop',
    defaults: {
      w: 0.8, h: 0.85, d: 0.6,
      bodyColor: '#6b4f3a', doorColor: '#7d5f45', countertopColor: '#d8d3c8',
      doors: 2, drawers: 0, handles: 'bar',
    },
  },
  {
    type: 'base',
    label: 'Drawer base cabinet',
    category: 'cabinet',
    description: 'Base cabinet with three drawers',
    defaults: {
      w: 0.8, h: 0.85, d: 0.6,
      bodyColor: '#5a6b5d', doorColor: '#6b7d6e', countertopColor: '#2f2b28',
      doors: 0, drawers: 3, handles: 'bar',
    },
  },
  {
    type: 'wall',
    label: 'Wall cabinet',
    category: 'cabinet',
    description: 'Upper cabinet mounted on the wall',
    defaults: {
      w: 0.8, h: 0.7, d: 0.35,
      bodyColor: '#8a6d4f', doorColor: '#9a7c5c', countertopColor: '#d8d3c8',
      doors: 2, drawers: 0, handles: 'knob', mountY: 1.5,
    },
  },
  {
    type: 'tall',
    label: 'Tall cabinet',
    category: 'cabinet',
    description: 'Full-height unit (pantry shelf / fridge)',
    defaults: {
      w: 0.6, h: 2.1, d: 0.6,
      bodyColor: '#4f5d75', doorColor: '#5d6d87', countertopColor: '#d8d3c8',
      doors: 2, drawers: 0, handles: 'bar',
    },
  },
  {
    type: 'island',
    label: 'Island',
    category: 'cabinet',
    description: 'Central kitchen island with a stone countertop',
    defaults: {
      w: 1.6, h: 0.9, d: 0.9,
      bodyColor: '#3f4a5a', doorColor: '#48566a', countertopColor: '#e8e4dc',
      doors: 2, drawers: 2, handles: 'bar',
    },
  },
  {
    type: 'shelf',
    label: 'Open shelf',
    category: 'cabinet',
    description: 'Multi-tier shelf without doors',
    defaults: {
      w: 0.8, h: 1.8, d: 0.35,
      bodyColor: '#8a7357', doorColor: '#8a7357', countertopColor: '#8a7357',
      doors: 0, drawers: 0, handles: 'none',
    },
  },
  {
    type: 'fridge',
    label: 'Refrigerator',
    category: 'appliance',
    description: 'Two-door fridge with a handle — its door opens',
    defaults: {
      w: 0.75, h: 1.8, d: 0.7,
      color: '#b9bec6', bodyColor: '#b9bec6', doorColor: '#cdd2d9',
      doors: 1, handles: 'bar',
    },
  },
  {
    type: 'stove',
    label: 'Stove',
    category: 'appliance',
    description: 'Oven and gas cooktop — flames can be toggled on/off',
    defaults: {
      w: 0.6, h: 0.9, d: 0.6,
      color: '#3d4046', bodyColor: '#4a4e55', doorColor: '#34373c',
      countertopColor: '#1e2024', doors: 1, handles: 'bar',
    },
  },
  {
    type: 'hood',
    label: 'Range hood',
    category: 'appliance',
    description: 'Kitchen hood with a light — mounted on the wall above the stove',
    defaults: {
      w: 0.6, h: 0.14, d: 0.5,
      color: '#aab0b8', bodyColor: '#aab0b8',
      mountY: 1.62, intensity: 0.9,
    },
  },
  {
    type: 'pendant',
    label: 'Pendant light',
    category: 'light',
    description: 'Hanging ceiling light with controllable glow',
    defaults: {
      color: '#f59e0b', scale: 1, intensity: 1.4, mountY: 2.3,
    },
  },
  {
    type: 'floor-lamp',
    label: 'Floor lamp',
    category: 'light',
    description: 'Standing lamp with a warm glow',
    defaults: {
      color: '#b45309', scale: 1, intensity: 1.1,
    },
  },
  {
    type: 'plant',
    label: 'Decorative plant',
    category: 'decor',
    description: 'Potted green plant',
    defaults: { color: '#2e7d32', scale: 1 },
  },
  {
    type: 'rug',
    label: 'Rug',
    category: 'decor',
    description: 'Floor rug in any color',
    defaults: { color: '#9c4a3c', scale: 1 },
  },
  {
    type: 'tv',
    label: 'TV',
    category: 'furniture',
    description: 'Wall-mounted TV — screen can be toggled on/off',
    defaults: { w: 1.2, h: 0.7, d: 0.06, color: '#101318', bodyColor: '#1b1f26', mountY: 1.4 },
  },
  {
    type: 'sofa',
    label: 'Sofa',
    category: 'furniture',
    description: 'Three-seat sofa with a cushion',
    defaults: { w: 2.0, h: 0.8, d: 0.9, color: '#5d6b7a', bodyColor: '#4e5a68' },
  },
  {
    type: 'bed',
    label: 'Double bed',
    category: 'furniture',
    description: 'Bed with mattress, duvet and pillows',
    defaults: { w: 1.6, h: 0.55, d: 2.0, color: '#8d6e63', bodyColor: '#6d4c41' },
  },
  {
    type: 'table',
    label: 'Dining table',
    category: 'furniture',
    description: 'Table with four legs',
    defaults: { w: 1.5, h: 0.75, d: 0.9, color: '#7a5c3f', bodyColor: '#6b4e34' },
  },
  {
    type: 'chair',
    label: 'Chair',
    category: 'furniture',
    description: 'Chair with a backrest',
    defaults: { w: 0.45, h: 0.9, d: 0.5, color: '#6b4e34' },
  },
  {
    type: 'washer',
    label: 'Washing machine',
    category: 'appliance',
    description: 'Washing machine with a round door — the door opens',
    defaults: { w: 0.6, h: 0.85, d: 0.6, color: '#e8eaee', bodyColor: '#dfe2e8' },
  },
  {
    type: 'dishwasher',
    label: 'Dishwasher',
    category: 'appliance',
    description: 'Dishwasher with a handle — the door opens',
    defaults: { w: 0.6, h: 0.85, d: 0.6, color: '#c9cdd4', bodyColor: '#c2c7cf', doors: 1, handles: 'bar' },
  },
  {
    type: 'microwave',
    label: 'Microwave',
    category: 'appliance',
    description: 'Countertop microwave with a lit glass window',
    defaults: { w: 0.5, h: 0.3, d: 0.38, color: '#2c2f35', bodyColor: '#33373e', mountY: 0.9 },
  },
];

// ---------------- Wall placement (shared between AI and UI) ----------------

/** Edge index of each named wall in the reference rectangle outline */
export const WALL_NAME_EDGE: Record<WallName, number> = {
  back: 0,
  right: 1,
  front: 2,
  left: 3,
};

/** Wall labels (views & openings panel, etc.) */
export const WALL_NAME_FA: Record<WallName, string> = {
  back: 'Back',
  front: 'Front',
  left: 'Left',
  right: 'Right',
};

/** Place an object of a given depth on a wall — offsetX from the wall center (meters) */
export function placeAtWall(
  wall: WallName,
  offsetX: number,
  objDepth: number,
  spec: Pick<RoomSpec, 'widthM' | 'depthM'>,
  y = 0
): { position: [number, number, number]; rotationY: number } {
  const inset = objDepth / 2 + 0.02;
  switch (wall) {
    case 'back':
      return { position: [offsetX, y, -spec.depthM / 2 + inset], rotationY: 0 };
    case 'front':
      return { position: [offsetX, y, spec.depthM / 2 - inset], rotationY: Math.PI };
    case 'left':
      return { position: [-spec.widthM / 2 + inset, y, offsetX], rotationY: Math.PI / 2 };
    case 'right':
      return { position: [spec.widthM / 2 - inset, y, offsetX], rotationY: -Math.PI / 2 };
  }
}

/**
 * Place an object on edge i of the room outline (slanted walls supported too) —
 * offsetAlong = distance from the edge center along the edge (meters)
 */
export function placeAtEdge(
  outline: OutlinePoint[],
  edgeIndex: number,
  offsetAlong: number,
  objDepth: number,
  y = 0
): { position: [number, number, number]; rotationY: number } {
  const n = outline.length;
  const i = ((Math.round(edgeIndex) % n) + n) % n;
  const [ax, az] = outline[i];
  const [bx, bz] = outline[(i + 1) % n];
  const len = Math.max(0.05, Math.hypot(bx - ax, bz - az));
  const dirX = (bx - ax) / len;
  const dirZ = (bz - az) / len;
  const inX = -dirZ; // inward normal for positive winding
  const inZ = dirX;
  const inset = objDepth / 2 + 0.02;
  return {
    position: [
      (ax + bx) / 2 + dirX * offsetAlong + inX * inset,
      y,
      (az + bz) / 2 + dirZ * offsetAlong + inZ * inset,
    ],
    rotationY: Math.atan2(inX, inZ),
  };
}

// ---------------- Text-edit object patch (output of /api/ai/edit) ----------------

export interface ObjectPatch {
  /** Relative movement in meters */
  positionDelta?: [number, number, number];
  /** Relative rotation in radians */
  rotationYDelta?: number;
  params?: ObjectParams;
  label?: string;
  open?: boolean;
  on?: boolean;
}

// ---------------- Guest color palette ----------------

export const GUEST_COLORS = [
  '#e11d48', '#059669', '#d97706', '#7c3aed',
  '#0891b2', '#db2777', '#65a30d', '#ea580c',
];

export const guestColorFor = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return GUEST_COLORS[hash % GUEST_COLORS.length];
};

// ---------------- Role validation ----------------

export type ShareRole = 'viewer' | 'modifier';

export const isValidRole = (r: unknown): r is ShareRole =>
  r === 'viewer' || r === 'modifier';
