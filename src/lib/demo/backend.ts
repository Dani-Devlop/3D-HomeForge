// ============================================================
// Demo backend — localStorage-backed implementation of the
// `api` interface (see src/lib/api.ts).
//
// Used when the app is exported as a STATIC site (e.g. GitHub
// Pages) with NEXT_PUBLIC_DEMO_MODE=1: every api call is routed
// here instead of a /api/* fetch, so the whole product keeps
// working without any server.
//
// - One JSON blob in localStorage under `c3d-demo-db`
// - Seeded with realistic English demo data on first run
// - SSR-safe: importing this module never touches storage and
//   never crashes; methods that need the browser throw a plain
//   Error('Demo mode is client-only') — reading the auth session
//   returns a safe default instead
// - Pure client-side TypeScript: no prisma, no server imports
// ============================================================

import type {
  AdminStatsDTO,
  api,
  FolderDTO,
  GeneratedItem,
  GuestDTO,
  PortfolioItemDTO,
  PresetDTO,
  ProjectDTO,
  ReconstructResult,
  ShareLinkDTO,
} from '../api';
import type { ProjectStage } from '../crm';
import {
  GUEST_COLORS,
  type ObjectPatch,
  type ObjectParams,
  type RoomSpec,
  type SceneObject,
  type SceneState,
  type ShareRole,
} from '../scene-types';

// ---------------- storage ----------------

const DB_KEY = 'c3d-demo-db';
const SESSION_KEY = 'c3d-demo-session';
const DAY_MS = 86_400_000;

/** localStorage accessor — throws a clear error when called during SSR. */
function storage(): Storage {
  if (typeof window === 'undefined') throw new Error('Demo mode is client-only');
  return window.localStorage;
}

const nowIso = (): string => new Date().toISOString();

