'use client';

import { useMemo, useRef, useState } from 'react';
import { DoorOpen, AppWindow, PencilRuler, Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { DoorwaySpec, OutlinePoint, RoomSpec, WallName, WindowSpec } from '@/lib/scene-types';
import { WALL_NAME_EDGE, WALL_NAME_FA } from '@/lib/scene-types';
import {
  getRoomOutline,
  normalizeOutline,
  outlineArea,
  outlineBBox,
  polygonCentroid,
} from '@/lib/polygon';
import { useEditorStore } from '@/store/editor-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ============================================================
// پنل اتاق (وقتی چیزی انتخاب نشده) — دو تب:
//  • «پلان»: ویرایشگر SVG چندضلعی (دیوار کج / گوشه اضافه)
//  • «نما و بازشوها»: رنگ دیوار/کف/سقف + ارتفاع اتاق + پنجره‌ها و درب‌ها (بازگردانی قابلیت نسخه ۱)
// هر دو تب در پنل کناری و دیالوگ پلان کار می‌کنند (وضعیت از استور می‌آید)
// ============================================================

const MAX_VERTICES = 12;
const snap = (n: number) => Math.round(n * 20) / 20; // خوشه ۵ سانتی‌متری

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const faNum = (n: number, digits = 1) =>
  n.toLocaleString('fa-IR', { maximumFractionDigits: digits });

/** نام دیوار هر اندیس لبه در outline مرجع مستطیل */
const EDGE_TO_NAME: readonly WallName[] = ['back', 'right', 'front', 'left'];

/** برچسب فارسی لبه i (۴ لبه اول با نام، بقیه «لبه N») */
const edgeLabel = (i: number): string => (i < 4 ? WALL_NAME_FA[EDGE_TO_NAME[i]] : `لبه ${faNum(i + 1, 0)}`);

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs">{label}</Label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-14 rounded-md border cursor-pointer bg-transparent"
        aria-label={label}
      />
    </div>
  );
}

function NumField({
  label,
  value,
  step = 0.05,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="space-y-1 block min-w-0">
      <span className="text-[10px] text-muted-foreground block">{label}</span>
      <Input
        type="number"
        dir="ltr"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className="h-8 text-xs"
        aria-label={label}
      />
    </label>
  );
}

// ============================================================
// تب پلان — همان ویرایشگر چندضلعی قبلی
// ============================================================

