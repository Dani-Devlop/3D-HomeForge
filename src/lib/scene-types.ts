// ============================================================
// تایپ‌های مشترک صحنه سه‌بعدی — بین API، ویرایشگر و نمایشگر مشتری
// ============================================================

export type WallName = 'back' | 'front' | 'left' | 'right';

export interface WindowSpec {
  wall: WallName;
  offsetX: number; // فاصله از مرکز دیوار (متر)
  sillY: number; // ارتفاع کف پنجره
  width: number;
  height: number;
}

export interface DoorwaySpec {
  wall: WallName;
  offsetX: number;
  width: number;
  height: number;
}

/** مشخصات فضای بازسازی‌شده از عکس */
export interface RoomSpec {
  widthM: number;
  depthM: number;
  heightM: number;
  wallColor: string;
  floorColor: string;
  ceilingColor: string;
  windows: WindowSpec[];
  doorways: DoorwaySpec[];
}

export type ObjectType =
  | 'base' // کابینت زمینی
  | 'wall' // کابینت دیواری
  | 'tall' // کابینت بلند / یخچالی
  | 'island' // جزیره
  | 'shelf' // قفسه باز
  | 'pendant' // چراغ آویز
  | 'floor-lamp' // چراغ ایستاده
  | 'plant' // گیاه
  | 'rug'; // فرش

export type HandleType = 'bar' | 'knob' | 'none';

export interface ObjectParams {
  // کابینت
  w?: number;
  h?: number;
  d?: number;
  bodyColor?: string;
  doorColor?: string;
  countertopColor?: string;
  doors?: number; // 0..2
  drawers?: number; // 0..3
  handles?: HandleType;
  mountY?: number; // ارتفاع نصب کابینت دیواری
  // دکور/چراغ
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
  open?: boolean; // درب/کشو باز است؟ (Mesh State)
  on?: boolean; // چراغ روشن است؟
}

export interface SceneState {
  objects: SceneObject[];
}

export const defaultSceneState = (): SceneState => ({ objects: [] });

// ---------------- کاتالوگ کتابخانه (پارامتریک) ----------------

export type CatalogCategory = 'cabinet' | 'decor' | 'light';

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
    label: 'کابینت زمینی',
    category: 'cabinet',
    description: 'کابینت پایه با درب و کشو و صفحه رویه',
    defaults: {
      w: 0.8, h: 0.85, d: 0.6,
      bodyColor: '#6b4f3a', doorColor: '#7d5f45', countertopColor: '#d8d3c8',
      doors: 2, drawers: 0, handles: 'bar',
    },
  },
  {
    type: 'base',
    label: 'کابینت کشودار',
    category: 'cabinet',
    description: 'کابینت پایه با سه کشو',
    defaults: {
      w: 0.8, h: 0.85, d: 0.6,
      bodyColor: '#5a6b5d', doorColor: '#6b7d6e', countertopColor: '#2f2b28',
      doors: 0, drawers: 3, handles: 'bar',
    },
  },
  {
    type: 'wall',
    label: 'کابینت دیواری',
    category: 'cabinet',
    description: 'کابینت بالایی نصب‌شونده روی دیوار',
    defaults: {
      w: 0.8, h: 0.7, d: 0.35,
      bodyColor: '#8a6d4f', doorColor: '#9a7c5c', countertopColor: '#d8d3c8',
      doors: 2, drawers: 0, handles: 'knob', mountY: 1.5,
    },
  },
  {
    type: 'tall',
    label: 'کابینت بلند',
    category: 'cabinet',
    description: 'یونیت تمام‌قد (قفسه پانتری / یخچال)',
    defaults: {
      w: 0.6, h: 2.1, d: 0.6,
      bodyColor: '#4f5d75', doorColor: '#5d6d87', countertopColor: '#d8d3c8',
      doors: 2, drawers: 0, handles: 'bar',
    },
  },
  {
    type: 'island',
    label: 'جزیره',
    category: 'cabinet',
    description: 'جزیره مرکزی آشپزخانه با رویه سنگی',
    defaults: {
      w: 1.6, h: 0.9, d: 0.9,
      bodyColor: '#3f4a5a', doorColor: '#48566a', countertopColor: '#e8e4dc',
      doors: 2, drawers: 2, handles: 'bar',
    },
  },
  {
    type: 'shelf',
    label: 'قفسه باز',
    category: 'cabinet',
    description: 'قفسه چندطبقه بدون درب',
    defaults: {
      w: 0.8, h: 1.8, d: 0.35,
      bodyColor: '#8a7357', doorColor: '#8a7357', countertopColor: '#8a7357',
      doors: 0, drawers: 0, handles: 'none',
    },
  },
  {
    type: 'pendant',
    label: 'چراغ آویز',
    category: 'light',
    description: 'چراغ سقفی آویزان با نور قابل کنترل',
    defaults: {
      color: '#f59e0b', scale: 1, intensity: 1.4, mountY: 2.3,
    },
  },
  {
    type: 'floor-lamp',
    label: 'چراغ ایستاده',
    category: 'light',
    description: 'آباژور زمینی با نور گرم',
    defaults: {
      color: '#b45309', scale: 1, intensity: 1.1,
    },
  },
  {
    type: 'plant',
    label: 'گیاه دکوری',
    category: 'decor',
    description: 'گلدان با گیاه سبز',
    defaults: { color: '#2e7d32', scale: 1 },
  },
  {
    type: 'rug',
    label: 'فرش',
    category: 'decor',
    description: 'فرش کف با رنگ دلخواه',
    defaults: { color: '#9c4a3c', scale: 1 },
  },
];

// ---------------- پالت رنگ مهمان‌ها ----------------

export const GUEST_COLORS = [
  '#e11d48', '#059669', '#d97706', '#7c3aed',
  '#0891b2', '#db2777', '#65a30d', '#ea580c',
];

export const guestColorFor = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return GUEST_COLORS[hash % GUEST_COLORS.length];
};

// ---------------- اعتبارسنجی نقش‌ها ----------------

export type ShareRole = 'viewer' | 'modifier';

export const isValidRole = (r: unknown): r is ShareRole =>
  r === 'viewer' || r === 'modifier';
