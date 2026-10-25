'use client';

import { useMemo, useRef, useState } from 'react';
import { PencilRuler, RotateCcw } from 'lucide-react';
import type { OutlinePoint, RoomSpec } from '@/lib/scene-types';
import {
  getRoomOutline,
  normalizeOutline,
  outlineArea,
  outlineBBox,
  polygonCentroid,
} from '@/lib/polygon';
import { Button } from '@/components/ui/button';

// ============================================================
// ویرایشگر پلان اتاق (SVG دوبعدی) — پشتیبانی از دیوار کج
// • گوشه‌ها را بکشید → دیوارها عوض می‌شوند (۵ضلعی، ذوزنقه، ...)
// • «+» وسط هر دیوار → گوشه جدید
// • «×» کنار هر گوشه (وقتی بیش از ۳ گوشه باشد) → حذف گوشه
// • «بازگشت به مستطیل» → پلان ساده
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

export function RoomPlanPanel({
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
    <div className="p-4 space-y-3 h-full overflow-y-auto" data-testid="room-plan-panel">
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
