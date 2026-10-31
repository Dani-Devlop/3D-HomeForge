// Shared portfolio serialization (used by route and [id])
export interface PortfolioRow {
  id: string;
  title: string;
  description: string;
  category: string;
  image: string;
  roomSpec: string;
  sceneState: string;
  visible: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export function parseJsonSafe(v: string | null | undefined): unknown {
  if (!v) return {};
  try {
    return JSON.parse(v);
  } catch {
    return {};
  }
}

export function serializePortfolioItem(it: PortfolioRow) {
  return {
    id: it.id,
    title: it.title,
    description: it.description,
    category: it.category,
    image: it.image,
    // Live 3D model (when roomSpec/sceneState is set)
    roomSpec: parseJsonSafe(it.roomSpec),
    sceneState: parseJsonSafe(it.sceneState),
    visible: it.visible,
    sortOrder: it.sortOrder,
    createdAt: it.createdAt.toISOString(),
    updatedAt: it.updatedAt.toISOString(),
  };
}

// Convert room/scene input to a JSON string for database storage (with a size cap)
export const MAX_SCENE_CHARS = 500_000;

export function stringifyOrEmpty(value: unknown): string {
  if (value === undefined || value === null) return '{}';
  try {
    const s = JSON.stringify(value);
    return s.length <= MAX_SCENE_CHARS ? s : '{}';
  } catch {
    return '{}';
  }
}

/** Does sceneState contain at least one object? (for the "image or live model" validation) */
export function hasSceneObjects(sceneState: unknown): boolean {
  if (!sceneState || typeof sceneState !== 'object') return false;
  const objects = (sceneState as { objects?: unknown }).objects;
  return Array.isArray(objects) && objects.length > 0;
}
