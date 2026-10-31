import type { RoomSpec, SceneState, SceneObject, ObjectPatch, ShareRole } from './scene-types';
import type { ProjectStage } from './crm';
import { demoApi } from './demo/backend';

// ---------------- DTOs ----------------

export interface ProjectDTO {
  id: string;
  name: string;
  roomType: string;
  roomSpec: RoomSpec | Record<string, never>;
  sceneState: SceneState | Record<string, never>;
  thumbnail: string | null;
  isPublic: boolean;
  folderId: string | null;
  folderName: string | null;
  // CRM — client details, progress stage and deal info (ISO or null)
  clientName?: string | null;
  clientPhone?: string | null;
  address?: string | null;
  stage?: ProjectStage;
  dealAt?: string | null;
  contractAmount?: number | null;
  contractPhoto?: string | null;
  invoicePhoto?: string | null;
  visitAt?: string | null;
  installAt?: string | null;
  dueAt?: string | null;
  createdAt: string;
  updatedAt: string;
  shareCount?: number;
}

/** CRM fields sent when creating/updating a project (dates ISO or '' to clear) */
export interface ProjectCrmFields {
  clientName?: string | null;
  clientPhone?: string | null;
  address?: string | null;
  stage?: ProjectStage;
  dealAt?: string | null;
  contractAmount?: number | null;
  contractPhoto?: string | null;
  invoicePhoto?: string | null;
  visitAt?: string | null;
  installAt?: string | null;
  dueAt?: string | null;
}

export interface FolderDTO {
  id: string;
  name: string;
  phone?: string | null;
  createdAt: string;
  projectCount?: number;
}

export interface ShareLinkDTO {
  id: string;
  token: string;
  shortCode?: string | null;
  role: ShareRole;
  active: boolean;
  expiresAt: string;
  guestCount?: number;
  createdAt: string;
}

export interface GuestDTO {
  id: string;
  name: string;
  color: string;
  role: ShareRole;
  createdAt?: string;
  shareLinkId?: string;
}

export interface PresetDTO {
  id: string;
  name: string;
  data: Partial<SceneObject>[];
  createdAt: string;
}

export interface ReconstructResult {
  roomSpec: RoomSpec;
  roomType: string;
  objects: SceneObject[]; // appliances/cabinets detected from the photo
  description: string;
}

/** Progress event of a streaming reconstruction (NDJSON) */
export interface ReconstructProgress {
  stage: string; // 'floorplan' | 'analyze' | 'merge'
  index?: number;
  total?: number;
  message: string;
}

/** Admin dashboard stats */
export interface AdminStatsDTO {
  stats: {
    projects: number;
    folders: number;
    guests: number;
    shareLinks: number;
    activeShareLinks: number;
    publicProjects: number;
  };
  roomTypes: Record<string, number>;
  recentGuests: {
    id: string;
    name: string;
    role: ShareRole;
    color: string;
    projectName: string | null;
    lastSeenAt: string;
  }[];
  upcoming: {
    id: string;
    name: string;
    clientName: string | null;
    clientPhone: string | null;
    visitAt: string | null;
    installAt: string | null;
    dueAt: string | null;
  }[];
}

/** Text-to-3D model generation result */
export interface GeneratedItem {
  type: SceneObject['type'];
  label: string;
  params: SceneObject['params'];
}

/** Full-space design result from a text description (text-to-room) */
export interface GeneratedRoom {
  roomType: string;
  roomSpec: RoomSpec;
  objects: SceneObject[];
  description: string;
}

/** Public landing-page portfolio item — image or live 3D model */
export interface PortfolioItemDTO {
  id: string;
  title: string;
  description: string;
  category: string;
  image: string;
  /** Room spec — if valid, the card is rendered as a live 3D model */
  roomSpec: Partial<RoomSpec> | Record<string, never>;
  /** Live scene objects */
  sceneState: { objects?: SceneObject[] } | Record<string, never>;
  visible: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioItemInput {
  title: string;
  description?: string;
  category?: string;
  image?: string;
  /** JSON payload sent to the server (validated server-side) */
  roomSpec?: unknown;
  sceneState?: unknown;
  visible?: boolean;
  sortOrder?: number;
}

// ---------------- fetch helpers ----------------

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
  } catch {
    throw new Error('Could not reach the server');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (body as { error?: string; ok?: boolean }).error ||
      (res.status === 403 ? 'Invalid access' : 'Unknown error');
    throw Object.assign(new Error(msg), { status: res.status, body });
  }
  return body as T;
}

