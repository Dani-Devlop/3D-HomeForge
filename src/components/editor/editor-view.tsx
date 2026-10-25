'use client';

import * as THREE from 'three';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  Download,
  Grid3x3,
  LampCeiling,
  Loader2,
  Lock,
  Magnet,
  PencilRuler,
  Redo2,
  Send,
  Sparkles,
  Undo2,
} from 'lucide-react';
import { api, type PortfolioItemDTO, type ProjectDTO } from '@/lib/api';
import type { ObjectPatch, SceneObject, CatalogItem, RoomSpec } from '@/lib/scene-types';
import { ensureObjectIds } from '@/lib/scene-types';
import { clampPositionToRoom } from '@/lib/polygon';
import { exportGroupToGLB } from '@/lib/export-glb';
import {
  catalogDefaults,
  findFreeSpot,
  uid,
  useEditorStore,
} from '@/store/editor-store';
import { isWallSnapType, snapNewObject } from '@/components/three/wall-snap';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EditorScene from '@/components/three/editor-scene';
import { LibraryPanel } from './library-panel';
import { PropertiesPanel } from './properties-panel';
import { PresetsPanel } from './presets-panel';
import { RoomPlanPanel } from './room-plan-panel';
import { ShareDialog } from './share-dialog';
import { MovePad } from './move-pad';

