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
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import ViewerScene from '@/components/three/viewer-scene';
import { MovePad } from '@/components/editor/move-pad';

const ROLE_LABEL: Record<ShareRole, string> = {
  viewer: 'نمایشگر',
  modifier: 'ویرایشگر',
};

// ---------- پرده ورود مهمان ----------
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
    <div className="fixed inset-0 z-50 bg-stone-100/95 backdrop-blur flex items-center justify-center p-6">
      <Card className="w-full max-w-sm shadow-xl">
        <CardContent className="p-6 space-y-4 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Eye className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold">خوش آمدید!</h2>
            <p className="text-sm text-muted-foreground">
              برای بازدید از طرح سه‌بعدی، لطفاً نام خود را وارد کنید
            </p>
          </div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="مثلاً: خانم احمدی"
            maxLength={30}
            autoFocus
            className="h-11 text-center"
            aria-label="نام شما"
          />
          <Button className="w-full h-11" onClick={submit} disabled={!name.trim() || loading}>
            {loading ? 'در حال ورود...' : 'ورود به فضای سه‌بعدی'}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            بدون نیاز به ثبت‌نام یا ایمیل — فقط نام شما نمایش داده می‌شود
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- نمای اصلی مشتری ----------
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

  // بعد از resolve: مقداردهی اولیه
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

    // مهمان ذخیره‌شده قبلی
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
      toast({ title: `خوش آمدید ${res.guest.name}!`, description: 'روی درب‌ها کلیک کنید تا باز شوند' });
    } catch (e) {
      toast({ title: 'ورود ناموفق', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setJoining(false);
    }
  };

  // پایش نقش — تغییر دسترسی بلافاصله اعمال می‌شود
  useEffect(() => {
    if (!guest) return;
    const t = setInterval(async () => {
      try {
        const res = await api.getGuest(guest.id);
        if (res.guest.role !== role) {
          setRole(res.guest.role);
          toast({
            title: 'دسترسی شما به‌روزرسانی شد',
            description: `اکنون ${ROLE_LABEL[res.guest.role]} هستید`,
          });
        }
      } catch {
        // مهمان ممکن است حذف شده باشد — بی‌صدا
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

  // ---- ذخیره خودکار مهمان ویرایشگر (۱.۲ ثانیه بعد از آخرین تغییر) ----
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
        setSaveState('error'); // بی‌صدا — فقط نشانگر کوتاه
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [dirtyTick, guest, role, token, objects, resolveQ.data]);

  // بازگشت نشانگر ذخیره به حالت عادی
  useEffect(() => {
    if (saveState !== 'saved' && saveState !== 'error') return;
    const t = setTimeout(() => setSaveState('idle'), 3000);
    return () => clearTimeout(t);
  }, [saveState]);

  // ---------- حالت‌های خطا ----------
  if (resolveQ.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-sm text-muted-foreground animate-pulse">در حال باز کردن لینک...</p>
      </div>
    );
  }

  if (resolveQ.isError || !resolveQ.data || !roomSpec || !('widthM' in roomSpec)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="p-8 space-y-3">
            <Link2Off className="h-10 w-10 mx-auto text-destructive/60" />
            <p className="font-semibold">لینک نامعتبر است</p>
            <p className="text-sm text-muted-foreground">
              {(resolveQ.error as Error)?.message || 'این لینک منقضی شده یا غیرفعال شده است.'}
            </p>
            <p className="text-xs text-muted-foreground">برای دریافت لینک جدید با کابینت‌ساز تماس بگیرید.</p>
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
    // داخل چندضلع پلان (دیوار کج) محدود می‌شود — y جداگانه
    const [cx, , cz] = clampPositionToRoom(spec, [
      pos[0] + d[0],
      0,
      pos[2] + d[2],
    ]);
    return [cx, THREE.MathUtils.clamp(pos[1] + d[1], 0, spec.heightM), cz];
  };

  return (
    <div className="h-screen flex flex-col bg-stone-100 overflow-hidden">
      {/* نوار بالا */}
      <header className="shrink-0 bg-card border-b px-3 py-2 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-bold text-sm truncate">{resolveQ.data.project.name}</p>
          <Badge variant="secondary" className="text-[10px]">نمای سه‌بعدی</Badge>
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
          {guest && role === 'modifier' && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1" aria-live="polite">
              {saveState === 'saving' ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> در حال ذخیره...
                </>
              ) : saveState === 'saved' ? (
                <>
                  <Check className="h-3 w-3 text-emerald-600" /> ذخیره شد ✓
                </>
              ) : saveState === 'error' ? (
                <span className="text-destructive">ذخیره ناموفق</span>
              ) : dirtyTick > 0 ? (
                'تغییرات ذخیره‌نشده'
              ) : null}
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-xs"
            onClick={() => setCameraKey((k) => k + 1)}
            aria-label="بازنشانی نما"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">بازنشانی نما</span>
          </Button>
        </div>
      </header>

      {/* صحنه */}
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
            // موقعیت از گیزموت (گروه سه‌بعدی) → state تا ذخیره شود
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

        {/* کنترل چراغ‌ها */}
        {lights.length > 0 && (
          <div className="absolute top-3 start-3 flex flex-wrap gap-2 max-w-[75%]">
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
                  onCheckedChange={() =>
                    patchObject(l.id, { on: !objects.find((o) => o.id === l.id)?.on })
                  }
                  aria-label={`روشن/خاموش ${l.label ?? (l.type === 'pendant' ? 'چراغ آویز' : 'چراغ ایستاده')}`}
                  className="scale-90"
                />
              </div>
            ))}
          </div>
        )}

        {/* پد حرکت برای مهمان ویرایشگر */}
        {canMove && selected && (
          <MovePad
            onNudge={(d) => patchObject(selected.id, { position: clampPos(selected.position, d) })}
            onRotate={(r) =>
              patchObject(selected.id, { rotationY: selected.rotationY + r })
            }
          />
        )}

        {/* راهنما */}
        <div className="absolute bottom-3 start-1/2 -translate-x-1/2 rounded-full bg-card/95 shadow border px-4 py-1.5 text-xs text-muted-foreground whitespace-nowrap pointer-events-none">
          {canMove
            ? 'کلیک روی کابینت: انتخاب • دکمه‌های حرکت یا درگ گیزموت: جابه‌جایی • ذخیره خودکار'
            : 'کلیک روی درب‌ها: باز/بسته • درگ: چرخش نما • اسکرول: زوم'}
        </div>
      </main>

      {!guest && <GuestGate onJoin={join} loading={joining} />}
    </div>
  );
}
