'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useQuery } from '@tanstack/react-query';
import {
  Check,
  Eye,
  LampCeiling,
  Link2Off,
  Loader2,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import { api, type GuestDTO } from '@/lib/api';
import type { RoomSpec, SceneObject, ShareRole } from '@/lib/scene-types';
import { ensureObjectIds } from '@/lib/scene-types';
import { clampPositionToRoom } from '@/lib/polygon';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme-toggle';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import ViewerScene from '@/components/three/viewer-scene';
import { MovePad } from '@/components/editor/move-pad';

const ROLE_LABEL: Record<ShareRole, string> = {
  viewer: 'Viewer',
  modifier: 'Editor',
};

// ---------- Guest entry gate ----------
function GuestGate({
  onJoin,
  loading,
}: {
  onJoin: (name: string) => void;
  loading: boolean;
}) {
  const [name, setName] = useState('');
  const submit = () => {
    const n = name.trim();
    if (n.length >= 1) onJoin(n);
  };
  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur flex items-center justify-center p-6">
      <Card className="w-full max-w-sm shadow-xl">
        <CardContent className="p-6 space-y-4 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Eye className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold">Welcome!</h2>
            <p className="text-sm text-muted-foreground">
              Enter your name to view the 3D design
            </p>
          </div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="e.g. Jane Smith"
            maxLength={30}
            autoFocus
            className="h-11 text-center"
            aria-label="Your name"
          />
          <Button className="w-full h-11" onClick={submit} disabled={!name.trim() || loading}>
            {loading ? 'Joining…' : 'Join'}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            No sign-up or email needed — only your name is shown
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Main client view ----------
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function ViewerView({ token }: { token: string }) {
  const { toast } = useToast();

  const resolveQ = useQuery({
    queryKey: ['share-resolve', token],
    queryFn: () => api.resolveShare(token),
    retry: false,
  });

  const [guest, setGuest] = useState<GuestDTO | null>(null);
  const [role, setRole] = useState<ShareRole | null>(null);
  const [joining, setJoining] = useState(false);
  const [objects, setObjects] = useState<SceneObject[]>([]);
  const [cameraKey, setCameraKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [dirtyTick, setDirtyTick] = useState(0);
  const refsMap = useRef<Map<string, unknown>>(new Map());

  const touch = () => setDirtyTick((t) => t + 1);

  // After resolve: initial setup
  useEffect(() => {
    if (!resolveQ.data || guest) return;
    const p = resolveQ.data.project;
    const objs = ensureObjectIds(
      p.sceneState && Array.isArray((p.sceneState as { objects?: SceneObject[] }).objects)
        ? (p.sceneState as { objects: SceneObject[] }).objects
        : [],
    );
    setObjects(objs);
    setRole(resolveQ.data.link.role);

    // Previously saved guest
    try {
      const saved = sessionStorage.getItem(`c3d-guest:${token}`);
      if (saved) {
        const g = JSON.parse(saved) as GuestDTO;
        setGuest(g);
        setRole(g.role);
      }
    } catch {
      // ignore
    }
  }, [resolveQ.data, guest, token]);

  const join = async (name: string) => {
    try {
      setJoining(true);
      const res = await api.registerGuest({ token, name });
      setGuest(res.guest);
      setRole(res.guest.role);
      sessionStorage.setItem(`c3d-guest:${token}`, JSON.stringify(res.guest));
      toast({ title: `Welcome ${res.guest.name}!`, description: 'Click the doors to open them' });
    } catch (e) {
      toast({ title: 'Join failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setJoining(false);
    }
  };

  // Role polling — access changes take effect immediately
  useEffect(() => {
    if (!guest) return;
    const t = setInterval(async () => {
      try {
        const res = await api.getGuest(guest.id);
        if (res.guest.role !== role) {
          setRole(res.guest.role);
          toast({
            title: 'Your access has been updated',
            description: `You now have ${ROLE_LABEL[res.guest.role]} access`,
          });
        }
      } catch {
        // Guest may have been removed — ignore silently
      }
    }, 4000);
    return () => clearInterval(t);
  }, [guest, role, toast]);

  const lights = useMemo(
    () => objects.filter((o) => o.type === 'pendant' || o.type === 'floor-lamp'),
    [objects]
  );

  const roomSpec = resolveQ.data?.project.roomSpec;

  const patchObject = (id: string, patch: Partial<SceneObject>) => {
    setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    touch();
  };

  // ---- Editor guest autosave (1.2s after the last change) ----
  const firstDirtyRef = useRef(true);
  useEffect(() => {
    if (firstDirtyRef.current) {
      firstDirtyRef.current = false;
      return;
    }
    if (dirtyTick === 0 || !guest || role !== 'modifier' || !resolveQ.data) return;
    const t = setTimeout(async () => {
      setSaveState('saving');
      try {
        await api.saveAsGuest({ token, guestId: guest.id, sceneState: { objects } });
        setSaveState('saved');
      } catch {
        setSaveState('error'); // silent — brief indicator only
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [dirtyTick, guest, role, token, objects, resolveQ.data]);

  // Return the save indicator to idle
  useEffect(() => {
    if (saveState !== 'saved' && saveState !== 'error') return;
    const t = setTimeout(() => setSaveState('idle'), 3000);
    return () => clearTimeout(t);
  }, [saveState]);

  // ---------- Error states ----------
  if (resolveQ.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground animate-pulse">Opening link...</p>
      </div>
    );
  }

  if (resolveQ.isError || !resolveQ.data || !roomSpec || !('widthM' in roomSpec)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="p-8 space-y-3">
            <Link2Off className="h-10 w-10 mx-auto text-destructive/60" />
            <p className="font-semibold">Invalid link</p>
            <p className="text-sm text-muted-foreground">
              {(resolveQ.error as Error)?.message || 'This link has expired or has been deactivated.'}
            </p>
            <p className="text-xs text-muted-foreground">Contact the designer to get a new link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canMove = role === 'modifier';
  const selected = selectedId ? objects.find((o) => o.id === selectedId) : undefined;
  const spec = roomSpec && 'widthM' in roomSpec ? roomSpec : null;

  const clampPos = (
    pos: [number, number, number],
    d: [number, number, number]
  ): [number, number, number] => {
    if (!spec) return pos;
    // Constrained to the floor-plan polygon (slanted walls) — y handled separately
    const [cx, , cz] = clampPositionToRoom(spec, [
      pos[0] + d[0],
      0,
      pos[2] + d[2],
    ]);
    return [cx, THREE.MathUtils.clamp(pos[1] + d[1], 0, spec.heightM), cz];
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top bar */}
      <header className="shrink-0 bg-card border-b px-3 py-2 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-bold text-sm truncate">{resolveQ.data.project.name}</p>
          <Badge variant="secondary" className="text-[10px]">3D View</Badge>
        </div>

        {guest && (
          <div className="flex items-center gap-2">
            <span
              className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: guest.color }}
              aria-hidden
            >
              {guest.name.slice(0, 1)}
            </span>
            <span className="text-xs font-medium">{guest.name}</span>
            <Badge variant="outline" className="text-[10px] gap-1">
              {role === 'viewer' ? <Eye className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
              {role ? ROLE_LABEL[role] : ''}
            </Badge>
          </div>
        )}

        <div className="ms-auto flex items-center gap-2">
          <ThemeToggle />
          {guest && role === 'modifier' && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1" aria-live="polite">
              {saveState === 'saving' ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                </>
              ) : saveState === 'saved' ? (
                <>
                  <Check className="h-3 w-3 text-emerald-600" /> Saved ✓
                </>
              ) : saveState === 'error' ? (
                <span className="text-destructive">Save failed</span>
              ) : dirtyTick > 0 ? (
                'Unsaved changes'
              ) : null}
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-xs"
            onClick={() => setCameraKey((k) => k + 1)}
            aria-label="Reset view"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset view</span>
          </Button>
        </div>
      </header>

      {/* Scene */}
      <main className="relative flex-1 min-h-0">
        <ViewerScene
          roomSpec={roomSpec}
          objects={objects}
          canMove={canMove}
          refsMap={refsMap.current as never}
          onSelect={(id) => setSelectedId(id)}
          onToggleOpen={(id) =>
            patchObject(id, { open: !objects.find((o) => o.id === id)?.open })
          }
          onToggleLight={(id) =>
            patchObject(id, { on: !objects.find((o) => o.id === id)?.on })
          }
          onBeginAction={() => {}}
          onMoved={(id) => {
            // Position from gizmo (THREE group) → state so it gets saved
            const g = refsMap.current.get(id) as THREE.Group | undefined;
            if (g) {
              patchObject(id, {
                position: [
                  +g.position.x.toFixed(3),
                  +g.position.y.toFixed(3),
                  +g.position.z.toFixed(3),
                ],
              });
            } else {
              setObjects((prev) => [...prev]);
            }
          }}
          cameraKey={cameraKey}
        />

        {/* Light controls */}
        {lights.length > 0 && (
          <div className="absolute top-3 start-3 flex flex-wrap gap-2 max-w-[75%]">
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
                  onCheckedChange={() =>
                    patchObject(l.id, { on: !objects.find((o) => o.id === l.id)?.on })
                  }
                  aria-label={`Toggle ${l.label ?? (l.type === 'pendant' ? 'pendant light' : 'floor lamp')}`}
                  className="scale-90"
                />
              </div>
            ))}
          </div>
        )}

        {/* Move pad for editor guests */}
        {canMove && selected && (
          <MovePad
            storageKey={`c3d-movepad-viewer:${token}`}
            onNudge={(d) => patchObject(selected.id, { position: clampPos(selected.position, d) })}
            onRotate={(r) =>
              patchObject(selected.id, { rotationY: selected.rotationY + r })
            }
          />
        )}

        {/* Help hint */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-card/95 shadow border px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs text-muted-foreground text-center pointer-events-none max-w-[94%]">
          {canMove ? (
            <span>
              Click a cabinet: select • Move buttons or drag the gizmo: move • Autosave on
            </span>
          ) : (
            <span>
              Click doors: open/close • Drag: rotate view • Scroll: zoom
            </span>
          )}
        </div>
      </main>

      {!guest && <GuestGate onJoin={join} loading={joining} />}
    </div>
  );
}