function PlanEditor({
  roomSpec,
  onOutlineChange,
}: {
  roomSpec: RoomSpec;
  onOutlineChange: (outline: OutlinePoint[] | null) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [frozenVb, setFrozenVb] = useState<ViewBox | null>(null); // قاب ثابت حین درگ

  const outline = useMemo<OutlinePoint[]>(() => getRoomOutline(roomSpec), [roomSpec]);
  const hasCustom = normalizeOutline(roomSpec.outline) != null;
  const bb = useMemo(() => outlineBBox(outline), [outline]);
  const area = useMemo(() => outlineArea(outline), [outline]);
  const centroid = useMemo(() => polygonCentroid(outline), [outline]);

  const liveViewBox = useMemo<ViewBox>(() => {
    const pad = 0.9;
    return { x: bb.minX - pad, y: bb.minZ - pad, w: bb.w + pad * 2, h: bb.d + pad * 2 };
  }, [bb]);

  const activeVb = frozenVb ?? liveViewBox;

  const ptsAttr = outline.map(([x, z]) => `${x},${z}`).join(' ');

  /** مختصات پیکسل → مختصات اتاق (۵ سانت خوشه، داخل کادر ±۸ متر) */
  const toRoom = (clientX: number, clientY: number): OutlinePoint => {
    const svg = svgRef.current;
    const vb = frozenVb ?? liveViewBox;
    if (!svg) return [0, 0];
    const rect = svg.getBoundingClientRect();
    const x = vb.x + ((clientX - rect.left) / rect.width) * vb.w;
    const z = vb.y + ((clientY - rect.top) / rect.height) * vb.h;
    const clamp8 = (n: number) => Math.min(8, Math.max(-8, n));
    return [snap(clamp8(x)), snap(clamp8(z))];
  };

  /** اعمال تغییر نقاط — نامعتبر (مساحت ناچیز) نادیده گرفته می‌شود */
  const applyPts = (pts: OutlinePoint[]) => {
    if (!normalizeOutline(pts, { minArea: 0.5 })) return;
    onOutlineChange(pts);
  };

  const startDrag = (e: React.PointerEvent, idx: number) => {
    e.stopPropagation();
    e.preventDefault();
    setFrozenVb(liveViewBox); // قاب ثابت حین درگ تا پرش نداشته باشیم
    setDragIdx(idx);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onDragMove = (e: React.PointerEvent) => {
    if (dragIdx === null) return;
    const [x, z] = toRoom(e.clientX, e.clientY);
    const next = outline.map((p, i) => (i === dragIdx ? [x, z] : p) as OutlinePoint);
    applyPts(next);
  };

  const endDrag = (e: React.PointerEvent) => {
    if (dragIdx === null) return;
    setDragIdx(null);
    setFrozenVb(null);
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  const insertVertex = (e: React.PointerEvent, edgeIdx: number) => {
    e.stopPropagation();
    if (outline.length >= MAX_VERTICES) return;
    const a = outline[edgeIdx];
    const b = outline[(edgeIdx + 1) % outline.length];
    const mid: OutlinePoint = [snap((a[0] + b[0]) / 2), snap((a[1] + b[1]) / 2)];
    const next = [...outline.slice(0, edgeIdx + 1), mid, ...outline.slice(edgeIdx + 1)];
    applyPts(next);
  };

  const removeVertex = (e: React.PointerEvent, idx: number) => {
    e.stopPropagation();
    if (outline.length <= 3) return;
    applyPts(outline.filter((_, i) => i !== idx));
  };

  const reset = () => onOutlineChange(null);

  return (
    <div className="p-4 space-y-3 h-full overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <PencilRuler className="h-4 w-4 text-primary" />
          پلان اتاق
        </h3>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          onClick={reset}
          disabled={!hasCustom}
          aria-label="بازگشت پلان به مستطیل"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          مستطیل
        </Button>
      </div>

      <div className="rounded-lg border bg-stone-50 dark:bg-stone-900 p-2">
        <svg
          ref={svgRef}
          viewBox={`${activeVb.x} ${activeVb.y} ${activeVb.w} ${activeVb.h}`}
          className="w-full select-none touch-none"
          role="img"
          aria-label="پلان دوبعدی اتاق — گوشه‌ها را بکشید"
          onPointerMove={onDragMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onPointerCancel={endDrag}
        >
          <defs>
            <pattern id="plan-grid" width="0.5" height="0.5" patternUnits="userSpaceOnUse">
              <path d="M 0.5 0 L 0 0 0 0.5" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="0.015" />
            </pattern>
          </defs>

          {/* شبکه راهنما */}
          <rect x={activeVb.x} y={activeVb.y} width={activeVb.w} height={activeVb.h} fill="url(#plan-grid)" />

          {/* کف اتاق */}
          <polygon
            points={ptsAttr}
            className="fill-stone-200/80 dark:fill-stone-700/60"
            stroke="#16a34a"
            strokeWidth="0.045"
            strokeLinejoin="round"
          />

          {/* دستگیره درج گوشه («+») روی وسط هر دیوار */}
          {outline.map((p, i) => {
            const q = outline[(i + 1) % outline.length];
            const mx = (p[0] + q[0]) / 2;
            const mz = (p[1] + q[1]) / 2;
            const disabled = outline.length >= MAX_VERTICES;
            return (
              <g
                key={`mid-${i}`}
                onPointerDown={(e) => insertVertex(e, i)}
                className={disabled ? '' : 'cursor-copy'}
                aria-label={`افزودن گوشه روی دیوار ${i + 1}`}
              >
                <circle cx={mx} cy={mz} r="0.12" fill="#fff" stroke="#16a34a" strokeWidth="0.03" strokeDasharray="0.05 0.04" />
                <text x={mx} y={mz} fontSize="0.17" textAnchor="middle" dominantBaseline="central" fill="#16a34a" pointerEvents="none" fontWeight="bold">
                  +
                </text>
              </g>
            );
          })}

          {/* گوشه‌ها (قابل کشیدن) */}
          {outline.map(([x, z], i) => (
            <g key={`v-${i}`}>
              <circle
                cx={x}
                cy={z}
                r="0.16"
                fill="#16a34a"
                stroke="#fff"
                strokeWidth="0.035"
                className="cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => startDrag(e, i)}
                aria-label={`گوشه ${i + 1} — بکشید تا جابه‌جا شود`}
              />
              {outline.length > 3 && (
                <g
                  onPointerDown={(e) => removeVertex(e, i)}
                  className="cursor-pointer"
                  aria-label={`حذف گوشه ${i + 1}`}
                >
                  {(() => {
                    const dx = x - centroid[0];
                    const dz = z - centroid[1];
                    const len = Math.hypot(dx, dz) || 1;
                    const rx = x + (dx / len) * 0.34;
                    const rz = z + (dz / len) * 0.34;
                    return (
                      <>
                        <circle cx={rx} cy={rz} r="0.1" fill="#fef2f2" stroke="#dc2626" strokeWidth="0.025" />
                        <text x={rx} y={rz} fontSize="0.14" textAnchor="middle" dominantBaseline="central" fill="#dc2626" pointerEvents="none" fontWeight="bold">
                          ×
                        </text>
                      </>
                    );
                  })()}
                </g>
              )}
            </g>
          ))}
        </svg>
      </div>

      <p className="text-xs text-muted-foreground leading-5">
        گوشه‌های سبز را بکشید تا دیوار کج بسازید (اتاق ۵ضلعی، ذوزنقه و...) •
        «+» وسط هر دیوار گوشه اضافه می‌کند • «×» گوشه را حذف می‌کند
      </p>

      <div className="flex flex-wrap gap-2 text-xs" dir="rtl">
        <span className="rounded-full bg-muted px-2.5 py-1">
          عرض {faNum(bb.w)} × عمق {faNum(bb.d)} متر
        </span>
        <span className="rounded-full bg-muted px-2.5 py-1">
          مساحت {faNum(area)} مترمربع
        </span>
        <span className="rounded-full bg-muted px-2.5 py-1">
          {faNum(outline.length, 0)} دیوار
        </span>
      </div>
    </div>
  );
}

// ============================================================
// تب نما و بازشوها — رنگ‌ها، ارتفاع و پنجره/درب (بازگردانی نسخه ۱)
// ============================================================

function WallSelect({
  edgeIndex,
  edgeCount,
  onChange,
}: {
  /** اندیس لبه فعلی (wallIndex یا نگاشت نام دیوار) */
  edgeIndex: number;
  edgeCount: number;
  onChange: (wall: WallName, wallIndex: number) => void;
}) {
  return (
    <Select
      value={String(edgeIndex)}
      onValueChange={(v) => {
        const i = Number(v);
        if (!Number.isFinite(i)) return;
        onChange(i < 4 ? EDGE_TO_NAME[i] : 'back', i);
      }}
    >
      <SelectTrigger className="h-8 text-xs" aria-label="دیوار">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Array.from({ length: Math.max(4, edgeCount) }, (_, i) => (
          <SelectItem key={i} value={String(i)} className="text-xs">
            دیوار {edgeLabel(i)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FacadeEditor({ roomSpec }: { roomSpec: RoomSpec }) {
  const setRoomSpec = useEditorStore((s) => s.setRoomSpec);
  const outline = useMemo<OutlinePoint[]>(() => getRoomOutline(roomSpec), [roomSpec]);
  const edgeCount = outline.length;

  const setWindow = (i: number, patch: Partial<WindowSpec>) =>
    setRoomSpec({ windows: roomSpec.windows.map((w, j) => (j === i ? { ...w, ...patch } : w)) });

  const setDoorway = (i: number, patch: Partial<DoorwaySpec>) =>
    setRoomSpec({ doorways: roomSpec.doorways.map((d, j) => (j === i ? { ...d, ...patch } : d)) });

  const addWindow = () =>
    setRoomSpec({
      windows: [...roomSpec.windows, { wall: 'back', offsetX: 0, sillY: 0.9, width: 1.2, height: 1.2 }],
    });

  const addDoorway = () =>
    setRoomSpec({
      doorways: [...roomSpec.doorways, { wall: 'front', offsetX: 0, width: 0.95, height: 2.05 }],
    });

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* ---- رنگ‌ها ---- */}
        <div className="space-y-2.5">
          <p className="text-xs font-medium text-primary">نمای اتاق</p>
          <ColorRow label="رنگ دیوار" value={roomSpec.wallColor} onChange={(v) => setRoomSpec({ wallColor: v })} />
          <ColorRow label="رنگ کف" value={roomSpec.floorColor} onChange={(v) => setRoomSpec({ floorColor: v })} />
          <ColorRow label="رنگ سقف" value={roomSpec.ceilingColor} onChange={(v) => setRoomSpec({ ceilingColor: v })} />
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">ارتفاع اتاق</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {faNum(roomSpec.heightM, 2)} متر
              </span>
            </div>
            <Slider
              value={[Math.min(3.5, Math.max(2.4, roomSpec.heightM))]}
              min={2.4}
              max={3.5}
              step={0.05}
              onValueChange={([v]) => setRoomSpec({ heightM: v })}
              aria-label="ارتفاع اتاق"
            />
          </div>
        </div>

        {/* ---- بازشوها ---- */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-primary">بازشوها</p>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px] px-2" onClick={addWindow}>
                <Plus className="h-3 w-3" />
                پنجره
              </Button>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px] px-2" onClick={addDoorway}>
                <Plus className="h-3 w-3" />
                درب
              </Button>
            </div>
          </div>

          {roomSpec.windows.length === 0 && roomSpec.doorways.length === 0 && (
            <p className="text-[11px] text-muted-foreground leading-5">
              هنوز پنجره یا دربی نیست — با دکمه‌های بالا اضافه کنید.
            </p>
          )}

          {/* پنجره‌ها */}
          {roomSpec.windows.map((w, i) => (
            <div key={`win-${i}`} className="rounded-lg border bg-card p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  <AppWindow className="h-3.5 w-3.5 text-primary" />
                  پنجره {roomSpec.windows.length > 1 ? faNum(i + 1, 0) : ''}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => setRoomSpec({ windows: roomSpec.windows.filter((_, j) => j !== i) })}
                  aria-label={`حذف پنجره ${i + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <WallSelect
                edgeIndex={w.wallIndex ?? WALL_NAME_EDGE[w.wall] ?? 0}
                edgeCount={edgeCount}
                onChange={(wall, wallIndex) => setWindow(i, { wall, wallIndex })}
              />
              <div className="grid grid-cols-2 gap-2">
                <NumField label="فاصله از مرکز (متر)" value={w.offsetX} step={0.1} onChange={(v) => setWindow(i, { offsetX: v })} />
                <NumField label="ارتفاع از کف (متر)" value={w.sillY} step={0.05} min={0} onChange={(v) => setWindow(i, { sillY: v })} />
                <NumField label="عرض (متر)" value={w.width} step={0.1} min={0.3} onChange={(v) => setWindow(i, { width: v })} />
                <NumField label="ارتفاع (متر)" value={w.height} step={0.1} min={0.3} onChange={(v) => setWindow(i, { height: v })} />
              </div>
            </div>
          ))}

          {/* درب‌ها */}
          {roomSpec.doorways.map((d, i) => (
            <div key={`door-${i}`} className="rounded-lg border bg-card p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  <DoorOpen className="h-3.5 w-3.5 text-primary" />
                  درب {roomSpec.doorways.length > 1 ? faNum(i + 1, 0) : ''}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => setRoomSpec({ doorways: roomSpec.doorways.filter((_, j) => j !== i) })}
                  aria-label={`حذف درب ${i + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <WallSelect
                edgeIndex={d.wallIndex ?? WALL_NAME_EDGE[d.wall] ?? 0}
                edgeCount={edgeCount}
                onChange={(wall, wallIndex) => setDoorway(i, { wall, wallIndex })}
              />
              <div className="grid grid-cols-3 gap-2">
                <NumField label="فاصله از مرکز" value={d.offsetX} step={0.1} onChange={(v) => setDoorway(i, { offsetX: v })} />
                <NumField label="عرض" value={d.width} step={0.05} min={0.6} onChange={(v) => setDoorway(i, { width: v })} />
                <NumField label="ارتفاع" value={d.height} step={0.05} min={1.8} onChange={(v) => setDoorway(i, { height: v })} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}

// ============================================================
// پنل اصلی با تب‌ها
// ============================================================

export function RoomPlanPanel({
  roomSpec,
  onOutlineChange,
}: {
  roomSpec: RoomSpec;
  onOutlineChange: (outline: OutlinePoint[] | null) => void;
}) {
  return (
    <Tabs defaultValue="plan" dir="rtl" className="h-full flex flex-col" data-testid="room-plan-panel">
      <TabsList className="mx-3 mt-2 grid grid-cols-2 h-8 shrink-0">
        <TabsTrigger value="plan" className="text-xs">
          پلان
        </TabsTrigger>
        <TabsTrigger value="facade" className="text-xs">
          نما و بازشوها
        </TabsTrigger>
      </TabsList>
      <TabsContent value="plan" className="flex-1 min-h-0 mt-0">
        <PlanEditor roomSpec={roomSpec} onOutlineChange={onOutlineChange} />
      </TabsContent>
      <TabsContent value="facade" className="flex-1 min-h-0 mt-0">
        <FacadeEditor roomSpec={roomSpec} />
      </TabsContent>
    </Tabs>
  );
}
