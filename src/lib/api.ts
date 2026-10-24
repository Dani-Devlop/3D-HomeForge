import type { RoomSpec, SceneState, SceneObject, ShareRole } from './scene-types';

// ---------------- DTOs ----------------

export interface ProjectDTO {
  id: string;
  name: string;
  roomType: string;
  roomSpec: RoomSpec | Record<string, never>;
  sceneState: SceneState | Record<string, never>;
  thumbnail: string | null;
  createdAt: string;
  updatedAt: string;
  shareCount?: number;
}

export interface ShareLinkDTO {
  id: string;
  token: string;
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
  description: string;
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
    throw new Error('خطا در ارتباط با سرور');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (body as { error?: string; ok?: boolean }).error ||
      (res.status === 403 ? 'دسترسی نامعتبر است' : 'خطای ناشناخته');
    throw Object.assign(new Error(msg), { status: res.status, body });
  }
  return body as T;
}

// ---------------- API ----------------

export const api = {
  reconstruct: (image: string) =>
    request<ReconstructResult>('/api/reconstruct', {
      method: 'POST',
      body: JSON.stringify({ image }),
    }),

  listProjects: () => request<{ projects: ProjectDTO[] }>('/api/projects'),

  createProject: (p: {
    name: string;
    roomType?: string;
    roomSpec: RoomSpec;
    sceneState?: SceneState;
  }) =>
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
    }
  ) =>
    request<{ project: ProjectDTO }>(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteProject: (id: string) =>
    request<{ ok: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),

  projectGuests: (id: string) =>
    request<{ guests: GuestDTO[] }>(`/api/projects/${id}/guests`),

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
