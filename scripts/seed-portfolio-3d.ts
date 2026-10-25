// یک‌بار مصرف: اتصال صحنه‌های سه‌بعدی زنده دمو به ۴ نمونه‌کار موجود
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const KITCHEN_ROOM = {
  widthM: 4.2, depthM: 3.4, heightM: 2.8,
  wallColor: '#ece7dd', floorColor: '#a97c50', ceilingColor: '#fafafa',
  windows: [{ wall: 'back', offsetX: -0.9, sillY: 1.0, width: 1.4, height: 1.3 }],
  doorways: [{ wall: 'front', offsetX: 1.2, width: 0.95, height: 2.1 }],
};

const KITCHEN_SCENE = {
  objects: [
    { id: 's1', type: 'base', label: 'کابینت زمینی', params: { w: 0.8, h: 0.85, d: 0.6, bodyColor: '#6b4f3a', doorColor: '#7d5f45', countertopColor: '#d8d3c8', doors: 2, drawers: 0, handles: 'bar' }, position: [-1.2, 0, -1.35], rotationY: 0, open: false },
    { id: 's2', type: 'base', label: 'کابینت کشودار', params: { w: 0.8, h: 0.85, d: 0.6, bodyColor: '#6b4f3a', doorColor: '#7d5f45', countertopColor: '#d8d3c8', doors: 0, drawers: 3, handles: 'bar' }, position: [-0.4, 0, -1.35], rotationY: 0, open: false },
    { id: 's3', type: 'stove', label: 'اجاق گاز', params: { w: 0.6, h: 0.9, d: 0.6, bodyColor: '#57534e', countertopColor: '#2a2d31' }, position: [0.4, 0, -1.35], rotationY: 0, on: true },
    { id: 's4', type: 'wall', label: 'کابینت دیواری', params: { w: 0.8, h: 0.7, d: 0.35, bodyColor: '#8a6d4f', doorColor: '#9a7c5c', doors: 2, drawers: 0, handles: 'knob', mountY: 1.5 }, position: [-0.8, 1.5, -1.55], rotationY: 0, open: false },
    { id: 's5', type: 'wall', label: 'کابینت دیواری شیشه‌ای', params: { w: 0.8, h: 0.7, d: 0.35, bodyColor: '#8a6d4f', doorColor: '#9a7c5c', doors: 2, drawers: 0, handles: 'knob', mountY: 1.5, glass: true }, position: [0, 1.5, -1.55], rotationY: 0, open: false },
    { id: 's6', type: 'tall', label: 'کابینت بلند', params: { w: 0.6, h: 2.1, d: 0.6, bodyColor: '#6b4f3a', doorColor: '#7d5f45', doors: 2, drawers: 0, handles: 'bar' }, position: [1.6, 0, -1.35], rotationY: 0, open: false },
    { id: 's7', type: 'island', label: 'جزیره', params: { w: 1.6, h: 0.9, d: 0.9, bodyColor: '#3f4a5a', doorColor: '#48566a', countertopColor: '#e8e4dc', doors: 2, drawers: 2, handles: 'bar' }, position: [0, 0, 0.3], rotationY: 0, open: false },
    { id: 's12', type: 'hood', label: 'هود', params: { w: 0.6, h: 0.35, d: 0.5, mountY: 1.62, intensity: 0.9 }, position: [0.4, 1.62, -1.43], rotationY: 0, on: true },
    { id: 's13', type: 'fridge', label: 'یخچال', params: { w: 0.75, h: 1.9, d: 0.72 }, position: [-1.72, 0, 0.9], rotationY: 1.5707963267948966, open: false },
    { id: 's8', type: 'pendant', label: 'چراغ آویز', params: { color: '#f59e0b', intensity: 1.4, mountY: 2.3 }, position: [0, 2.3, 0.3], rotationY: 0, on: true },
    { id: 's9', type: 'pendant', label: 'چراغ آویز', params: { color: '#f59e0b', intensity: 1.4, mountY: 2.3 }, position: [-1.4, 2.3, 0.3], rotationY: 0, on: false },
    { id: 's10', type: 'plant', label: 'گیاه دکوری', params: { color: '#2e7d32', scale: 1 }, position: [1.7, 0, 1.2], rotationY: 0 },
    { id: 's11', type: 'rug', label: 'فرش', params: { color: '#9c4a3c', scale: 1 }, position: [0, 0, 1.3], rotationY: 0 },
  ],
};

