import type { RoomSpec, SceneState, SceneObject, ObjectPatch, ShareRole } from './scene-types';

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
  createdAt: string;
  updatedAt: string;
  shareCount?: number;
}

export interface FolderDTO {
  id: string;
  name: string;
  createdAt: string;
  projectCount?: number;
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
  objects: SceneObject[]; // تجهیزات/کابینت‌های تشخیص داده‌شده از عکس
  description: string;
}

/** خروجی تولید مدل با متن (text-to-3D) */
export interface GeneratedItem {
  type: SceneObject['type'];
  label: string;
  params: SceneObject['params'];
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
  // ---- بازسازی سه‌بعدی از چند عکس / فریم‌های ویدیو ----
  reconstruct: (images: string[]) =>
    request<ReconstructResult>('/api/reconstruct', {
      method: 'POST',
      body: JSON.stringify({ images }),
    }),

  // ---- تولید مدل سه‌بعدی از توصیف متنی (text-to-3D) ----
  generateObject: (text: string) =>
    request<{ item: GeneratedItem }>('/api/ai/cabinet', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  // ---- ویرایش متنی آبجکت انتخاب‌شده ----
  aiEditObject: (object: SceneObject, text: string) =>
    request<{ patch: ObjectPatch }>('/api/ai/edit', {
      method: 'POST',
      body: JSON.stringify({ object, text }),
    }),

  // ---- پوشه‌ها ----
  listFolders: () => request<{ folders: FolderDTO[] }>('/api/folders'),

  createFolder: (name: string) =>
    request<{ folder: FolderDTO }>('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  renameFolder: (id: string, name: string) =>
    request<{ folder: FolderDTO }>(`/api/folders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  deleteFolder: (id: string) =>
    request<{ ok: boolean }>(`/api/folders/${id}`, { method: 'DELETE' }),

  listProjects: (folderId?: string | null) =>
    request<{ projects: ProjectDTO[] }>(
      folderId === undefined
        ? '/api/projects'
        : `/api/projects?folderId=${folderId === null ? 'none' : folderId}`
    ),

  createProject: (p: {
    name: string;
    roomType?: string;
    roomSpec: RoomSpec;
    sceneState?: SceneState;
    folderId?: string | null;
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
      isPublic?: boolean;
      folderId?: string | null;
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
