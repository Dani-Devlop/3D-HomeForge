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
  Redo2,
  Share2,
  Send,
  Undo2,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { ObjectPatch, SceneObject, CatalogItem, RoomSpec } from '@/lib/scene-types';
import { exportGroupToGLB } from '@/lib/export-glb';
import {
  findFreeSpot,
  uid,
  useEditorStore,
} from '@/store/editor-store';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EditorScene from '@/components/three/editor-scene';
import { LibraryPanel } from './library-panel';
import { PropertiesPanel } from './properties-panel';
import { PresetsPanel } from './presets-panel';
import { ShareDialog } from './share-dialog';

export default function EditorView({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const projectQ = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.getProject(projectId),
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
  const [showGrid, setShowGrid] = useState(true);
  const [dropActive, setDropActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiEditing, setAiEditing] = useState(false);

  // بارگذاری پروژه در استور
  useEffect(() => {
    if (projectQ.data?.project && !loaded) {
      const p = projectQ.data.project;
      const spec =
        p.roomSpec && 'widthM' in p.roomSpec
          ? (p.roomSpec as RoomSpec)
          : roomSpec;
      const objs: SceneObject[] =
        p.sceneState && 'objects' in p.sceneState && Array.isArray(p.sceneState.objects)
          ? p.sceneState.objects
          : [];
      store.getState().loadProject(p.id, p.name, spec, objs);
      setLoaded(true);
    }
  }, [projectQ.data, loaded, store, roomSpec]);

  // ---- ذخیره خودکار ----
  const saveProject = useCallback(
    async (withThumb: boolean) => {
      const s = store.getState();
      if (!s.projectId) return;
      try {
        setSaving(true);
        let thumbnail: string | null | undefined;
        if (withThumb && glRef.current && sceneRootRef.current) {
          try {
            thumbnail = glRef.current.domElement.toDataURL('image/jpeg', 0.55);
          } catch {
            thumbnail = undefined;
          }
        }
        await api.patchProject(s.projectId, {
          name: s.projectName,
          sceneState: { objects: s.objects },
          ...(thumbnail !== undefined ? { thumbnail } : {}),
        });
        store.getState().markSaved();
      } catch (e) {
        // خطای ذخیره بی‌صدا برای جلوگیری از اسپم
        console.error('save failed', e);
      } finally {
        setSaving(false);
      }
    },
    [store]
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
      const type = pendingDrop.current;
      if (!type) return;
      pendingDrop.current = null;
      const w = roomSpec.widthM / 2;
      const d = roomSpec.depthM / 2;
      const cx = THREE.MathUtils.clamp(x, -w + 0.2, w - 0.2);
      const cz = THREE.MathUtils.clamp(z, -d + 0.2, d - 0.2);
      store.getState().addObject(type.type, [cx, 0, cz], type.label);
    },
    [roomSpec, store]
  );

  const pendingDrop = useRef<{ type: SceneObject['type']; label?: string } | null>(null);

  // ---- افزودن با کلیک ----
  const addFromCatalog = (item: CatalogItem) => {
    const s = store.getState();
    const [x, z] = findFreeSpot(s.objects, item.type, s.roomSpec);
    s.addObject(item.type, [x, 0, z], item.label);
    toast({ title: `${item.label} اضافه شد`, description: 'با کشیدن گیزموت جابه‌جا کنید' });
  };

  // ---- تولید مدل با توصیف متنی (text-to-3D) ----
  const generateFromText = async (text: string) => {
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
    } catch (e) {
      toast({
        title: 'تولید مدل ناموفق بود',
        description: e instanceof Error ? e.message : 'دوباره تلاش کنید',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
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
      ? [
        THREE.MathUtils.clamp(pos[0] + patch.positionDelta[0], -s.roomSpec.widthM, s.roomSpec.widthM),
        THREE.MathUtils.clamp(pos[1] + patch.positionDelta[1], 0, s.roomSpec.heightM),
        THREE.MathUtils.clamp(pos[2] + patch.positionDelta[2], -s.roomSpec.depthM, s.roomSpec.depthM),
      ]
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
    mutationFn: (name: string) => api.patchProject(projectId, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', projectId] }),
  });

  if (projectQ.isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (projectQ.isError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold">پروژه پیدا نشد</p>
        <p className="text-sm text-muted-foreground">{(projectQ.error as Error).message}</p>
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
          aria-label="نام پروژه"
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
          <Button size="sm" variant="outline" onClick={exportGLB} disabled={exporting} className="gap-1.5">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">{exporting ? 'در حال ساخت...' : 'خروجی GLB'}</span>
          </Button>
          <Button size="sm" onClick={() => setShareOpen(true)} className="gap-1.5">
            <Send className="h-4 w-4" />
            انتشار
          </Button>
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
            onMoved={(id) => {
              const g = refsMap.current.get(id);
              if (g) store.getState().updateObject(id, {
                position: [
                  +g.position.x.toFixed(3),
                  +g.position.y.toFixed(3),
                  +g.position.z.toFixed(3),
                ],
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
          <div className="absolute bottom-3 start-1/2 -translate-x-1/2 rounded-full bg-card/95 shadow border px-4 py-1.5 text-xs text-muted-foreground whitespace-nowrap pointer-events-none">
            کلیک: انتخاب • کلیک روی درب: باز/بسته • درگ گیزموت: جابه‌جایی • Shift+کلیک: چندانتخابی
          </div>

          {dropActive && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Badge className="text-sm px-4 py-2 shadow-lg">رها کنید تا اضافه شود</Badge>
            </div>
          )}
        </main>

        {/* پنل مشخصات */}
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
            <div className="h-full flex flex-col items-center justify-center gap-2 p-6 text-center">
              <Share2 className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                یک آبجکت را از کتابخانه به صحنه اضافه یا در صحنه انتخاب کنید
              </p>
            </div>
          )}
        </aside>
      </div>

      <ShareDialog projectId={projectId} open={shareOpen} onOpenChange={setShareOpen} />
    </div>
  );
}