const BEDROOM_ROOM = {
  widthM: 4.0, depthM: 3.8, heightM: 2.7,
  wallColor: '#e7e0d4', floorColor: '#b08b62', ceilingColor: '#fbfaf7',
  windows: [{ wall: 'right', offsetX: 0.2, sillY: 0.9, width: 1.4, height: 1.3 }],
  doorways: [{ wall: 'front', offsetX: -0.8, width: 0.95, height: 2.1 }],
};

const BEDROOM_SCENE = {
  objects: [
    { id: 'b1', type: 'bed', label: 'تخت دو نفره', params: { w: 1.6, h: 0.55, d: 2.05, color: '#8d6e63', bodyColor: '#6d4c41' }, position: [-0.5, 0, -0.82], rotationY: 0 },
    { id: 'b2', type: 'tall', label: 'کمد لباس', params: { w: 1.3, h: 2.2, d: 0.62, bodyColor: '#7d5f45', doorColor: '#8a6d4f', doors: 2, drawers: 0, handles: 'bar' }, position: [1.25, 0, -1.56], rotationY: 0, open: false },
    { id: 'b3', type: 'tv', label: 'تلویزیون', params: { w: 1.15, h: 0.65, d: 0.06, mountY: 1.3 }, position: [-1.96, 1.3, 0.3], rotationY: 1.5707963267948966, on: true },
    { id: 'b4', type: 'table', label: 'پاتختی', params: { w: 0.5, h: 0.5, d: 0.4 }, position: [0.55, 0, -1.55], rotationY: 0 },
    { id: 'b5', type: 'rug', label: 'فرش', params: { color: '#8d6e63', scale: 1.2 }, position: [-0.3, 0, 1.0], rotationY: 0 },
    { id: 'b6', type: 'floor-lamp', label: 'چراغ ایستاده', params: { color: '#f59e0b', intensity: 1.2 }, position: [1.65, 0, 1.35], rotationY: 0, on: true },
    { id: 'b7', type: 'plant', label: 'گیاه', params: { color: '#2e7d32', scale: 1 }, position: [-1.7, 0, 1.5], rotationY: 0 },
  ],
};

const OFFICE_ROOM = {
  widthM: 3.8, depthM: 3.2, heightM: 2.7,
  wallColor: '#e5e1d8', floorColor: '#9c7b57', ceilingColor: '#fafafa',
  windows: [{ wall: 'right', offsetX: 0, sillY: 1.0, width: 1.2, height: 1.2 }],
  doorways: [{ wall: 'front', offsetX: 0.8, width: 0.9, height: 2.1 }],
};

const OFFICE_SCENE = {
  objects: [
    { id: 'o1', type: 'shelf', label: 'قفسه باز', params: { w: 0.85, h: 1.8, d: 0.3, bodyColor: '#7d5f45', doorColor: '#8a6d4f' }, position: [-1.35, 0, -1.39], rotationY: 0, open: false },
    { id: 'o2', type: 'wall', label: 'کمد دیواری', params: { w: 1.0, h: 0.6, d: 0.35, bodyColor: '#5d6b7a', doorColor: '#6b7a8c', doors: 2, drawers: 0, handles: 'bar', mountY: 1.9 }, position: [-0.3, 1.9, -1.4], rotationY: 0, open: false },
    { id: 'o3', type: 'wall', label: 'کمد دیواری', params: { w: 1.0, h: 0.6, d: 0.35, bodyColor: '#5d6b7a', doorColor: '#6b7a8c', doors: 2, drawers: 0, handles: 'bar', mountY: 1.9 }, position: [0.8, 1.9, -1.4], rotationY: 0, open: false },
    { id: 'o4', type: 'table', label: 'میز کار', params: { w: 1.5, h: 0.74, d: 0.7 }, position: [0.25, 0, -1.0], rotationY: 0 },
    { id: 'o5', type: 'chair', label: 'صندلی', params: {}, position: [0.25, 0, -0.25], rotationY: 3.141592653589793 },
    { id: 'o6', type: 'tall', label: 'کمد بلند', params: { w: 1.1, h: 2.2, d: 0.6, bodyColor: '#7d5f45', doorColor: '#8a6d4f', doors: 2, drawers: 0, handles: 'knob' }, position: [-1.57, 0, 0.7], rotationY: 1.5707963267948966, open: false },
    { id: 'o7', type: 'plant', label: 'گیاه', params: { color: '#2e7d32', scale: 1 }, position: [1.5, 0, 1.15], rotationY: 0 },
    { id: 'o8', type: 'pendant', label: 'چراغ', params: { color: '#f59e0b', intensity: 1.3, mountY: 2.3 }, position: [0.25, 2.3, -0.6], rotationY: 0, on: true },
  ],
};

