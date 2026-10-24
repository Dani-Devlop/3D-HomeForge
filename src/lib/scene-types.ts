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
  | 'fridge' // یخچال
  | 'stove' // اجاق گاز
  | 'hood' // هود
  | 'pendant' // چراغ آویز
  | 'floor-lamp' // چراغ ایستاده
  | 'plant' // گیاه
  | 'rug'; // فرش

/** انواع قابل تشخیص/بازسازی توسط AI و تولید با متن */
export const RECONSTRUCTABLE_TYPES: readonly ObjectType[] = [
  'base', 'wall', 'tall', 'island', 'shelf', 'fridge', 'stove', 'hood',
];

/** انواع دارای درب باز/بسته‌شونده (Mesh States) */
export const DOOR_TYPES: readonly ObjectType[] = ['base', 'wall', 'tall', 'island', 'shelf', 'fridge', 'stove'];

/** انواع دارای روشن/خاموش (چراغ) */
export const LIGHT_TYPES: readonly ObjectType[] = ['pendant', 'floor-lamp', 'hood', 'stove'];

export const isDoorType = (t: ObjectType) => DOOR_TYPES.includes(t);
export const isLightType = (t: ObjectType) => LIGHT_TYPES.includes(t);

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

export type CatalogCategory = 'cabinet' | 'appliance' | 'light' | 'decor';

export const CATALOG_CATEGORY_LABEL: Record<CatalogCategory, string> = {
  cabinet: 'کابینت‌ها',
  appliance: 'لوازم موجود',
  light: 'چراغ‌ها',
  decor: 'دکور',
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
    type: 'fridge',
    label: 'یخچال',
    category: 'appliance',
    description: 'یخچال دو‌درب با دستگیره — درب آن باز می‌شود',
    defaults: {
      w: 0.75, h: 1.8, d: 0.7,
      color: '#b9bec6', bodyColor: '#b9bec6', doorColor: '#cdd2d9',
      doors: 1, handles: 'bar',
    },
  },
  {
    type: 'stove',
    label: 'اجاق گاز',
    category: 'appliance',
    description: 'اجاق با فر و صفحه گاز — شعله‌ها قابل روشن/خاموش هستند',
    defaults: {
      w: 0.6, h: 0.9, d: 0.6,
      color: '#3d4046', bodyColor: '#4a4e55', doorColor: '#34373c',
      countertopColor: '#1e2024', doors: 1, handles: 'bar',
    },
  },
  {
    type: 'hood',
    label: 'هود',
    category: 'appliance',
    description: 'هود آشپزخانه با چراغ — نصب روی دیوار بالای اجاق',
    defaults: {
      w: 0.6, h: 0.14, d: 0.5,
      color: '#aab0b8', bodyColor: '#aab0b8',
      mountY: 1.62, intensity: 0.9,
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

// ---------------- جانمایی روی دیوار (مشترک بین AI و UI) ----------------

/** نقطه قرارگیری آبجکت با عمق مشخص روی دیوار — offsetX از مرکز دیوار (متر) */
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

// ---------------- پچ ویرایش متنی آبجکت (خروجی /api/ai/edit) ----------------

export interface ObjectPatch {
  /** جابه‌جایی نسبی بر حسب متر */
  positionDelta?: [number, number, number];
  /** چرخش نسبی بر حسب رادیان */
  rotationYDelta?: number;
  params?: ObjectParams;
  label?: string;
  open?: boolean;
  on?: boolean;
}

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
