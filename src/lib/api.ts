import type { RoomSpec, SceneState, SceneObject, ObjectPatch, ShareRole } from './scene-types';
import type { ProjectStage } from './crm';

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
  // CRM — مشخصات مشتری، مرحله پیشرفت و مذاکره (ISO یا null)
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

/** فیلدهای CRM قابل ارسال در ساخت/ویرایش پروژه (تاریخ‌ها ISO یا '' برای پاک‌کردن) */
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

/** رویداد پیشرفت بازسازی استریمی (NDJSON) */
export interface ReconstructProgress {
  stage: string; // 'floorplan' | 'analyze' | 'merge'
  index?: number;
  total?: number;
  message: string;
}

/** آمار پنل مدیریت */
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

/** خروجی تولید مدل با متن (text-to-3D) */
export interface GeneratedItem {
  type: SceneObject['type'];
  label: string;
  params: SceneObject['params'];
}

/** خروجی طراحی کل فضا با توصیف متنی (text-to-room) */
export interface GeneratedRoom {
  roomType: string;
  roomSpec: RoomSpec;
  objects: SceneObject[];
  description: string;
}

/** نمونه‌کار صفحه عمومی (لندینگ) — تصویر یا مدل سه‌بعدی زنده */
export interface PortfolioItemDTO {
  id: string;
  title: string;
  description: string;
  category: string;
  image: string;
  /** مشخصات فضا — اگر معتبر باشد کارت به‌صورت مدل سه‌بعدی زنده نمایش داده می‌شود */
  roomSpec: Partial<RoomSpec> | Record<string, never>;
  /** آبجکت‌های صحنه زنده */
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
  /** JSON ارسالی به سرور (اعتبارسنجی سمت سرور انجام می‌شود) */
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

/** خواندن پاسخ NDJSON بازسازی با رویدادهای پیشرفت زنده */
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
    throw new Error('خطا در ارتباط با سرور');
  }

  // خطای HTTP قبل از شروع استریم — پاسخ JSON است
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as { error?: string }).error || 'خطای ناشناخته';
    throw Object.assign(new Error(msg), { status: res.status, body });
  }
  if (!res.body) {
    throw new Error('مرورگر از پاسخ جریانی پشتیبانی نمی‌کند');
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
        continue; // خط ناقص/نامعتبر — نادیده
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
          // استریم تمام شده است
        }
        return evt as unknown as ReconstructResult;
      } else if (evt.type === 'error') {
        throw new Error(
          typeof evt.error === 'string' ? evt.error : 'بازسازی با هوش مصنوعی ناموفق بود',
        );
      }
    }
  }
  throw new Error('پاسخ ناقص از سرور دریافت شد');
}

// ---------------- API ----------------

export const api = {
  // ---- احراز هویت مدیر ----
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

  // ---- آمار پنل مدیریت ----
  adminStats: () => request<AdminStatsDTO>('/api/admin/stats'),

  // ---- نمونه‌کارهای صفحه عمومی ----
  listPortfolio: (all?: boolean) =>
    request<{ items: PortfolioItemDTO[] }>(`/api/portfolio${all ? '?all=1' : ''}`),

  /** خواندن یک نمونه‌کار (برای ویرایش مدل سه‌بعدی در ویرایشگر) */
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

  // ---- بازسازی سه‌بعدی از چند عکس / فریم‌های ویدیو ----
  // حالت JSON (سازگار با نسخه ۲) — بدون پیشرفت زنده
  reconstruct: (images: string[]) =>
    request<ReconstructResult>('/api/reconstruct', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: JSON.stringify({ images }),
    }),

  // حالت استریم NDJSON با رویدادهای پیشرفت (پیش‌فرض فرانت)
  reconstructStream: (
    images: string[],
    floorPlan: string | null | undefined,
    onProgress?: (p: ReconstructProgress) => void,
  ) => streamReconstruct(images, floorPlan, onProgress),

  // ---- تولید مدل سه‌بعدی از توصیف متنی (text-to-3D) ----
  generateObject: (text: string) =>
    request<{ item: GeneratedItem }>('/api/ai/cabinet', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  // ---- طراحی کامل فضا از توصیف متنی (text-to-room) ----
  generateRoom: (text: string) =>
    request<GeneratedRoom>('/api/ai/room', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  // ---- ویرایش متنی آبجکت انتخاب‌شده ----
  aiEditObject: (object: SceneObject, text: string) =>
    request<{ patch: ObjectPatch }>('/api/ai/edit', {
      method: 'POST',
      body: JSON.stringify({ object, text }),
    }),

  // ---- پوشه‌های مشتری ----
  listFolders: () => request<{ folders: FolderDTO[] }>('/api/folders'),

  /** ساخت پوشه مشتری — اگر پوشه‌ای با همان نام موجود باشد همان برمی‌گردد (existed: true) */
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

  // ---- ذخیره خودکار مهمان ویرایشگر ----
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