const LIVING_ROOM = {
  widthM: 4.8, depthM: 4.2, heightM: 2.8,
  wallColor: '#efe9df', floorColor: '#a97c50', ceilingColor: '#fafafa',
  windows: [{ wall: 'back', offsetX: 1.6, sillY: 1.0, width: 1.3, height: 1.25 }],
  doorways: [{ wall: 'front', offsetX: -1.3, width: 0.95, height: 2.1 }],
};

const LIVING_SCENE = {
  objects: [
    { id: 'l1', type: 'tv', label: 'تلویزیون', params: { w: 1.5, h: 0.85, d: 0.06, mountY: 1.4 }, position: [0, 1.4, -2.04], rotationY: 0, on: true },
    { id: 'l2', type: 'base', label: 'میز تلویزیون', params: { w: 1.8, h: 0.45, d: 0.45, bodyColor: '#4e342e', doorColor: '#5d4037', countertopColor: '#d8d3c8', doors: 2, drawers: 0, handles: 'bar' }, position: [0, 0, -1.85], rotationY: 0, open: false },
    { id: 'l3', type: 'sofa', label: 'مبل', params: { w: 2.3, h: 0.8, d: 0.95, color: '#8a6a5c', bodyColor: '#6b4a40' }, position: [0.3, 0, 1.4], rotationY: 3.141592653589793 },
    { id: 'l4', type: 'table', label: 'میز جلومبلی', params: { w: 1.0, h: 0.42, d: 0.55 }, position: [0.3, 0, 0.35], rotationY: 0 },
    { id: 'l5', type: 'rug', label: 'فرش', params: { color: '#9c4a3c', scale: 1.5 }, position: [0.3, 0, 0.75], rotationY: 0 },
    { id: 'l6', type: 'floor-lamp', label: 'چراغ ایستاده', params: { color: '#f59e0b', intensity: 1.2 }, position: [1.95, 0, 1.5], rotationY: 0, on: true },
    { id: 'l7', type: 'plant', label: 'گیاه', params: { color: '#2e7d32', scale: 1 }, position: [-2.0, 0, 1.55], rotationY: 0 },
    { id: 'l8', type: 'pendant', label: 'چراغ آویز', params: { color: '#f59e0b', intensity: 1.2, mountY: 2.4 }, position: [0.3, 2.4, 0.3], rotationY: 0, on: false },
  ],
};

async function main() {
  const updates: { title: string; room: unknown; scene: unknown }[] = [
    { title: 'آشپزخانه مدرن چوبی', room: KITCHEN_ROOM, scene: KITCHEN_SCENE },
    { title: 'اتاق خواب آرام', room: BEDROOM_ROOM, scene: BEDROOM_SCENE },
    { title: 'کمد و اتاق کار', room: OFFICE_ROOM, scene: OFFICE_SCENE },
    { title: 'نشیمن و دیوار تلویزیون', room: LIVING_ROOM, scene: LIVING_SCENE },
  ];
  for (const u of updates) {
    const res = await db.portfolioItem.updateMany({
      where: { title: u.title },
      data: { roomSpec: JSON.stringify(u.room), sceneState: JSON.stringify(u.scene) },
    });
    console.log(res.count, '×', u.title);
  }
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