const delay = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** Deep-clone plain JSON data so callers never mutate the stored blob. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Random id — crypto.randomUUID() with a defensive fallback. */
function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// URL-safe alphabet for share tokens (24 chars) and an uppercase
// alphanumeric alphabet for the short share code (8 chars).
const TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Random string of the given length from an alphabet. */
function randomString(length: number, alphabet: string): string {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

// ---------------- stored record shapes ----------------

interface DemoFolder {
  id: string;
  name: string;
  phone: string | null;
  createdAt: string;
}

interface DemoProject {
  id: string;
  name: string;
  roomType: string;
  roomSpec: RoomSpec | Record<string, never>;
  sceneState: SceneState | Record<string, never>;
  thumbnail: string | null;
  isPublic: boolean;
  folderId: string | null;
  // CRM
  clientName: string | null;
  clientPhone: string | null;
  address: string | null;
  stage: ProjectStage | null;
  dealAt: string | null;
  contractAmount: number | null;
  contractPhoto: string | null;
  invoicePhoto: string | null;
  visitAt: string | null;
  installAt: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DemoShareLink {
  id: string;
  projectId: string;
  token: string;
  shortCode: string;
  role: ShareRole;
  active: boolean;
  expiresAt: string;
  createdAt: string;
}

interface DemoGuest {
  id: string;
  name: string;
  color: string;
  role: ShareRole;
  createdAt: string;
  shareLinkId: string;
}

interface DemoPortfolio {
  id: string;
  title: string;
  description: string;
  category: string;
  image: string;
  roomSpec: RoomSpec | Record<string, never>;
  sceneState: SceneState | Record<string, never>;
  visible: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface DemoPreset {
  id: string;
  name: string;
  data: Partial<SceneObject>[];
  createdAt: string;
}

/** Shape of the single JSON blob persisted in localStorage under `c3d-demo-db`. */
interface DemoDB {
  password: string;
  folders: DemoFolder[];
  projects: DemoProject[];
  shareLinks: DemoShareLink[];
  guests: DemoGuest[];
  portfolio: DemoPortfolio[];
  presets: DemoPreset[];
}

// ---------------- demo scenes (shapes valid per scene-types.ts) ----------------

let sceneObjectSeq = 0;

/** Build a SceneObject with an auto id (positions in meters, room center is the origin). */
function so(
  type: SceneObject['type'],
  label: string,
  params: ObjectParams,
  position: [number, number, number],
  rotationY = 0,
  state?: { open?: boolean; on?: boolean },
): SceneObject {
  sceneObjectSeq += 1;
  const object: SceneObject = { id: `demo-o${sceneObjectSeq}`, type, label, params, position, rotationY };
  if (state?.open !== undefined) object.open = state.open;
  if (state?.on !== undefined) object.on = state.on;
  return object;
}

/** Kitchen — 4.2 × 3.6 m, 2.8 m ceiling (seeded project, portfolio and AI reconstruct). */
const KITCHEN_SPEC: RoomSpec = {
  widthM: 4.2,
  depthM: 3.6,
  heightM: 2.8,
  wallColor: '#ece7dd',
  floorColor: '#a97c50',
  ceilingColor: '#fafafa',
  windows: [{ wall: 'left', offsetX: 0.2, sillY: 1.0, width: 1.4, height: 1.3 }],
  doorways: [{ wall: 'front', offsetX: 1.2, width: 0.95, height: 2.1 }],
};

const KITCHEN_SCENE: SceneState = {
  objects: [
    // Tall pantry and fridge on the left end of the back wall
    so('tall', 'Tall pantry cabinet',
      { w: 0.6, h: 2.1, d: 0.6, bodyColor: '#4f5d75', doorColor: '#5d6d87', doors: 2, drawers: 0, handles: 'bar' },
      [-1.75, 0, -1.48], 0, { open: false }),
    so('fridge', 'Refrigerator',
      { w: 0.75, h: 1.8, d: 0.7, color: '#b9bec6', bodyColor: '#b9bec6', doorColor: '#cdd2d9', doors: 1, handles: 'bar' },
      [-1.05, 0, -1.43], 0, { open: false }),
    // Base row along the back wall — sink and drawer units
    so('base', 'Sink cabinet',
      { w: 0.8, h: 0.85, d: 0.6, bodyColor: '#6b4f3a', doorColor: '#7d5f45', countertopColor: '#d8d3c8', doors: 2, drawers: 0, handles: 'bar' },
      [-0.1, 0, -1.48], 0, { open: false }),
    so('base', 'Drawer base cabinet',
      { w: 0.8, h: 0.85, d: 0.6, bodyColor: '#5a6b5d', doorColor: '#6b7d6e', countertopColor: '#2f2b28', doors: 0, drawers: 3, handles: 'bar' },
      [0.7, 0, -1.48], 0, { open: false }),
    so('stove', 'Stove',
      { w: 0.6, h: 0.9, d: 0.6, color: '#3d4046', bodyColor: '#4a4e55', doorColor: '#34373c', countertopColor: '#1e2024', doors: 1, handles: 'bar' },
      [1.4, 0, -1.48], 0, { open: false }),
    // Wall cabinets and hood
    so('wall', 'Wall cabinet',
      { w: 0.8, h: 0.7, d: 0.35, bodyColor: '#8a6d4f', doorColor: '#9a7c5c', doors: 2, drawers: 0, handles: 'knob', mountY: 1.5 },
      [-0.1, 1.5, -1.63], 0, { open: false }),
    so('wall', 'Wall cabinet',
      { w: 0.8, h: 0.7, d: 0.35, bodyColor: '#8a6d4f', doorColor: '#9a7c5c', doors: 2, drawers: 0, handles: 'knob', mountY: 1.5 },
      [0.7, 1.5, -1.63], 0, { open: false }),
    so('hood', 'Range hood',
      { w: 0.6, h: 0.14, d: 0.5, color: '#aab0b8', bodyColor: '#aab0b8', mountY: 1.62, intensity: 0.9 },
      [1.4, 1.62, -1.55], 0, { on: true }),
    // Island with a microwave on the countertop
    so('island', 'Island',
      { w: 1.6, h: 0.9, d: 0.9, bodyColor: '#3f4a5a', doorColor: '#48566a', countertopColor: '#e8e4dc', doors: 2, drawers: 2, handles: 'bar' },
      [0, 0, 0.3], 0, { open: false }),
    so('microwave', 'Microwave',
      { w: 0.5, h: 0.3, d: 0.38, color: '#2c2f35', bodyColor: '#33373e', mountY: 0.9 },
      [0.45, 0.9, 0.3], 0, { open: false }),
    // Lights and decor
    so('pendant', 'Pendant light',
      { color: '#f59e0b', scale: 1, intensity: 1.4, mountY: 2.3 },
      [-0.5, 2.3, 0.3], 0, { on: true }),
    so('pendant', 'Pendant light',
      { color: '#f59e0b', scale: 1, intensity: 1.4, mountY: 2.3 },
      [0.5, 2.3, 0.3], 0, { on: false }),
    so('plant', 'Decorative plant', { color: '#2e7d32', scale: 1 }, [-1.7, 0, 1.2]),
    so('rug', 'Rug', { color: '#9c4a3c', scale: 1 }, [0, 0, 1.35]),
  ],
};

/** Bedroom — 4.0 × 3.6 m (portfolio item "Serene bedroom" + AI room generation). */
const BEDROOM_SPEC: RoomSpec = {
  widthM: 4.0,
  depthM: 3.6,
  heightM: 2.8,
  wallColor: '#efe9e2',
  floorColor: '#a97c50',
  ceilingColor: '#fafafa',
  windows: [{ wall: 'left', offsetX: 0.2, sillY: 1.0, width: 1.4, height: 1.3 }],
  doorways: [{ wall: 'front', offsetX: 1.1, width: 0.9, height: 2.1 }],
};

const BEDROOM_SCENE: SceneState = {
  objects: [
    so('bed', 'Double bed',
      { w: 1.6, h: 0.55, d: 2.0, color: '#8d6e63', bodyColor: '#6d4c41' },
      [-0.4, 0, -0.78]),
    so('base', 'Nightstand',
      { w: 0.45, h: 0.55, d: 0.4, bodyColor: '#6d4c41', doorColor: '#8d6e63', doors: 0, drawers: 2, handles: 'knob' },
      [-1.5, 0, -1.58], 0, { open: false }),
    so('tall', 'Wardrobe',
      { w: 1.2, h: 2.1, d: 0.6, bodyColor: '#8a7357', doorColor: '#9a8368', doors: 2, drawers: 0, handles: 'bar' },
      [1.68, 0, 0.3], -Math.PI / 2, { open: false }),
    so('rug', 'Rug', { color: '#bfa58a', scale: 1 }, [-0.4, 0, 0.85]),
    so('plant', 'Decorative plant', { color: '#2e7d32', scale: 1 }, [-1.65, 0, 1.35]),
    so('floor-lamp', 'Floor lamp',
      { color: '#b45309', scale: 1, intensity: 1.1 },
      [0.85, 0, -1.35], 0, { on: true }),
  ],
};

/** Office — 3.8 × 3.2 m (seeded project "Minimal home office" + portfolio + AI room generation). */
const OFFICE_SPEC: RoomSpec = {
  widthM: 3.8,
  depthM: 3.2,
  heightM: 2.8,
  wallColor: '#eef0f2',
  floorColor: '#b08b5e',
  ceilingColor: '#fafafa',
  windows: [{ wall: 'back', offsetX: 0.8, sillY: 1.0, width: 1.4, height: 1.3 }],
  doorways: [{ wall: 'front', offsetX: -1.0, width: 0.9, height: 2.1 }],
};

const OFFICE_SCENE: SceneState = {
  objects: [
    so('table', 'Desk',
      { w: 1.5, h: 0.75, d: 0.7, color: '#7a5c3f', bodyColor: '#6b4e34' },
      [0, 0, -1.22]),
    so('chair', 'Office chair',
      { w: 0.45, h: 0.9, d: 0.5, color: '#37474f' },
      [0, 0, -0.45], Math.PI),
    so('shelf', 'Open shelf',
      { w: 0.8, h: 1.8, d: 0.35, bodyColor: '#8a7357', doorColor: '#8a7357', countertopColor: '#8a7357', doors: 0, drawers: 0, handles: 'none' },
      [-1.71, 0, 0.4], Math.PI / 2),
    so('plant', 'Decorative plant', { color: '#2e7d32', scale: 1 }, [1.55, 0, 1.15]),
    so('rug', 'Rug', { color: '#7a8b99', scale: 1 }, [0, 0, 0.35]),
    so('floor-lamp', 'Floor lamp',
      { color: '#b45309', scale: 1, intensity: 1.1 },
      [1.5, 0, -1.2], 0, { on: false }),
  ],
};

/** Living room — 5.0 × 4.0 m (portfolio item "Living room with TV wall" + AI room generation). */
const LIVING_SPEC: RoomSpec = {
  widthM: 5.0,
  depthM: 4.0,
  heightM: 2.8,
  wallColor: '#f1ede6',
  floorColor: '#9c6b43',
  ceilingColor: '#fafafa',
  windows: [{ wall: 'left', offsetX: -0.3, sillY: 0.9, width: 1.8, height: 1.4 }],
  doorways: [{ wall: 'front', offsetX: 1.4, width: 0.95, height: 2.1 }],
};

const LIVING_SCENE: SceneState = {
  objects: [
    so('tv', 'TV',
      { w: 1.4, h: 0.8, d: 0.06, color: '#101318', bodyColor: '#1b1f26', mountY: 1.4 },
      [0, 1.4, -1.95], 0, { on: true }),
    so('sofa', 'Sofa',
      { w: 2.2, h: 0.8, d: 0.9, color: '#5d6b7a', bodyColor: '#4e5a68' },
      [0, 0, 0.85], Math.PI),
    so('table', 'Coffee table',
      { w: 1.1, h: 0.42, d: 0.6, color: '#7a5c3f', bodyColor: '#6b4e34' },
      [0, 0, -0.45]),
    so('rug', 'Rug', { color: '#9c4a3c', scale: 1.2 }, [0, 0, 0.1]),
    so('shelf', 'Open shelf',
      { w: 0.8, h: 1.8, d: 0.35, bodyColor: '#8a7357', doorColor: '#8a7357', countertopColor: '#8a7357', doors: 0, drawers: 0, handles: 'none' },
      [2.31, 0, -1.1], -Math.PI / 2),
    so('plant', 'Decorative plant', { color: '#2e7d32', scale: 1 }, [-2.15, 0, 1.55]),
    so('floor-lamp', 'Floor lamp',
      { color: '#b45309', scale: 1, intensity: 1.1 },
      [2.05, 0, 1.5], 0, { on: true }),
  ],
};

type DemoRoomKind = 'kitchen' | 'bedroom' | 'office' | 'living';

/** Compact kitchen layout (4–8 objects) used by the AI room generator. */
const GEN_KITCHEN_LAYOUT: SceneObject[] = [
  so('base', 'Base cabinet',
    { w: 0.8, h: 0.85, d: 0.6, bodyColor: '#6b4f3a', doorColor: '#7d5f45', countertopColor: '#d8d3c8', doors: 2, drawers: 0, handles: 'bar' },
    [-1.0, 0, -1.48], 0, { open: false }),
  so('base', 'Drawer base cabinet',
    { w: 0.8, h: 0.85, d: 0.6, bodyColor: '#5a6b5d', doorColor: '#6b7d6e', countertopColor: '#2f2b28', doors: 0, drawers: 3, handles: 'bar' },
    [-0.2, 0, -1.48], 0, { open: false }),
  so('stove', 'Stove',
    { w: 0.6, h: 0.9, d: 0.6, color: '#3d4046', bodyColor: '#4a4e55', doorColor: '#34373c', countertopColor: '#1e2024', doors: 1, handles: 'bar' },
    [0.65, 0, -1.48], 0, { open: false }),
  so('fridge', 'Refrigerator',
    { w: 0.75, h: 1.8, d: 0.7, color: '#b9bec6', bodyColor: '#b9bec6', doorColor: '#cdd2d9', doors: 1, handles: 'bar' },
    [1.35, 0, -1.43], 0, { open: false }),
  so('hood', 'Range hood',
    { w: 0.6, h: 0.14, d: 0.5, color: '#aab0b8', bodyColor: '#aab0b8', mountY: 1.62, intensity: 0.9 },
    [0.65, 1.62, -1.55], 0, { on: true }),
  so('wall', 'Wall cabinet',
    { w: 0.8, h: 0.7, d: 0.35, bodyColor: '#8a6d4f', doorColor: '#9a7c5c', doors: 2, drawers: 0, handles: 'knob', mountY: 1.5 },
    [-0.6, 1.5, -1.63], 0, { open: false }),
  so('pendant', 'Pendant light',
    { color: '#f59e0b', scale: 1, intensity: 1.4, mountY: 2.3 },
    [0, 2.3, 0.3], 0, { on: true }),
];

const ROOM_SPECS: Record<DemoRoomKind, RoomSpec> = {
  kitchen: KITCHEN_SPEC,
  bedroom: BEDROOM_SPEC,
  office: OFFICE_SPEC,
  living: LIVING_SPEC,
};

const ROOM_LAYOUTS: Record<DemoRoomKind, SceneObject[]> = {
  kitchen: GEN_KITCHEN_LAYOUT,
  bedroom: BEDROOM_SCENE.objects,
  office: OFFICE_SCENE.objects,
  living: LIVING_SCENE.objects,
};

// ---------------- seeding ----------------

/** Build the initial demo database (English, realistic content). */
function seedDb(): DemoDB {
  const now = Date.now();
  const daysAgo = (d: number): string => new Date(now - d * DAY_MS).toISOString();
  const inDays = (d: number): string => new Date(now + d * DAY_MS).toISOString();

  const fSmith: DemoFolder = { id: newId(), name: 'Smith Kitchen', phone: '+1 555 0142', createdAt: daysAgo(40) };
  const fAhmadi: DemoFolder = { id: newId(), name: 'Ahmadi Bedroom', phone: '+1 555 0177', createdAt: daysAgo(28) };
  const fKarimi: DemoFolder = { id: newId(), name: 'Karimi Office', phone: '+1 555 0193', createdAt: daysAgo(21) };

  const kitchenProject: DemoProject = {
    id: newId(),
    name: 'Modern kitchen with island',
    roomType: 'kitchen',
    roomSpec: clone(KITCHEN_SPEC),
    sceneState: clone(KITCHEN_SCENE),
    thumbnail: null,
    isPublic: true,
    folderId: fSmith.id,
    clientName: 'Emma Smith',
    clientPhone: '+1 555 0142',
    address: '12 Maple Avenue, Portland, OR',
    stage: 'build',
    dealAt: daysAgo(18),
    contractAmount: 485000000,
    contractPhoto: null,
    invoicePhoto: null,
    visitAt: inDays(3),
    installAt: inDays(21),
    dueAt: inDays(30),
    createdAt: daysAgo(35),
    updatedAt: daysAgo(2),
  };

  const officeProject: DemoProject = {
    id: newId(),
    name: 'Minimal home office',
    roomType: 'office',
    roomSpec: clone(OFFICE_SPEC),
    sceneState: clone(OFFICE_SCENE),
    thumbnail: null,
    isPublic: false,
    folderId: fKarimi.id,
    clientName: 'Daniel Karimi',
    clientPhone: '+1 555 0193',
    address: '88 Cedar Street, Austin, TX',
    stage: 'design',
    dealAt: null,
    contractAmount: 165000000,
    contractPhoto: null,
    invoicePhoto: null,
    visitAt: inDays(6),
    installAt: null,
    dueAt: inDays(45),
    createdAt: daysAgo(12),
    updatedAt: daysAgo(1),
  };

  const shareLinks: DemoShareLink[] = [
    {
      id: newId(),
      projectId: kitchenProject.id,
      token: randomString(24, TOKEN_ALPHABET),
      shortCode: randomString(8, CODE_ALPHABET),
      role: 'viewer',
      active: true,
      expiresAt: inDays(30),
      createdAt: daysAgo(5),
    },
    {
      id: newId(),
      projectId: kitchenProject.id,
      token: randomString(24, TOKEN_ALPHABET),
      shortCode: randomString(8, CODE_ALPHABET),
      role: 'modifier',
      active: true,
      expiresAt: inDays(30),
      createdAt: daysAgo(3),
    },
  ];

  const portfolio: DemoPortfolio[] = [
    {
      id: newId(),
      title: 'Modern kitchen with island',
      description: 'Warm walnut cabinets, a stone-topped island and a full wall of appliances.',
      category: 'Kitchen',
      image: '',
      roomSpec: clone(KITCHEN_SPEC),
      sceneState: clone(KITCHEN_SCENE),
      visible: true,
      sortOrder: 0,
      createdAt: daysAgo(30),
      updatedAt: daysAgo(4),
    },
    {
      id: newId(),
      title: 'Serene bedroom',
      description: 'Calm neutral palette, a custom wardrobe wall and soft evening lighting.',
      category: 'Bedroom',
      image: '',
      roomSpec: clone(BEDROOM_SPEC),
      sceneState: clone(BEDROOM_SCENE),
      visible: true,
      sortOrder: 1,
      createdAt: daysAgo(26),
      updatedAt: daysAgo(3),
    },
    {
      id: newId(),
      title: 'Minimal home office',
      description: 'Compact home office with built-in shelving and a natural wood desk.',
      category: 'Office',
      image: '',
      roomSpec: clone(OFFICE_SPEC),
      sceneState: clone(OFFICE_SCENE),
      visible: true,
      sortOrder: 2,
      createdAt: daysAgo(20),
      updatedAt: daysAgo(2),
    },
    {
      id: newId(),
      title: 'Living room with TV wall',
      description: 'Open living room with a TV feature wall and layered lighting.',
      category: 'Living',
      image: '',
      roomSpec: clone(LIVING_SPEC),
      sceneState: clone(LIVING_SCENE),
      visible: true,
      sortOrder: 3,
      createdAt: daysAgo(15),
      updatedAt: daysAgo(1),
    },
  ];

  return {
    password: 'admin',
    folders: [fSmith, fAhmadi, fKarimi],
    projects: [kitchenProject, officeProject],
    shareLinks,
    guests: [],
    portfolio,
    presets: [],
  };
}

/** Load the demo DB from localStorage — seeds (and persists) on first run. */
function loadDb(): DemoDB {
  const store = storage(); // throws 'Demo mode is client-only' during SSR
  const raw = store.getItem(DB_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DemoDB;
      if (parsed && typeof parsed.password === 'string' && Array.isArray(parsed.projects)) {
        return parsed;
      }
    } catch {
      // Corrupt blob — fall through and reseed below.
    }
  }
  const seeded = seedDb();
  saveDb(seeded);
  return seeded;
}

/** Persist the demo DB after every mutation. */
function saveDb(db: DemoDB): void {
  storage().setItem(DB_KEY, JSON.stringify(db));
}

/** Session flag helper (safe default during SSR). */
function readSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

/** Find an ACTIVE, non-expired share link by full token or short code. */
function findActiveLink(db: DemoDB, tokenOrCode: string): DemoShareLink {
  const key = tokenOrCode.trim();
  const link = db.shareLinks.find(
    (l) =>
      (l.token === key || l.shortCode === key) &&
      l.active &&
      new Date(l.expiresAt).getTime() > Date.now(),
  );
  if (!link) throw new Error('Invalid or expired link');
  return link;
}

// ---------------- DTO mappers ----------------

function toProjectDTO(p: DemoProject, db: DemoDB): ProjectDTO {
  const folder = p.folderId ? db.folders.find((f) => f.id === p.folderId) : undefined;
  return {
    id: p.id,
    name: p.name,
    roomType: p.roomType,
    roomSpec: clone(p.roomSpec),
    sceneState: clone(p.sceneState),
    thumbnail: p.thumbnail,
    isPublic: p.isPublic,
    folderId: p.folderId,
    folderName: folder ? folder.name : null,
    clientName: p.clientName,
    clientPhone: p.clientPhone,
    address: p.address,
    stage: p.stage ?? undefined,
    dealAt: p.dealAt,
    contractAmount: p.contractAmount,
    contractPhoto: p.contractPhoto,
    invoicePhoto: p.invoicePhoto,
    visitAt: p.visitAt,
    installAt: p.installAt,
    dueAt: p.dueAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    shareCount: db.shareLinks.filter((l) => l.projectId === p.id).length,
  };
}

function toFolderDTO(f: DemoFolder, db: DemoDB): FolderDTO {
  return {
    id: f.id,
    name: f.name,
    phone: f.phone,
    createdAt: f.createdAt,
    projectCount: db.projects.filter((p) => p.folderId === f.id).length,
  };
}

function toShareLinkDTO(l: DemoShareLink, db: DemoDB): ShareLinkDTO {
  return {
    id: l.id,
    token: l.token,
    shortCode: l.shortCode,
    role: l.role,
    active: l.active,
    expiresAt: l.expiresAt,
    createdAt: l.createdAt,
    guestCount: db.guests.filter((g) => g.shareLinkId === l.id).length,
  };
}

function toGuestDTO(g: DemoGuest): GuestDTO {
  return {
    id: g.id,
    name: g.name,
    color: g.color,
    role: g.role,
    createdAt: g.createdAt,
    shareLinkId: g.shareLinkId,
  };
}

function toPresetDTO(p: DemoPreset): PresetDTO {
  return { id: p.id, name: p.name, data: clone(p.data), createdAt: p.createdAt };
}

function toPortfolioDTO(item: DemoPortfolio): PortfolioItemDTO {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    category: item.category,
    image: item.image,
    roomSpec: clone(item.roomSpec),
    sceneState: clone(item.sceneState),
    visible: item.visible,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

/** Coerce an unknown JSON payload into a stored RoomSpec (empty when invalid). */
function sanitizeRoomSpec(v: unknown): RoomSpec | Record<string, never> {
  if (v && typeof v === 'object' && typeof (v as { widthM?: unknown }).widthM === 'number') {
    return clone(v) as RoomSpec;
  }
  return {};
}

/** Coerce an unknown JSON payload into a stored SceneState (empty when invalid). */
function sanitizeSceneState(v: unknown): SceneState | Record<string, never> {
  if (v && typeof v === 'object' && Array.isArray((v as { objects?: unknown }).objects)) {
    return clone(v) as SceneState;
  }
  return {};
}

function asRoomSpec(v: RoomSpec | Record<string, never>): RoomSpec {
  if (v && typeof (v as { widthM?: unknown }).widthM === 'number') return clone(v as RoomSpec);
  return clone(KITCHEN_SPEC);
}

function asSceneState(v: SceneState | Record<string, never>): SceneState {
  if (v && Array.isArray((v as { objects?: unknown }).objects)) return clone(v as SceneState);
  return { objects: [] };
}

// ---------------- admin stats ----------------

function buildAdminStats(db: DemoDB): AdminStatsDTO {
  const nowMs = Date.now();
  const now = nowIso();

  const roomTypes: Record<string, number> = {};
  for (const project of db.projects) {
    roomTypes[project.roomType] = (roomTypes[project.roomType] ?? 0) + 1;
  }

  const projectById = new Map(db.projects.map((p) => [p.id, p] as const));
  const linkById = new Map(db.shareLinks.map((l) => [l.id, l] as const));
  const recentGuests = [...db.guests]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)
    .map((g) => {
      const link = g.shareLinkId ? linkById.get(g.shareLinkId) : undefined;
      const project = link ? projectById.get(link.projectId) : undefined;
      return {
        id: g.id,
        name: g.name,
        role: g.role,
        color: g.color,
        projectName: project ? project.name : null,
        lastSeenAt: now,
      };
    });

  const upcoming = db.projects
    .map((p) => {
      const dates = [p.visitAt, p.installAt, p.dueAt]
        .filter((d): d is string => typeof d === 'string' && d.length > 0)
        .sort();
      return { p, earliest: dates[0] ?? '' };
    })
    .filter((row) => row.earliest !== '' && new Date(row.earliest).getTime() >= nowMs)
    .sort((a, b) => a.earliest.localeCompare(b.earliest))
    .slice(0, 5)
    .map(({ p }) => ({
      id: p.id,
      name: p.name,
      clientName: p.clientName,
      clientPhone: p.clientPhone,
      visitAt: p.visitAt,
      installAt: p.installAt,
      dueAt: p.dueAt,
    }));

  return {
    stats: {
      projects: db.projects.length,
      folders: db.folders.length,
      guests: db.guests.length,
      shareLinks: db.shareLinks.length,
      activeShareLinks: db.shareLinks.filter(
        (l) => l.active && new Date(l.expiresAt).getTime() > nowMs,
      ).length,
      publicProjects: db.projects.filter((p) => p.isPublic).length,
    },
    roomTypes,
    recentGuests,
    upcoming,
  };
}

// ---------------- deterministic AI helpers (text-to-3D) ----------------

const BASE_CABINET_PARAMS: ObjectParams = {
  w: 0.8,
  h: 0.85,
  d: 0.6,
  bodyColor: '#6b4f3a',
  doorColor: '#7d5f45',
  countertopColor: '#d8d3c8',
  doors: 2,
  drawers: 0,
  handles: 'bar',
};

/** Keyword → object table (first match wins). */
const KEYWORD_ITEMS: Array<{ words: string[]; item: GeneratedItem }> = [
  { words: ['refrigerator', 'fridge'], item: { type: 'fridge', label: 'Refrigerator', params: { w: 0.75, h: 1.8, d: 0.7, color: '#b9bec6', bodyColor: '#b9bec6', doorColor: '#cdd2d9', doors: 1, handles: 'bar' } } },
  { words: ['microwave'], item: { type: 'microwave', label: 'Microwave', params: { w: 0.5, h: 0.3, d: 0.38, color: '#2c2f35', bodyColor: '#33373e', mountY: 0.9 } } },
  { words: ['stove', 'oven', 'cooktop'], item: { type: 'stove', label: 'Stove', params: { w: 0.6, h: 0.9, d: 0.6, color: '#3d4046', bodyColor: '#4a4e55', doorColor: '#34373c', countertopColor: '#1e2024', doors: 1, handles: 'bar' } } },
  { words: ['sink'], item: { type: 'base', label: 'Sink cabinet', params: { ...BASE_CABINET_PARAMS } } },
  { words: ['hood', 'extractor'], item: { type: 'hood', label: 'Range hood', params: { w: 0.6, h: 0.14, d: 0.5, color: '#aab0b8', bodyColor: '#aab0b8', mountY: 1.62, intensity: 0.9 } } },
  { words: ['island'], item: { type: 'island', label: 'Island', params: { w: 1.6, h: 0.9, d: 0.9, bodyColor: '#3f4a5a', doorColor: '#48566a', countertopColor: '#e8e4dc', doors: 2, drawers: 2, handles: 'bar' } } },
  { words: ['wardrobe', 'closet'], item: { type: 'tall', label: 'Wardrobe', params: { w: 1.2, h: 2.1, d: 0.6, bodyColor: '#8a7357', doorColor: '#9a8368', doors: 2, drawers: 0, handles: 'bar' } } },
  { words: ['bookcase', 'bookshelf', 'shelf'], item: { type: 'shelf', label: 'Open shelf', params: { w: 0.8, h: 1.8, d: 0.35, bodyColor: '#8a7357', doorColor: '#8a7357', countertopColor: '#8a7357', doors: 0, drawers: 0, handles: 'none' } } },
  { words: ['dresser'], item: { type: 'base', label: 'Dresser', params: { w: 1.1, h: 0.85, d: 0.5, bodyColor: '#6b4f3a', doorColor: '#7d5f45', doors: 0, drawers: 3, handles: 'bar' } } },
  { words: ['nightstand', 'bedside'], item: { type: 'base', label: 'Nightstand', params: { w: 0.45, h: 0.55, d: 0.4, bodyColor: '#6d4c41', doorColor: '#8d6e63', doors: 0, drawers: 2, handles: 'knob' } } },
  { words: ['drawer'], item: { type: 'base', label: 'Drawer cabinet', params: { w: 0.8, h: 0.85, d: 0.6, bodyColor: '#5a6b5d', doorColor: '#6b7d6e', countertopColor: '#2f2b28', doors: 0, drawers: 3, handles: 'bar' } } },
  { words: ['cabinet'], item: { type: 'base', label: 'Cabinet', params: { ...BASE_CABINET_PARAMS } } },
  { words: ['pendant'], item: { type: 'pendant', label: 'Pendant light', params: { color: '#f59e0b', scale: 1, intensity: 1.4, mountY: 2.3 } } },
  { words: ['lamp', 'light'], item: { type: 'floor-lamp', label: 'Floor lamp', params: { color: '#b45309', scale: 1, intensity: 1.1 } } },
  { words: ['plant', 'flower'], item: { type: 'plant', label: 'Decorative plant', params: { color: '#2e7d32', scale: 1 } } },
  { words: ['rug', 'carpet'], item: { type: 'rug', label: 'Rug', params: { color: '#9c4a3c', scale: 1 } } },
  { words: ['tv', 'television'], item: { type: 'tv', label: 'TV', params: { w: 1.2, h: 0.7, d: 0.06, color: '#101318', bodyColor: '#1b1f26', mountY: 1.4 } } },
  { words: ['sofa', 'couch'], item: { type: 'sofa', label: 'Sofa', params: { w: 2.0, h: 0.8, d: 0.9, color: '#5d6b7a', bodyColor: '#4e5a68' } } },
  { words: ['bed'], item: { type: 'bed', label: 'Double bed', params: { w: 1.6, h: 0.55, d: 2.0, color: '#8d6e63', bodyColor: '#6d4c41' } } },
  { words: ['desk'], item: { type: 'table', label: 'Desk', params: { w: 1.4, h: 0.75, d: 0.7, color: '#7a5c3f', bodyColor: '#6b4e34' } } },
  { words: ['chair', 'stool'], item: { type: 'chair', label: 'Chair', params: { w: 0.45, h: 0.9, d: 0.5, color: '#6b4e34' } } },
  { words: ['table'], item: { type: 'table', label: 'Dining table', params: { w: 1.5, h: 0.75, d: 0.9, color: '#7a5c3f', bodyColor: '#6b4e34' } } },
];

const KEYWORD_MATCHERS: Array<{ re: RegExp; item: GeneratedItem }> = KEYWORD_ITEMS.map((entry) => ({
  re: new RegExp(`\\b(?:${entry.words.join('|')})\\b`, 'i'),
  item: entry.item,
}));

/** Map free text to a valid SceneObject shape (unknown input → base cabinet). */
function itemForText(text: string): GeneratedItem {
  const t = text.toLowerCase();
  for (const m of KEYWORD_MATCHERS) {
    if (m.re.test(t)) return clone(m.item);
  }
  return { type: 'base', label: 'Cabinet', params: clone(BASE_CABINET_PARAMS) };
}

/** Pick the room kind from free text (kitchen / bedroom / office / living). */
function roomKindForText(text: string): DemoRoomKind {
  const t = text.toLowerCase();
  if (/\bkitchen\b/.test(t)) return 'kitchen';
  if (/\b(bedroom|bed|sleep|guest room)\b/.test(t)) return 'bedroom';
  if (/\b(office|desk|study|workspace)\b/.test(t)) return 'office';
  if (/\b(living|lounge|tv|sofa|couch)\b/.test(t)) return 'living';
  return 'kitchen';
}

/** The fixed demo kitchen scene returned by the AI reconstruction endpoints. */
function demoReconstructResult(): ReconstructResult {
  return {
    roomSpec: clone(KITCHEN_SPEC),
    roomType: 'kitchen',
    objects: clone(KITCHEN_SCENE.objects),
    description: 'Demo reconstruction (static demo mode).',
  };
}

// ---------------- deterministic AI helpers (text editing) ----------------

const round2 = (n: number): number => Math.round(n * 100) / 100;

const COLOR_WORDS: Array<[string, string]> = [
  ['white', '#f5f5f4'],
  ['black', '#27272a'],
  ['gray', '#71717a'],
  ['grey', '#71717a'],
  ['brown', '#7c4a2d'],
  ['beige', '#d9cbb2'],
  ['green', '#2e7d32'],
];

const COLOR_WORD_MATCHERS = COLOR_WORDS.map(([word, hex]) => ({
  re: new RegExp(`\\b${word}\\b`, 'i'),
  hex,
}));

/** Blend one hex color toward another by a ratio (0..1). */
function mixColor(hex: string, toward: string, ratio: number): string {
  const parse = (h: string): [number, number, number] | null => {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(h.trim());
    if (!m) return null;
    let s = m[1];
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    const n = parseInt(s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const from = parse(hex);
  const to = parse(toward);
  if (!from || !to) return hex;
  const mixed = from.map((c, i) => Math.round(c + (to[i] - c) * ratio));
  return `#${mixed.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

// ---------------- demo API ----------------

export const demoApi: typeof api = {
  // ---- Admin authentication ----
  login: async (password) => {
    const db = loadDb();
    if (password !== db.password) throw new Error('Incorrect password');
    storage().setItem(SESSION_KEY, '1');
    return { ok: true };
  },

  logout: async () => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(SESSION_KEY);
      } catch {
        // Ignore storage failures — logging out should never throw.
      }
    }
    return { ok: true };
  },

  // Safe default during SSR instead of throwing — the session is only a flag read.
  session: async () => ({ authed: readSession() }),

  changePassword: async (currentPassword, newPassword) => {
    const db = loadDb();
    if (currentPassword !== db.password) throw new Error('Incorrect password');
    if (!newPassword) throw new Error('New password is required');
    db.password = newPassword;
    saveDb(db);
    return { ok: true };
  },

  // ---- Admin dashboard stats ----
  adminStats: async () => {
    const db = loadDb();
    return buildAdminStats(db);
  },

  // ---- Public landing-page portfolio ----
  listPortfolio: async (all) => {
    const db = loadDb();
    const items = db.portfolio
      .filter((item) => all || item.visible)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
      .map(toPortfolioDTO);
    return { items };
  },

  getPortfolioItem: async (id) => {
    const db = loadDb();
    const item = db.portfolio.find((it) => it.id === id);
    if (!item) throw new Error('Portfolio item not found');
    return { item: toPortfolioDTO(item) };
  },

  createPortfolioItem: async (p) => {
    const db = loadDb();
    const maxOrder = db.portfolio.reduce((max, it) => Math.max(max, it.sortOrder), 0);
    const item: DemoPortfolio = {
      id: newId(),
      title: p.title,
      description: p.description ?? '',
      category: p.category ?? '',
      image: p.image ?? '',
      roomSpec: sanitizeRoomSpec(p.roomSpec),
      sceneState: sanitizeSceneState(p.sceneState),
      visible: p.visible ?? true,
      sortOrder: p.sortOrder ?? maxOrder + 1,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.portfolio.push(item);
    saveDb(db);
    return { item: toPortfolioDTO(item) };
  },

  updatePortfolioItem: async (id, patch) => {
    const db = loadDb();
    const item = db.portfolio.find((it) => it.id === id);
    if (!item) throw new Error('Portfolio item not found');
    const rec = patch as unknown as Record<string, unknown>;
    for (const key of ['title', 'description', 'category', 'image', 'visible', 'sortOrder'] as const) {
      const v = rec[key];
      if (v !== undefined) (item as unknown as Record<string, unknown>)[key] = v;
    }
    if (rec.roomSpec !== undefined) item.roomSpec = sanitizeRoomSpec(rec.roomSpec);
    if (rec.sceneState !== undefined) item.sceneState = sanitizeSceneState(rec.sceneState);
    item.updatedAt = nowIso();
    saveDb(db);
    return { item: toPortfolioDTO(item) };
  },

  deletePortfolioItem: async (id) => {
    const db = loadDb();
    const item = db.portfolio.find((it) => it.id === id);
    if (!item) throw new Error('Portfolio item not found');
    db.portfolio = db.portfolio.filter((it) => it.id !== id);
    saveDb(db);
    return { ok: true };
  },

  // ---- 3D reconstruction (deterministic demo result) ----
  reconstruct: async (images) => {
    // Simulated processing time — a little longer with more photos (~800 ms for 2).
    await delay(600 + Math.min(400, images.length * 100));
    return demoReconstructResult();
  },

  reconstructStream: async (images, floorPlan, onProgress) => {
    const total = Math.max(1, images.length);
    if (floorPlan) {
      onProgress?.({ stage: 'floorplan', message: 'Reading the floor plan...' });
      await delay(500);
    }
    for (let i = 1; i <= total; i++) {
      onProgress?.({ stage: 'analyze', index: i, total, message: `Analyzing photo ${i} of ${total}...` });
      await delay(500);
      onProgress?.({ stage: 'analyze', index: i, total, message: `Photo ${i} of ${total} analyzed` });
      await delay(500);
    }
    onProgress?.({ stage: 'merge', message: 'Merging analysis results...' });
    await delay(500);
    onProgress?.({ stage: 'build', message: 'Building the 3D scene...' });
    await delay(500);
    return demoReconstructResult();
  },

  // ---- Text-to-3D generation (deterministic keyword mapping) ----
  generateObject: async (text) => {
    await delay(300 + Math.random() * 300);
    return { item: itemForText(text) };
  },

  generateRoom: async (text) => {
    await delay(400 + Math.random() * 300);
    const kind = roomKindForText(text);
    return {
      roomType: kind,
      roomSpec: clone(ROOM_SPECS[kind]),
      objects: clone(ROOM_LAYOUTS[kind]),
      description: 'A generated demo layout (demo mode).',
    };
  },

  // ---- Text-based editing of the selected object ----
  aiEditObject: async (object, text) => {
    await delay(200 + Math.random() * 150);
    const t = text.toLowerCase();
    const params: ObjectParams = {};
    const patch: ObjectPatch = {};

    // Explicit color words → params color
    const colorMatch = COLOR_WORD_MATCHERS.find((m) => m.re.test(t));
    if (colorMatch) params.color = colorMatch.hex;

    // Lightness tweaks relative to the current color
    const lighter = /\blighter\b/.test(t);
    const darker = /\bdarker\b/.test(t);
    if (lighter || darker) {
      const base = params.color ?? object.params.color ?? object.params.bodyColor ?? '#9a9a9a';
      params.color = lighter ? mixColor(base, '#ffffff', 0.25) : mixColor(base, '#000000', 0.25);
    }

    // Mirror the new color onto cabinet body/door colors when present
    if (params.color) {
      if (typeof object.params.bodyColor === 'string') params.bodyColor = params.color;
      if (typeof object.params.doorColor === 'string') {
        params.doorColor = mixColor(params.color, '#ffffff', 0.1);
      }
    }

    // Size changes — cabinets use w/h/d, decor uses scale
    let sizeFactor = 1;
    let widthFactor = 1;
    if (/\b(bigger|larger)\b/.test(t)) {
      sizeFactor *= 1.2;
      widthFactor *= 1.2;
    }
    if (/\bsmaller\b/.test(t)) {
      sizeFactor /= 1.2;
      widthFactor /= 1.2;
    }
    if (/\bwider\b/.test(t)) widthFactor *= 1.2;
    let heightFactor = 1;
    if (/\btaller\b/.test(t)) heightFactor *= 1.2;
    if (/\bshorter\b/.test(t)) heightFactor /= 1.2;

    if (sizeFactor !== 1 || widthFactor !== 1) {
      if (typeof object.params.w === 'number') {
        params.w = round2(object.params.w * widthFactor);
        if (typeof object.params.d === 'number') params.d = round2(object.params.d * sizeFactor);
      }
      if (typeof object.params.scale === 'number' || typeof object.params.w !== 'number') {
        params.scale = round2((object.params.scale ?? 1) * sizeFactor);
      }
    }
    if (heightFactor !== 1 && typeof object.params.h === 'number') {
      params.h = round2(object.params.h * heightFactor);
    }

    if (Object.keys(params).length > 0) patch.params = params;
    return { patch };
  },

  // ---- Client folders ----
  listFolders: async () => {
    const db = loadDb();
    const folders = [...db.folders]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((f) => toFolderDTO(f, db));
    return { folders };
  },

  createFolder: async (name, phone) => {
    const db = loadDb();
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Folder name is required');
    const existing = db.folders.find(
      (f) => f.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) return { folder: toFolderDTO(existing, db), existed: true };
    const folder: DemoFolder = { id: newId(), name: trimmed, phone: phone ?? null, createdAt: nowIso() };
    db.folders.push(folder);
    saveDb(db);
    return { folder: toFolderDTO(folder, db) };
  },

  renameFolder: async (id, name) => {
    const db = loadDb();
    const folder = db.folders.find((f) => f.id === id);
    if (!folder) throw new Error('Folder not found');
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Folder name is required');
    folder.name = trimmed;
    saveDb(db);
    return { folder: toFolderDTO(folder, db) };
  },

  deleteFolder: async (id) => {
    const db = loadDb();
    const folder = db.folders.find((f) => f.id === id);
    if (!folder) throw new Error('Folder not found');
    db.folders = db.folders.filter((f) => f.id !== id);
    // Projects of the deleted folder keep living without a folder.
    for (const p of db.projects) {
      if (p.folderId === id) p.folderId = null;
    }
    saveDb(db);
    return { ok: true };
  },

  // ---- Projects ----
  listProjects: async (folderId, q) => {
    const db = loadDb();
    const needle = q ? q.trim().toLowerCase() : '';
    let rows = db.projects;
    // 'none' (serialized null) or null → only projects without a folder
    if (folderId === 'none' || folderId === null) {
      rows = rows.filter((p) => p.folderId === null);
    } else if (folderId !== undefined) {
      rows = rows.filter((p) => p.folderId === folderId);
    }
    if (needle) {
      rows = rows.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          (p.clientName ?? '').toLowerCase().includes(needle),
      );
    }
    const projects = [...rows]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((p) => toProjectDTO(p, db));
    return { projects };
  },

  createProject: async (p) => {
    const db = loadDb();
    const created = nowIso();
    const project: DemoProject = {
      id: newId(),
      name: p.name,
      roomType: p.roomType ?? 'kitchen',
      roomSpec: clone(p.roomSpec),
      sceneState: p.sceneState ? clone(p.sceneState) : { objects: [] },
      thumbnail: null,
      isPublic: false,
      folderId: p.folderId ?? null,
      clientName: p.clientName ?? null,
      clientPhone: p.clientPhone ?? null,
      address: p.address ?? null,
      stage: p.stage ?? null,
      dealAt: p.dealAt ?? null,
      contractAmount: p.contractAmount ?? null,
      contractPhoto: p.contractPhoto ?? null,
      invoicePhoto: p.invoicePhoto ?? null,
      visitAt: p.visitAt ?? null,
      installAt: p.installAt ?? null,
      dueAt: p.dueAt ?? null,
      createdAt: created,
      updatedAt: created,
    };
    db.projects.push(project);
    saveDb(db);
    return { project: toProjectDTO(project, db) };
  },

  getProject: async (id) => {
    const db = loadDb();
    const project = db.projects.find((p) => p.id === id);
    if (!project) throw new Error('Project not found');
    return { project: toProjectDTO(project, db) };
  },

  patchProject: async (id, patch) => {
    const db = loadDb();
    const project = db.projects.find((p) => p.id === id);
    if (!project) throw new Error('Project not found');
    const rec = patch as unknown as Record<string, unknown>;
    for (const key of [
      'name', 'roomType', 'roomSpec', 'sceneState', 'thumbnail', 'isPublic', 'folderId',
      'clientName', 'clientPhone', 'address', 'stage', 'dealAt', 'contractAmount',
      'contractPhoto', 'invoicePhoto', 'visitAt', 'installAt', 'dueAt',
    ] as const) {
      const v = rec[key];
      if (v === undefined) continue;
      (project as unknown as Record<string, unknown>)[key] =
        key === 'roomSpec' || key === 'sceneState' ? clone(v) : v;
    }
    project.updatedAt = nowIso();
    saveDb(db);
    return { project: toProjectDTO(project, db) };
  },

  deleteProject: async (id) => {
    const db = loadDb();
    const project = db.projects.find((p) => p.id === id);
    if (!project) throw new Error('Project not found');
    db.projects = db.projects.filter((p) => p.id !== id);
    const removedLinkIds = new Set(
      db.shareLinks.filter((l) => l.projectId === id).map((l) => l.id),
    );
    db.shareLinks = db.shareLinks.filter((l) => l.projectId !== id);
    db.guests = db.guests.filter((g) => !removedLinkIds.has(g.shareLinkId));
    saveDb(db);
    return { ok: true };
  },

  projectGuests: async (id) => {
    const db = loadDb();
    if (!db.projects.some((p) => p.id === id)) throw new Error('Project not found');
    const linkIds = new Set(
      db.shareLinks.filter((l) => l.projectId === id).map((l) => l.id),
    );
    const guests = db.guests
      .filter((g) => linkIds.has(g.shareLinkId))
      .map(toGuestDTO);
    return { guests };
  },

  // ---- Editor guest autosave ----
  saveAsGuest: async (p) => {
    const db = loadDb();
    const link = findActiveLink(db, p.token);
    const project = db.projects.find((pr) => pr.id === link.projectId);
    if (!project) throw new Error('Invalid or expired link');
    project.sceneState = clone(p.sceneState);
    project.updatedAt = nowIso();
    saveDb(db);
    return { ok: true, updatedAt: project.updatedAt };
  },

  // ---- Share links ----
  createShareLink: async (p) => {
    const db = loadDb();
    if (!db.projects.some((pr) => pr.id === p.projectId)) throw new Error('Project not found');
    const days = p.expiresInDays ?? 7;
    const link: DemoShareLink = {
      id: newId(),
      projectId: p.projectId,
      token: randomString(24, TOKEN_ALPHABET),
      shortCode: randomString(8, CODE_ALPHABET),
      role: p.role ?? 'viewer',
      active: true,
      expiresAt: new Date(Date.now() + days * DAY_MS).toISOString(),
      createdAt: nowIso(),
    };
    db.shareLinks.push(link);
    saveDb(db);
    return { link: toShareLinkDTO(link, db) };
  },

  listShareLinks: async (projectId) => {
    const db = loadDb();
    const links = db.shareLinks
      .filter((l) => l.projectId === projectId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((l) => toShareLinkDTO(l, db));
    return { links };
  },

  patchShareLink: async (p) => {
    const db = loadDb();
    const link = db.shareLinks.find((l) => l.id === p.id);
    if (!link) throw new Error('Share link not found');
    if (p.active !== undefined) link.active = p.active;
    if (p.role !== undefined) link.role = p.role;
    saveDb(db);
    return { link: toShareLinkDTO(link, db) };
  },

  resolveShare: async (token) => {
    const db = loadDb();
    const link = findActiveLink(db, token);
    const project = db.projects.find((pr) => pr.id === link.projectId);
    if (!project) throw new Error('Invalid or expired link');
    return {
      ok: true,
      project: {
        id: project.id,
        name: project.name,
        roomType: project.roomType,
        roomSpec: asRoomSpec(project.roomSpec),
        sceneState: asSceneState(project.sceneState),
      },
      link: { id: link.id, role: link.role, expiresAt: link.expiresAt },
    };
  },

  // ---- Guests ----
  registerGuest: async (p) => {
    const db = loadDb();
    const link = findActiveLink(db, p.token);
    const guest: DemoGuest = {
      id: newId(),
      name: p.name.trim() || 'Guest',
      color: GUEST_COLORS[db.guests.length % GUEST_COLORS.length],
      role: link.role,
      createdAt: nowIso(),
      shareLinkId: link.id,
    };
    db.guests.push(guest);
    saveDb(db);
    return { guest: toGuestDTO(guest) };
  },

  getGuest: async (id) => {
    const db = loadDb();
    const guest = db.guests.find((g) => g.id === id);
    if (!guest) throw new Error('Guest not found');
    return { guest: toGuestDTO(guest) };
  },

  patchGuest: async (id, role) => {
    const db = loadDb();
    const guest = db.guests.find((g) => g.id === id);
    if (!guest) throw new Error('Guest not found');
    guest.role = role;
    saveDb(db);
    return { guest: toGuestDTO(guest) };
  },

  // ---- Presets ----
  listPresets: async () => {
    const db = loadDb();
    return { presets: db.presets.map(toPresetDTO) };
  },

  createPreset: async (p) => {
    const db = loadDb();
    const preset: DemoPreset = {
      id: newId(),
      name: p.name,
      data: clone(p.data),
      createdAt: nowIso(),
    };
    db.presets.push(preset);
    saveDb(db);
    return { preset: toPresetDTO(preset) };
  },

  deletePreset: async (id) => {
    const db = loadDb();
    db.presets = db.presets.filter((preset) => preset.id !== id);
    saveDb(db);
    return { ok: true };
  },
};