/** تشخیص تایپ‌کردن در فیلدهای متنی — کلیدهای جهت‌نما نباید صحنه را حرکت دهند */
function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/** کارت ورود مجدد وقتی نشست مدیر منقضی شده (401) */
function OwnerLoginInline({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!pw || busy) return;
    setBusy(true);
    try {
      await api.login(pw);
      onDone();
    } catch (e) {
      toast({
        title: 'ورود ناموفق',
        description: (e as Error).message || 'رمز مدیر اشتباه است',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-stone-50 p-6">
      <Card className="w-full max-w-sm shadow-xl">
        <CardContent className="p-8 space-y-5 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-bold">ورود مدیر</h1>
            <p className="text-sm text-muted-foreground">نشست شما منقضی شده — برای ادامه رمز را وارد کنید</p>
          </div>
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="رمز مدیر"
            autoFocus
            className="h-11 text-center"
            aria-label="رمز مدیر"
          />
          <Button className="w-full h-11" onClick={submit} disabled={!pw || busy}>
            {busy ? 'در حال ورود...' : 'ورود'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function EditorView({ projectId, portfolioId }: { projectId?: string; portfolioId?: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const projectQ = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.getProject(projectId!),
    enabled: !!projectId,
    retry: 1,
  });

  // حالت ویرایش مدل نمونه‌کار (/editor/pf/:id) — بارگذاری و ذخیره روی نمونه‌کار
  const pfQ = useQuery({
    queryKey: ['portfolio-item', portfolioId],
    queryFn: () => api.getPortfolioItem(portfolioId!),
    enabled: !!portfolioId,
    retry: 1,
  });

  // ---- store bindings ----
  const roomSpec = useEditorStore((s) => s.roomSpec);
  const objects = useEditorStore((s) => s.objects);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const projectName = useEditorStore((s) => s.projectName);
  const dirty = useEditorStore((s) => s.dirty);
  const pastLen = useEditorStore((s) => s.past.length);
  const futureLen = useEditorStore((s) => s.future.length);
  const store = useEditorStore;

  const refsMap = useRef<Map<string, THREE.Group>>(new Map());
  const glRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRootRef = useRef<THREE.Group | null>(null);
  const placeRequestRef = useRef<((sx: number, sy: number) => void) | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [dropActive, setDropActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiEditing, setAiEditing] = useState(false);
  const [wallSnapEnabled, setWallSnapEnabled] = useState(true);
  const [textGenOpen, setTextGenOpen] = useState(false);
  const [textDraft, setTextDraft] = useState('');
  const [roomBusy, setRoomBusy] = useState(false);

  // بارگذاری پروژه یا نمونه‌کار در استور
  const sourceData = projectId ? projectQ.data?.project : pfQ.data?.item;
  useEffect(() => {
    if (loaded || !sourceData) return;
    const spec =
      sourceData.roomSpec && 'widthM' in sourceData.roomSpec
        ? (sourceData.roomSpec as RoomSpec)
        : roomSpec;
    const objs: SceneObject[] = ensureObjectIds(
      sourceData.sceneState && 'objects' in sourceData.sceneState && Array.isArray(sourceData.sceneState.objects)
        ? (sourceData.sceneState.objects as SceneObject[])
        : [],
    );
    const name = projectId ? (sourceData as ProjectDTO).name : (sourceData as PortfolioItemDTO).title;
    store.getState().loadProject(sourceData.id, name, spec, objs);
    setLoaded(true);
  }, [sourceData, projectId, loaded, store, roomSpec]);

  // ---- ذخیره خودکار (پروژه یا نمونه‌کار) ----
  const saveProject = useCallback(
    async (withThumb: boolean) => {
      const s = store.getState();
      try {
        setSaving(true);
        let thumbnail: string | null | undefined;
        if (withThumb && glRef.current && sceneRootRef.current) {
          try {
            thumbnail = glRef.current.domElement.toDataURL('image/jpeg', portfolioId ? 0.6 : 0.55);
          } catch {
            thumbnail = undefined;
          }
        }
        if (portfolioId) {
          // ذخیره روی نمونه‌کار — مدل زنده + تازه‌شدن عکس fallback
          await api.updatePortfolioItem(portfolioId, {
            roomSpec: s.roomSpec,
            sceneState: { objects: s.objects },
            ...(thumbnail ? { image: thumbnail } : {}),
          });
        } else {
          if (!s.projectId) return;
          await api.patchProject(s.projectId, {
            name: s.projectName,
            roomSpec: s.roomSpec,
            sceneState: { objects: s.objects },
            ...(thumbnail !== undefined ? { thumbnail } : {}),
          });
        }
        store.getState().markSaved();
      } catch (e) {
        // خطای ذخیره بی‌صدا برای جلوگیری از اسپم
        console.error('save failed', e);
      } finally {
        setSaving(false);
      }
    },
    [store, portfolioId],
  );

  useEffect(() => {
    if (!dirty || !loaded) return;
    const t = setTimeout(() => saveProject(true), 1400);
    return () => clearTimeout(t);
  }, [dirty, objects, projectName, loaded, saveProject]);

  // نام پروژه → عنوان مرورگر
  useEffect(() => {
    document.title = `${projectName} | ویرایشگر کابینت`;
  }, [projectName]);

  // ---- Drag & Drop از کتابخانه ----
  const handlePlace = useCallback(
    (x: number, z: number) => {
      const drop = pendingDrop.current;
      if (!drop) return;
      pendingDrop.current = null;
      const s = store.getState();
      const [cx, , cz] = clampPositionToRoom(s.roomSpec, [x, 0, z]);
      if (isWallSnapType(drop.type)) {
        // آبجکت دیواری → روی نزدیک‌ترین دیوار می‌نشیند (چسبیده و رو به داخل)
        const params = catalogDefaults(drop.type, drop.label).params;
        const snapped = snapNewObject(s.roomSpec, drop.type, cx, cz, params);
        s.addObject(drop.type, [snapped.x, 0, snapped.z], drop.label, snapped.rotationY);
      } else {
        s.addObject(drop.type, [cx, 0, cz], drop.label);
      }
    },
    [store],
  );

  const pendingDrop = useRef<{ type: SceneObject['type']; label?: string } | null>(null);

  // ---- افزودن با کلیک ----
  const addFromCatalog = (item: CatalogItem) => {
    const s = store.getState();
    const [x, z] = findFreeSpot(s.objects, item.type, s.roomSpec);
    if (isWallSnapType(item.type)) {
      const snapped = snapNewObject(s.roomSpec, item.type, x, z, item.defaults);
      s.addObject(item.type, [snapped.x, 0, snapped.z], item.label, snapped.rotationY);
    } else {
      s.addObject(item.type, [x, 0, z], item.label);
    }
    toast({ title: `${item.label} اضافه شد`, description: 'با کشیدن گیزموت جابه‌جا کنید' });
  };

  // ---- تولید مدل با توصیف متنی (text-to-3D) ----
  const generateFromText = async (text: string): Promise<boolean> => {
    try {
      setGenerating(true);
      const { item } = await api.generateObject(text);
      const s = store.getState();
      const [x, z] = findFreeSpot(s.objects, item.type, s.roomSpec);
      s.addGenerated(item.type, item.label, item.params, [x, 0, z]);
      toast({
        title: `«${item.label}» ساخته شد ✓`,
        description: 'مدل پارامتریک به صحنه اضافه شد — با پنل کناری تنظیمش کنید',
      });
      return true;
    } catch (e) {
      toast({
        title: 'تولید مدل ناموفق بود',
        description: e instanceof Error ? e.message : 'دوباره تلاش کنید',
        variant: 'destructive',
      });
      return false;
    } finally {
      setGenerating(false);
    }
  };

  // ---- طراحی کامل فضا با توصیف متنی (text-to-room) — جایگزینی صحنه ----
  const generateWholeRoom = async (text: string): Promise<boolean> => {
    try {
      setRoomBusy(true);
      const result = await api.generateRoom(text);
      store.getState().replaceScene(result.roomSpec, result.objects);
      toast({
        title: 'فضای جدید ساخته شد ✓',
        description: `${result.objects.length} آبجکت در فضا جای‌گذاری شد — با Ctrl+Z به حالت قبل برگردید`,
      });
      return true;
    } catch (e) {
      toast({
        title: 'طراحی فضا ناموفق بود',
        description: e instanceof Error ? e.message : 'دوباره تلاش کنید',
        variant: 'destructive',
      });
      return false;
    } finally {
      setRoomBusy(false);
    }
  };

  const submitTextGen = async (mode: 'piece' | 'room') => {
    const text = textDraft.trim();
    if (!text || generating || roomBusy) return;
    const ok = mode === 'piece' ? await generateFromText(text) : await generateWholeRoom(text);
    if (ok) {
      setTextGenOpen(false);
      setTextDraft('');
    }
  };

  // ---- ویرایش متنی آبجکت انتخاب‌شده ----
  const applyAiPatch = (id: string, patch: ObjectPatch) => {
    const s = store.getState();
    s.beginAction();
    const target = s.objects.find((o) => o.id === id);
    if (!target) return;
    const pos = target.position;
    const nextPosition: [number, number, number] = patch.positionDelta
      ? clampPositionToRoom(
          s.roomSpec,
          [
            pos[0] + patch.positionDelta[0],
            THREE.MathUtils.clamp(pos[1] + patch.positionDelta[1], 0, s.roomSpec.heightM),
            pos[2] + patch.positionDelta[2],
          ],
        )
      : pos;
    s.updateObject(id, {
      position: nextPosition,
      ...(patch.rotationYDelta !== undefined
        ? { rotationY: target.rotationY + patch.rotationYDelta }
        : {}),
      ...(patch.params ? { params: { ...target.params, ...patch.params } } : {}),
      ...(patch.label ? { label: patch.label } : {}),
      ...(patch.open !== undefined ? { open: patch.open } : {}),
      ...(patch.on !== undefined ? { on: patch.on } : {}),
    });
  };

  const aiEditSelected = async (text: string) => {
    const s = store.getState();
    const target = s.objects.find((o) => o.id === selectedIds[selectedIds.length - 1]);
    if (!target) return;
    try {
      setAiEditing(true);
      const { patch } = await api.aiEditObject(target, text);
      applyAiPatch(target.id, patch);
      toast({ title: 'تغییر اعمال شد ✓', description: 'با Ctrl+Z قابل بازگشت است' });
    } catch (e) {
      toast({
        title: 'اعمال تغییر ناموفق بود',
        description: e instanceof Error ? e.message : 'دوباره تلاش کنید',
        variant: 'destructive',
      });
    } finally {
      setAiEditing(false);
    }
  };

  // ---- Undo/Redo کیبورد ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        store.getState().undo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        store.getState().redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  // ---- جابه‌جایی آبجکت انتخاب‌شده با کیبورد (جهت‌نما/ارتفاع/چرخش) ----
  const nudgeRef = useRef<((d: [number, number, number], firstOfBurst: boolean) => void) | null>(null);
  nudgeRef.current = (d, firstOfBurst) => {
    const s = store.getState();
    const id = s.selectedIds[s.selectedIds.length - 1];
    const target = s.objects.find((o) => o.id === id);
    if (!target) return;
    if (firstOfBurst) s.beginAction();
    const next = clampPositionToRoom(
      s.roomSpec,
      [
        target.position[0] + d[0],
        THREE.MathUtils.clamp(target.position[1] + d[1], 0, s.roomSpec.heightM),
        target.position[2] + d[2],
      ],
    );
    s.updateObject(id, { position: next });
  };

  const rotateRef = useRef<((deltaRad: number, firstOfBurst: boolean) => void) | null>(null);
  rotateRef.current = (deltaRad, firstOfBurst) => {
    const s = store.getState();
    const id = s.selectedIds[s.selectedIds.length - 1];
    const target = s.objects.find((o) => o.id === id);
    if (!target) return;
    if (firstOfBurst) s.beginAction();
    s.updateObject(id, { rotationY: target.rotationY + deltaRad });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const step = e.shiftKey ? 0.25 : 0.05;
      let d: [number, number, number] | null = null;
      let rot = 0;
      switch (e.key) {
        case 'ArrowUp': d = [0, 0, -step]; break;
        case 'ArrowDown': d = [0, 0, step]; break;
        case 'ArrowLeft': d = [-step, 0, 0]; break;
        case 'ArrowRight': d = [step, 0, 0]; break;
        case 'PageUp': d = [0, step, 0]; break;
        case 'PageDown': d = [0, -step, 0]; break;
        case 'q': case 'Q': rot = -Math.PI / 4; break;
        case 'e': case 'E': rot = Math.PI / 4; break;
        default: return;
      }
      e.preventDefault(); // جهت‌نما/PageUp صفحه را اسکرول نکند
      if (d) nudgeRef.current?.(d, !e.repeat);
      else rotateRef.current?.(rot, !e.repeat);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---- پد حرکت: یک beginAction برای هر نگه‌داشتن (نه هر تیک تکرار) ----
  const lastHoldRef = useRef(0);
  const holdNudge = (d: [number, number, number]) => {
    const now = Date.now();
    nudgeRef.current?.(d, now - lastHoldRef.current > 400);
    lastHoldRef.current = now;
  };
  const holdRotate = (r: number) => {
    const now = Date.now();
    rotateRef.current?.(r, now - lastHoldRef.current > 400);
    lastHoldRef.current = now;
  };

  // ---- خروجی GLB ----
  const exportGLB = async () => {
    if (!sceneRootRef.current) return;
    try {
      setExporting(true);
      await exportGroupToGLB(sceneRootRef.current, `${projectName || 'cabinet'}.glb`);
      toast({ title: 'فایل GLB دانلود شد ✓', description: 'فرمت استاندارد glTF دودویی' });
    } catch (e) {
      console.error(e);
      toast({ title: 'خطا در ساخت فایل GLB', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  // ---- پریست‌ها ----
  const insertPreset = (data: Partial<SceneObject>[]) => {
    const s = store.getState();
    // کمترین فاصله تا دیوارها → وسط صحنه آزاد
    const spot = findFreeSpot(s.objects, 'island', s.roomSpec);
    const objs: SceneObject[] = [];
    for (const o of data) {
      if (!o.type) continue;
      objs.push({
        ...o,
        type: o.type,
        id: uid(),
        label: o.label,
        params: o.params ?? {},
        rotationY: o.rotationY ?? 0,
        position: [
          spot[0] + (o.position?.[0] ?? 0),
          o.position?.[1] ?? 0,
          spot[1] + (o.position?.[2] ?? 0),
        ] as [number, number, number],
        open: false,
      });
    }
    s.addObjects(objs);
    toast({ title: 'پریست به صحنه اضافه شد ✓' });
  };

  // ---- چراغ‌ها برای چیپ‌های کنترل ----
  const lights = useMemo(
    () => objects.filter((o) => o.type === 'pendant' || o.type === 'floor-lamp'),
    [objects]
  );

  const primary =
    selectedIds.length > 0
      ? objects.find((o) => o.id === selectedIds[selectedIds.length - 1])
      : undefined;

  const renameProject = useMutation({
    mutationFn: async (name: string) => {
      if (portfolioId) {
        await api.updatePortfolioItem(portfolioId, { title: name });
        return;
      }
      await api.patchProject(projectId!, { name });
    },
    onSuccess: () => {
      if (portfolioId) qc.invalidateQueries({ queryKey: ['portfolio-item', portfolioId] });
      else {
        qc.invalidateQueries({ queryKey: ['project', projectId] });
        qc.invalidateQueries({ queryKey: ['projects'] });
      }
    },
  });

  if (projectQ.isLoading || pfQ.isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const loadError = projectId ? projectQ.error : pfQ.error;
  const hasLoadError = projectId ? projectQ.isError : pfQ.isError;

  // نشست منقضی — کارت ورود مجدد
  if (hasLoadError && (loadError as Error & { status?: number }).status === 401) {
    return (
      <OwnerLoginInline
        onDone={() => {
          qc.invalidateQueries({ queryKey: ['project', projectId] });
          qc.invalidateQueries({ queryKey: ['portfolio-item', portfolioId] });
          qc.invalidateQueries({ queryKey: ['projects'] });
        }}
      />
    );
  }

  if (hasLoadError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold">{portfolioId ? 'نمونه‌کار پیدا نشد' : 'پروژه پیدا نشد'}</p>
        <p className="text-sm text-muted-foreground">{(loadError as Error).message}</p>
        <Button onClick={() => (window.location.hash = '')} variant="outline" className="gap-2">
          <ArrowRight className="h-4 w-4" /> بازگشت به خانه
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-stone-100 overflow-hidden">
      {/* ---------- نوار بالا ---------- */}
      <header className="shrink-0 bg-card border-b px-3 py-2 flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => (window.location.hash = '')}
          className="gap-1.5"
          aria-label="بازگشت"
        >
          <ArrowRight className="h-4 w-4" />
          <span className="hidden sm:inline">خانه</span>
        </Button>

        <Input
          value={projectName}
          onChange={(e) => store.getState().setProjectName(e.target.value)}
          onBlur={(e) => {
            const name = e.target.value.trim();
            if (name) renameProject.mutate(name);
          }}
          className="h-9 w-44 sm:w-56 font-semibold"
          aria-label={portfolioId ? 'عنوان نمونه‌کار' : 'نام پروژه'}
        />

        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => store.getState().undo()}
            disabled={pastLen === 0}
            title="واگرد (Ctrl+Z)"
            aria-label="واگرد"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => store.getState().redo()}
            disabled={futureLen === 0}
            title="ازنو (Ctrl+Shift+Z)"
            aria-label="ازنو"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setPlanOpen(true)}
            title="ویرایش پلان اتاق (دیوار کج / گوشه اضافه)"
            aria-label="ویرایش پلان اتاق"
          >
            <PencilRuler className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setWallSnapEnabled((v) => !v)}
            title="چسبیدن کابینت به دیوار (با نگه‌داشتن Alt موقتاً آزاد)"
            aria-label="چسبیدن به دیوار"
            className={wallSnapEnabled ? 'text-primary' : ''}
          >
            <Magnet className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowGrid((v) => !v)}
            title="شبکه راهنما"
            aria-label="شبکه راهنما"
            className={showGrid ? 'text-primary' : ''}
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
        </div>

        <span className="text-xs text-muted-foreground flex items-center gap-1" aria-live="polite">
          {saving ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> در حال ذخیره...
            </>
          ) : dirty ? (
            'تغییرات ذخیره‌نشده'
          ) : (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600" /> ذخیره شد
            </>
          )}
        </span>

        <div className="ms-auto flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setTextGenOpen(true)}
            className="gap-1.5"
            title="ساخت کابینت یا کل فضا با یک جمله"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">ساخت با متن</span>
          </Button>
          <Button size="sm" variant="outline" onClick={exportGLB} disabled={exporting} className="gap-1.5">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">{exporting ? 'در حال ساخت...' : 'خروجی GLB'}</span>
          </Button>
          {!portfolioId && (
            <Button size="sm" onClick={() => setShareOpen(true)} className="gap-1.5">
              <Send className="h-4 w-4" />
              انتشار
            </Button>
          )}
        </div>
      </header>

      {/* ---------- بدنه ---------- */}
      <div className="flex-1 flex min-h-0 flex-col md:flex-row">
        {/* پنل چپ (در RTL: راست صفحه) */}
        <aside className="w-full md:w-64 shrink-0 bg-card border-b md:border-b-0 md:border-e md:order-1 flex flex-col h-52 md:h-auto">
          <div className="flex-1 min-h-0">
            <Tabs defaultValue="library" dir="rtl" className="h-full flex flex-col">
              <TabsList className="mx-3 mt-2 grid grid-cols-2 shrink-0">
                <TabsTrigger value="library">کتابخانه</TabsTrigger>
                <TabsTrigger value="presets">پریست‌ها</TabsTrigger>
              </TabsList>
              <TabsContent value="library" className="flex-1 min-h-0 mt-0">
                <LibraryPanel onPick={addFromCatalog} onGenerate={generateFromText} generating={generating} />
              </TabsContent>
              <TabsContent value="presets" className="flex-1 min-h-0 mt-0">
                <PresetsPanel
                  selectedObjects={objects.filter((o) => selectedIds.includes(o.id))}
                  onInsert={insertPreset}
                />
              </TabsContent>
            </Tabs>
          </div>
        </aside>

        {/* صحنه سه‌بعدی */}
        <main
          className={`relative flex-1 min-h-0 md:order-2 ${dropActive ? 'canvas-drop-active' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDropActive(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setDropActive(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDropActive(false);
            try {
              const raw = e.dataTransfer.getData('application/x-c3d-item');
              if (raw) {
                pendingDrop.current = JSON.parse(raw);
                placeRequestRef.current?.(e.clientX, e.clientY);
              }
            } catch {
              // داده نامعتبر — نادیده بگیر
            }
          }}
        >
          <EditorScene
            roomSpec={roomSpec}
            objects={objects}
            selectedIds={selectedIds}
            canTransform
            showGrid={showGrid}
            refsMap={refsMap.current}
            glRef={glRef}
            sceneRootRef={sceneRootRef}
            placeRequestRef={placeRequestRef}
            onSelect={(id, additive) => store.getState().select(id, additive)}
            onToggleOpen={(id) => store.getState().toggleOpen(id)}
            onToggleLight={(id) => store.getState().toggleLight(id)}
            onBeginAction={() => store.getState().beginAction()}
            wallSnapEnabled={wallSnapEnabled}
            onMoved={(id) => {
              const g = refsMap.current.get(id);
              if (g) store.getState().updateObject(id, {
                position: [
                  +g.position.x.toFixed(3),
                  +g.position.y.toFixed(3),
                  +g.position.z.toFixed(3),
                ],
                // چرخش هم همگام شود (اسنپ دیوار، چرخش را رو به داخل تنظیم می‌کند)
                rotationY: +g.rotation.y.toFixed(3),
              });
            }}
            onPlace={handlePlace}
          />

          {/* چیپ‌های کنترل چراغ */}
          {lights.length > 0 && (
            <div className="absolute top-3 start-3 flex flex-wrap gap-2 max-w-[70%] pointer-events-auto">
              {lights.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-2 rounded-full bg-card/95 shadow-md border px-3 py-1.5 backdrop-blur"
                >
                  <LampCeiling className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium">
                    {l.label ?? (l.type === 'pendant' ? 'چراغ آویز' : 'چراغ ایستاده')}
                  </span>
                  <Switch
                    checked={!!l.on}
                    onCheckedChange={() => store.getState().toggleLight(l.id)}
                    aria-label={`روشن/خاموش ${l.label ?? (l.type === 'pendant' ? 'چراغ آویز' : 'چراغ ایستاده')}`}
                    className="scale-90"
                  />
                </div>
              ))}
            </div>
          )}

          {/* راهنمای تعامل */}
          <div className="absolute bottom-3 start-1/2 -translate-x-1/2 rounded-full bg-card/95 shadow border px-4 py-1.5 text-xs text-muted-foreground whitespace-nowrap pointer-events-none max-w-[95%] overflow-hidden text-ellipsis">
            کلیک: انتخاب • کلیدهای جهت‌نما: حرکت • Q/E: چرخش • Shift+جهت‌نما: قدم بزرگ • دکمه ساخت با متن: کابینت یا کل فضا را با یک جمله بسازید
          </div>

          {/* پد حرکت آبجکت انتخاب‌شده (موبایل + دسکتاپ) */}
          {primary && (
            <MovePad
              onNudge={holdNudge}
              onRotate={holdRotate}
              onDelete={() => store.getState().removeObject(primary.id)}
              onDuplicate={() => store.getState().duplicateObject(primary.id)}
            />
          )}

          {dropActive && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Badge className="text-sm px-4 py-2 shadow-lg">رها کنید تا اضافه شود</Badge>
            </div>
          )}
        </main>

        {/* پنل مشخصات — بدون انتخاب: ویرایشگر پلان اتاق */}
        <aside className="w-full md:w-72 shrink-0 bg-card border-t md:border-t-0 md:border-s md:order-3 h-64 md:h-auto">
          {primary ? (
            <PropertiesPanel
              obj={primary}
              aiEditing={aiEditing}
              onUpdate={(patch) => store.getState().updateObject(primary.id, patch)}
              onUpdateParams={(params) => store.getState().updateParams(primary.id, params)}
              onAiEdit={aiEditSelected}
              onRotate={() => {
                const s = store.getState();
                s.beginAction();
                s.updateObject(primary.id, { rotationY: primary.rotationY + Math.PI / 2 });
              }}
              onDuplicate={() => store.getState().duplicateObject(primary.id)}
              onDelete={() => store.getState().removeObject(primary.id)}
            />
          ) : (
            <RoomPlanPanel
              roomSpec={roomSpec}
              onOutlineChange={(o) => store.getState().setRoomOutline(o)}
            />
          )}
        </aside>
      </div>

      {projectId ? (
        <ShareDialog projectId={projectId} open={shareOpen} onOpenChange={setShareOpen} />
      ) : null}

      {/* دیالوگ ساخت با متن (قطعه یا کل فضا) */}
      <Dialog open={textGenOpen} onOpenChange={setTextGenOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              ساخت با یک جمله
            </DialogTitle>
            <DialogDescription>
              یک جمله بنویسید؛ مثلا: آشپزخانه ۴ متری مدرن با کابینت سفید و جزیره
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="مثلاً: کابینت دیواری با درب شیشه‌ای، رنگ گردویی"
            aria-label="توصیف متنی ساخت"
            className="bg-card"
          />
          <p className="text-[11px] text-muted-foreground leading-5">
            «کل فضا را طراحی کن»: فضای فعلی جایگزین می‌شود — با Ctrl+Z قابل بازگشت است.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => submitTextGen('piece')}
              disabled={!textDraft.trim() || generating || roomBusy}
              className="gap-1.5 h-10"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              قطعه‌ای بساز
            </Button>
            <Button
              onClick={() => submitTextGen('room')}
              disabled={!textDraft.trim() || generating || roomBusy}
              className="gap-1.5 h-10"
            >
              {roomBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              کل فضا را طراحی کن
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* دیالوگ ویرایش پلان (وقتی آبجکتی انتخاب است و پنل کناری مشغول است) */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PencilRuler className="h-4 w-4 text-primary" />
              ویرایش پلان اتاق
            </DialogTitle>
            <DialogDescription>
              گوشه‌ها را بکشید تا دیوار کج بسازید — اتاق لزوماً ۴ دیوار نیست
            </DialogDescription>
          </DialogHeader>
          <RoomPlanPanel
            roomSpec={roomSpec}
            onOutlineChange={(o) => store.getState().setRoomOutline(o)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
