import type { RoomSpec, SceneState } from './scene-types';

// Sample space (kitchen) — for a quick start without uploading a photo, and as a fallback
export const SAMPLE_ROOM_SPEC: RoomSpec = {
  widthM: 4.2,
  depthM: 3.4,
  heightM: 2.8,
  wallColor: '#ece7dd',
  floorColor: '#a97c50',
  ceilingColor: '#fafafa',
  windows: [
    { wall: 'back', offsetX: -0.9, sillY: 1.0, width: 1.4, height: 1.3 },
  ],
  doorways: [
    { wall: 'front', offsetX: 1.2, width: 0.95, height: 2.1 },
  ],
};

export const SAMPLE_SCENE: SceneState = {
  objects: [
    // Back row of base cabinets
    { id: 's1', type: 'base', params: { w: 0.8, h: 0.85, d: 0.6, bodyColor: '#6b4f3a', doorColor: '#7d5f45', countertopColor: '#d8d3c8', doors: 2, drawers: 0, handles: 'bar' }, position: [-1.2, 0, -1.35], rotationY: 0, open: false },
    { id: 's2', type: 'base', params: { w: 0.8, h: 0.85, d: 0.6, bodyColor: '#6b4f3a', doorColor: '#7d5f45', countertopColor: '#d8d3c8', doors: 0, drawers: 3, handles: 'bar' }, position: [-0.4, 0, -1.35], rotationY: 0, open: false },
    { id: 's3', type: 'base', params: { w: 0.8, h: 0.85, d: 0.6, bodyColor: '#6b4f3a', doorColor: '#7d5f45', countertopColor: '#d8d3c8', doors: 2, drawers: 0, handles: 'bar' }, position: [0.4, 0, -1.35], rotationY: 0, open: false },
    // Wall cabinets
    { id: 's4', type: 'wall', params: { w: 0.8, h: 0.7, d: 0.35, bodyColor: '#8a6d4f', doorColor: '#9a7c5c', doors: 2, drawers: 0, handles: 'knob', mountY: 1.5 }, position: [-0.8, 1.5, -1.55], rotationY: 0, open: false },
    { id: 's5', type: 'wall', params: { w: 0.8, h: 0.7, d: 0.35, bodyColor: '#8a6d4f', doorColor: '#9a7c5c', doors: 2, drawers: 0, handles: 'knob', mountY: 1.5 }, position: [0, 1.5, -1.55], rotationY: 0, open: false },
    // Tall cabinet
    { id: 's6', type: 'tall', params: { w: 0.6, h: 2.1, d: 0.6, bodyColor: '#4f5d75', doorColor: '#5d6d87', doors: 2, drawers: 0, handles: 'bar' }, position: [1.6, 0, -1.35], rotationY: 0, open: false },
    // Island
    { id: 's7', type: 'island', params: { w: 1.6, h: 0.9, d: 0.9, bodyColor: '#3f4a5a', doorColor: '#48566a', countertopColor: '#e8e4dc', doors: 2, drawers: 2, handles: 'bar' }, position: [0, 0, 0.3], rotationY: 0, open: false },
    // Lights and decor
    { id: 's8', type: 'pendant', label: 'Pendant light', params: { color: '#f59e0b', intensity: 1.4, mountY: 2.3 }, position: [0, 2.3, 0.3], rotationY: 0, on: true },
    { id: 's9', type: 'pendant', label: 'Pendant light', params: { color: '#f59e0b', intensity: 1.4, mountY: 2.3 }, position: [-1.4, 2.3, 0.3], rotationY: 0, on: false },
    { id: 's10', type: 'plant', label: 'Decorative plant', params: { color: '#2e7d32', scale: 1 }, position: [1.7, 0, 1.2], rotationY: 0 },
    { id: 's11', type: 'rug', label: 'Rug', params: { color: '#9c4a3c', scale: 1 }, position: [0, 0, 1.3], rotationY: 0 },
  ],
};