/** Read the NDJSON reconstruction response with live progress events */
async function streamReconstruct(
  images: string[],
  floorPlan: string | null | undefined,
  onProgress?: (p: ReconstructProgress) => void,
): Promise<ReconstructResult> {
  let res: Response;
  try {
    res = await fetch('/api/reconstruct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
      body: JSON.stringify({ images, ...(floorPlan ? { floorPlan } : {}) }),
    });
  } catch {
    throw new Error('Could not reach the server');
  }

  // HTTP error before the stream starts — the response is JSON
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as { error?: string }).error || 'Unknown error';
    throw Object.assign(new Error(msg), { status: res.status, body });
  }
  if (!res.body) {
    throw new Error('Browser does not support streaming responses');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;

      let evt: Record<string, unknown>;
      try {
        evt = JSON.parse(line);
      } catch {
        continue; // incomplete/invalid line — skip
      }

      if (evt.type === 'progress') {
        onProgress?.({
          stage: typeof evt.stage === 'string' ? evt.stage : '',
          index: typeof evt.index === 'number' ? evt.index : undefined,
          total: typeof evt.total === 'number' ? evt.total : undefined,
          message: typeof evt.message === 'string' ? evt.message : '',
        });
      } else if (evt.type === 'result') {
        try {
          await reader.cancel();
        } catch {
          // stream already ended
        }
        return evt as unknown as ReconstructResult;
      } else if (evt.type === 'error') {
        throw new Error(
          typeof evt.error === 'string' ? evt.error : 'AI reconstruction failed',
        );
      }
    }
  }
  throw new Error('Received an incomplete response from the server');
}

// ---------------- API ----------------

