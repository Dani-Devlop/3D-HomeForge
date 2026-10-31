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
import { ThemeToggle } from '@/components/theme-toggle';
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

/** Detect typing in text fields — arrow keys must not move the scene */
function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/** Re-login card shown when the admin session has expired (401) */
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
        title: 'Login failed',
        description: (e as Error).message || 'Incorrect admin password',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm shadow-xl">
        <CardContent className="p-8 space-y-5 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-bold">Admin login</h1>
            <p className="text-sm text-muted-foreground">Your session has expired — enter the password to continue</p>
          </div>
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Admin password"
            autoFocus
            className="h-11 text-center"
            aria-label="Admin password"
          />
          <Button className="w-full h-11" onClick={submit} disabled={!pw || busy}>
            {busy ? 'Signing in...' : 'Sign in'}
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

  // Portfolio item edit mode (/editor/pf/:id) — loads and saves the portfolio item
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

  // Load the project or portfolio item into the store
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

  // ---- Auto-save (project or portfolio item) ----
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
          // Save to the portfolio item — live model + refreshed image fallback
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
        // Silent save errors to avoid spam
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

  // Project name → browser tab title
  useEffect(() => {
    document.title = `${projectName} | 3D HomeForge Editor`;
  }, [projectName]);

  // ---- Drag & Drop from the library ----
  const handlePlace = useCallback(
    (x: number, z: number) => {
      const drop = pendingDrop.current;
      if (!drop) return;
      pendingDrop.current = null;
      const s = store.getState();
      const [cx, , cz] = clampPositionToRoom(s.roomSpec, [x, 0, z]);
      if (isWallSnapType(drop.type)) {
        // Wall object → snaps to the nearest wall (flush and facing inward)
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

  // ---- Add by click ----
  const addFromCatalog = (item: CatalogItem) => {
    const s = store.getState();
    const [x, z] = findFreeSpot(s.objects, item.type, s.roomSpec);
    if (isWallSnapType(item.type)) {
      const snapped = snapNewObject(s.roomSpec, item.type, x, z, item.defaults);
      s.addObject(item.type, [snapped.x, 0, snapped.z], item.label, snapped.rotationY);
    } else {
      s.addObject(item.type, [x, 0, z], item.label);
    }
    toast({ title: `${item.label} added`, description: 'Drag the gizmo to move it' });
  };

  // ---- Generate a model from a text description (text-to-3D) ----
  const generateFromText = async (text: string): Promise<boolean> => {
    try {
      setGenerating(true);
      const { item } = await api.generateObject(text);
      const s = store.getState();
      const [x, z] = findFreeSpot(s.objects, item.type, s.roomSpec);
      s.addGenerated(item.type, item.label, item.params, [x, 0, z]);
      toast({
        title: `"${item.label}" created ✓`,
        description: 'Parametric model added to the scene — fine-tune it in the side panel',
      });
      return true;
    } catch (e) {
      toast({
        title: 'Model generation failed',
        description: e instanceof Error ? e.message : 'Please try again',
        variant: 'destructive',
      });
      return false;
    } finally {
      setGenerating(false);
    }
  };

  // ---- Design the whole room from a text description (text-to-room) — replaces the scene ----
  const generateWholeRoom = async (text: string): Promise<boolean> => {
    try {
      setRoomBusy(true);
      const result = await api.generateRoom(text);
      store.getState().replaceScene(result.roomSpec, result.objects);
      toast({
        title: 'New room created ✓',
        description: `${result.objects.length} objects placed in the room — press Ctrl+Z to undo`,
      });
      return true;
    } catch (e) {
      toast({
        title: 'Room design failed',
        description: e instanceof Error ? e.message : 'Please try again',
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

  // ---- Text-based editing of the selected object ----
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
      toast({ title: 'Change applied ✓', description: 'Undo with Ctrl+Z' });
    } catch (e) {
      toast({
        title: 'Applying the change failed',
        description: e instanceof Error ? e.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setAiEditing(false);
    }
  };

  // ---- Keyboard Undo/Redo ----
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

  // ---- Move the selected object with the keyboard (arrows / height / rotation) ----
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
      e.preventDefault(); // keep arrows/PageUp from scrolling the page
      if (d) nudgeRef.current?.(d, !e.repeat);
      else rotateRef.current?.(rot, !e.repeat);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---- Move pad: one beginAction per hold (not per repeat tick) ----
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

  // ---- GLB export ----
  const exportGLB = async () => {
    if (!sceneRootRef.current) return;
    try {
      setExporting(true);
      await exportGroupToGLB(sceneRootRef.current, `${projectName || 'cabinet'}.glb`);
      toast({ title: 'GLB file downloaded ✓', description: 'Standard binary glTF format' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Failed to build the GLB file', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  // ---- Presets ----
  const insertPreset = (data: Partial<SceneObject>[]) => {
    const s = store.getState();
    // Spot farthest from the walls → free center of the scene
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
    toast({ title: 'Preset added to the scene ✓' });
  };

  // ---- Lights for the control chips ----
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

  // Session expired — re-login card
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
        <p className="text-lg font-semibold">{portfolioId ? 'Portfolio item not found' : 'Project not found'}</p>
        <p className="text-sm text-muted-foreground">{(loadError as Error).message}</p>
        <Button onClick={() => (window.location.hash = '')} variant="outline" className="gap-2">
          <ArrowRight className="h-4 w-4" /> Back home
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* ---------- Top bar ---------- */}
      <header className="shrink-0 bg-card border-b px-3 py-2 flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => (window.location.hash = '')}
          className="gap-1.5"
          aria-label="Back"
        >
          <ArrowRight className="h-4 w-4" />
          <span className="hidden sm:inline">Home</span>
        </Button>

        <Input
          value={projectName}
          onChange={(e) => store.getState().setProjectName(e.target.value)}
          onBlur={(e) => {
            const name = e.target.value.trim();
            if (name) renameProject.mutate(name);
          }}
          className="h-9 w-44 sm:w-56 font-semibold"
          aria-label={portfolioId ? 'Portfolio item title' : 'Project name'}
        />

        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => store.getState().undo()}
            disabled={pastLen === 0}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => store.getState().redo()}
            disabled={futureLen === 0}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setPlanOpen(true)}
            title="Edit room plan (slanted walls / add corners)"
            aria-label="Edit room plan"
          >
            <PencilRuler className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setWallSnapEnabled((v) => !v)}
            title="Snap cabinets to walls (hold Alt to release temporarily)"
            aria-label="Wall snapping"
            className={wallSnapEnabled ? 'text-primary' : ''}
          >
            <Magnet className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowGrid((v) => !v)}
            title="Grid guide"
            aria-label="Grid guide"
            className={showGrid ? 'text-primary' : ''}
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
        </div>

        <span className="text-xs text-muted-foreground flex items-center gap-1" aria-live="polite">
          {saving ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Saving...
            </>
          ) : dirty ? (
            'Unsaved changes'
          ) : (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600" /> Saved
            </>
          )}
        </span>

        <div className="ms-auto flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setTextGenOpen(true)}
            className="gap-1.5"
            title="Generate a cabinet or the whole room from one sentence"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">Generate with text</span>
          </Button>
          <Button size="sm" variant="outline" onClick={exportGLB} disabled={exporting} className="gap-1.5">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">{exporting ? 'Building...' : 'Export GLB'}</span>
          </Button>
          {!portfolioId && (
            <Button size="sm" onClick={() => setShareOpen(true)} className="gap-1.5">
              <Send className="h-4 w-4" />
              Share
            </Button>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* ---------- Body ---------- */}
      <div className="flex-1 flex min-h-0 flex-col md:flex-row">
        {/* Library panel */}
        <aside className="w-full md:w-64 shrink-0 bg-card border-b md:border-b-0 md:border-e md:order-1 flex flex-col h-52 md:h-auto">
          <div className="flex-1 min-h-0">
            <Tabs defaultValue="library" dir="ltr" className="h-full flex flex-col">
              <TabsList className="mx-3 mt-2 grid grid-cols-2 shrink-0">
                <TabsTrigger value="library">Library</TabsTrigger>
                <TabsTrigger value="presets">Presets</TabsTrigger>
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

        {/* 3D scene */}
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
              // Invalid payload — ignore
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
                // Sync rotation too (wall snap sets it to face inward)
                rotationY: +g.rotation.y.toFixed(3),
              });
            }}
            onPlace={handlePlace}
          />

          {/* Light control chips */}
          {lights.length > 0 && (
            <div className="absolute top-3 start-3 flex flex-wrap gap-2 max-w-[70%] pointer-events-auto">
              {lights.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-2 rounded-full bg-card/95 shadow-md border px-3 py-1.5 backdrop-blur"
                >
                  <LampCeiling className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium">
                    {l.label ?? (l.type === 'pendant' ? 'Pendant light' : 'Floor lamp')}
                  </span>
                  <Switch
                    checked={!!l.on}
                    onCheckedChange={() => store.getState().toggleLight(l.id)}
                    aria-label={`On/off ${l.label ?? (l.type === 'pendant' ? 'Pendant light' : 'Floor lamp')}`}
                    className="scale-90"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Interaction hints — keyboard part only on desktop */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-card/95 shadow border px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs text-muted-foreground text-center pointer-events-none max-w-[94%] overflow-hidden text-ellipsis">
            Click: select
            <span className="hidden [@media(hover:hover)_and_(pointer:fine)]:inline">
              {' • '}Arrow keys: move • Q/E: rotate • Shift+arrows: larger step
            </span>
            {' • '}Generate button: create a cabinet or the whole room from one sentence
          </div>

          {/* Move pad for the selected object (mobile + desktop) */}
          {primary && (
            <MovePad
              storageKey="c3d-movepad-editor"
              onNudge={holdNudge}
              onRotate={holdRotate}
              onDelete={() => store.getState().removeObject(primary.id)}
              onDuplicate={() => store.getState().duplicateObject(primary.id)}
            />
          )}

          {dropActive && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Badge className="text-sm px-4 py-2 shadow-lg">Drop to add</Badge>
            </div>
          )}
        </main>

        {/* Properties panel — with no selection: room plan editor */}
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

      {/* Text generation dialog (single piece or whole room) */}
      <Dialog open={textGenOpen} onOpenChange={setTextGenOpen}>
        <DialogContent className="max-w-md" dir="ltr">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Generate with a sentence
            </DialogTitle>
            <DialogDescription>
              Describe it in one sentence, e.g.: modern 4 m kitchen with white cabinets and an island
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. wall cabinet with glass doors, walnut finish"
            aria-label="Generation description"
            className="bg-card"
          />
          <p className="text-[11px] text-muted-foreground leading-5">
            "Design the whole room" replaces the current scene — undo with Ctrl+Z.
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
              Generate a piece
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
              Design the whole room
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Plan edit dialog (when an object is selected and the side panel is busy) */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="max-w-md" dir="ltr">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PencilRuler className="h-4 w-4 text-primary" />
              Edit room plan
            </DialogTitle>
            <DialogDescription>
              Drag the corners to create slanted walls — the room is not limited to 4 walls
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