const fetchApi = {
  // ---- Admin authentication ----
  login: (password: string) =>
    request<{ ok: boolean }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  session: () => request<{ authed: boolean }>('/api/auth/session'),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>('/api/auth/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  // ---- Admin dashboard stats ----
  adminStats: () => request<AdminStatsDTO>('/api/admin/stats'),

  // ---- Public landing-page portfolio ----
  listPortfolio: (all?: boolean) =>
    request<{ items: PortfolioItemDTO[] }>(`/api/portfolio${all ? '?all=1' : ''}`),

  /** Read one portfolio item (to edit its 3D model in the editor) */
  getPortfolioItem: (id: string) =>
    request<{ item: PortfolioItemDTO }>(`/api/portfolio/${id}`),

  createPortfolioItem: (p: PortfolioItemInput) =>
    request<{ item: PortfolioItemDTO }>('/api/portfolio', {
      method: 'POST',
      body: JSON.stringify(p),
    }),

  updatePortfolioItem: (id: string, patch: Partial<PortfolioItemInput>) =>
    request<{ item: PortfolioItemDTO }>(`/api/portfolio/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deletePortfolioItem: (id: string) =>
    request<{ ok: boolean }>(`/api/portfolio/${id}`, { method: 'DELETE' }),

  // ---- 3D reconstruction from multiple photos / video frames ----
  // JSON mode (compatible with v2) — no live progress
  reconstruct: (images: string[]) =>
    request<ReconstructResult>('/api/reconstruct', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: JSON.stringify({ images }),
    }),

  // Streaming NDJSON mode with progress events (frontend default)
  reconstructStream: (
    images: string[],
    floorPlan: string | null | undefined,
    onProgress?: (p: ReconstructProgress) => void,
  ) => streamReconstruct(images, floorPlan, onProgress),

  // ---- Generate a 3D model from a text description (text-to-3D) ----
  generateObject: (text: string) =>
    request<{ item: GeneratedItem }>('/api/ai/cabinet', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  // ---- Design a full space from a text description (text-to-room) ----
  generateRoom: (text: string) =>
    request<GeneratedRoom>('/api/ai/room', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  // ---- Text-based editing of the selected object ----
  aiEditObject: (object: SceneObject, text: string) =>
    request<{ patch: ObjectPatch }>('/api/ai/edit', {
      method: 'POST',
      body: JSON.stringify({ object, text }),
    }),

  // ---- Client folders ----
  listFolders: () => request<{ folders: FolderDTO[] }>('/api/folders'),

  /** Create a client folder — returns the existing one if a name matches (existed: true) */
  createFolder: (name: string, phone?: string) =>
    request<{ folder: FolderDTO; existed?: boolean }>('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ name, ...(phone ? { phone } : {}) }),
    }),

  renameFolder: (id: string, name: string) =>
    request<{ folder: FolderDTO }>(`/api/folders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  deleteFolder: (id: string) =>
    request<{ ok: boolean }>(`/api/folders/${id}`, { method: 'DELETE' }),

  listProjects: (folderId?: string | null, q?: string) => {
    const params = new URLSearchParams();
    if (folderId !== undefined) {
      params.set('folderId', folderId === null ? 'none' : folderId);
    }
    if (q && q.trim()) params.set('q', q.trim());
    const qs = params.toString();
    return request<{ projects: ProjectDTO[] }>(`/api/projects${qs ? `?${qs}` : ''}`);
  },

  createProject: (p: {
    name: string;
    roomType?: string;
    roomSpec: RoomSpec;
    sceneState?: SceneState;
    folderId?: string | null;
  } & ProjectCrmFields) =>
    request<{ project: ProjectDTO }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(p),
    }),

  getProject: (id: string) =>
    request<{ project: ProjectDTO }>(`/api/projects/${id}`),

  patchProject: (
    id: string,
    patch: {
      name?: string;
      roomType?: string;
      roomSpec?: RoomSpec;
      sceneState?: SceneState;
      thumbnail?: string | null;
      isPublic?: boolean;
      folderId?: string | null;
    } & ProjectCrmFields
  ) =>
    request<{ project: ProjectDTO }>(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteProject: (id: string) =>
    request<{ ok: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),

  projectGuests: (id: string) =>
    request<{ guests: GuestDTO[] }>(`/api/projects/${id}/guests`),

  // ---- Editor guest autosave ----
  saveAsGuest: (p: { token: string; guestId: string; sceneState: SceneState }) =>
    request<{ ok: boolean; updatedAt: string }>('/api/share/save', {
      method: 'POST',
      body: JSON.stringify(p),
    }),

  createShareLink: (p: {
    projectId: string;
    role?: ShareRole;
    expiresInDays?: number;
  }) =>
    request<{ link: ShareLinkDTO }>('/api/share', {
      method: 'POST',
      body: JSON.stringify(p),
    }),

  listShareLinks: (projectId: string) =>
    request<{ links: ShareLinkDTO[] }>(`/api/share?projectId=${projectId}`),

  patchShareLink: (p: { id: string; active?: boolean; role?: ShareRole }) =>
    request<{ link: ShareLinkDTO }>('/api/share', {
      method: 'PATCH',
      body: JSON.stringify(p),
    }),

  resolveShare: (token: string) =>
    request<{
      ok: boolean;
      project: {
        id: string;
        name: string;
        roomType: string;
        roomSpec: RoomSpec;
        sceneState: SceneState;
      };
      link: { id: string; role: ShareRole; expiresAt: string };
    }>(
      `/api/share/resolve?token=${encodeURIComponent(token)}`
    ),

  registerGuest: (p: { token: string; name: string }) =>
    request<{ guest: GuestDTO }>('/api/guests', {
      method: 'POST',
      body: JSON.stringify(p),
    }),

  getGuest: (id: string) => request<{ guest: GuestDTO }>(`/api/guests/${id}`),

  patchGuest: (id: string, role: ShareRole) =>
    request<{ guest: GuestDTO }>(`/api/guests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  listPresets: () => request<{ presets: PresetDTO[] }>('/api/presets'),

  createPreset: (p: { name: string; data: Partial<SceneObject>[] }) =>
    request<{ preset: PresetDTO }>('/api/presets', {
      method: 'POST',
      body: JSON.stringify(p),
    }),

  deletePreset: (id: string) =>
    request<{ ok: boolean }>(`/api/presets?id=${id}`, { method: 'DELETE' }),
};

/**
 * In static demo builds (NEXT_PUBLIC_DEMO_MODE=1, used for GitHub Pages)
 * every call is served by a localStorage-backed backend instead of fetch.
 */
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === '1';

export const api: typeof fetchApi = DEMO_MODE ? demoApi : fetchApi;
