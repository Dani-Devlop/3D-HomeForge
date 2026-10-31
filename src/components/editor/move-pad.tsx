'use client';

// ============================================================
// Floating move pad — move/rotate the selected object with buttons (mobile + desktop)
// Directions are feel-based: "forward" = -z (toward the back wall), "back" = +z, "left" = -x, "right" = +x
// v2: collapsible + draggable by handle + centering fix + keyboard hints on desktop only
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Copy,
  GripHorizontal,
  Move3d,
  RotateCcw,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MovePadProps {
  onNudge: (d: [number, number, number]) => void;
  onRotate: (deltaRad: number) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  title?: string;
  /** sessionStorage key for persisting state (collapsed + position) */
  storageKey?: string;
}

interface PadPos {
  /** Distance from the left edge of the viewport (px) — null = centered */
  x: number | null;
  /** Distance from the bottom of the viewport (px) — null = default */
  y: number | null;
}

const DEFAULT_POS: PadPos = { x: null, y: null };

/** Hold-to-repeat button (fires immediately, then every 130ms) */
function HoldButton({
  className,
  label,
  onHold,
  children,
}: {
  className?: string;
  label: string;
  onHold: () => void;
  children: React.ReactNode;
}) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cbRef = useRef(onHold);
  useEffect(() => {
    cbRef.current = onHold;
  }, [onHold]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (timerRef.current) return;
    cbRef.current();
    timerRef.current = setInterval(() => cbRef.current(), 130);
  }, []);

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'h-11 w-11 rounded-xl border bg-card/95 hover:bg-accent/70 active:bg-primary/15 active:scale-95',
        'flex items-center justify-center transition-all touch-manipulation select-none outline-none',
        'focus-visible:ring-2 focus-visible:ring-primary/50',
        className
      )}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        start();
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

/** Safe sessionStorage read (client-only — inside dynamic ssr:false) */
function readSaved(key: string): { collapsed: boolean; pos: PadPos } {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return { collapsed: false, pos: DEFAULT_POS };
    const saved = JSON.parse(raw) as { collapsed?: boolean; pos?: PadPos };
    const pos: PadPos =
      saved.pos && typeof saved.pos.x === 'number' && typeof saved.pos.y === 'number'
        ? { x: saved.pos.x, y: saved.pos.y }
        : DEFAULT_POS;
    return { collapsed: saved.collapsed === true, pos };
  } catch {
    return { collapsed: false, pos: DEFAULT_POS };
  }
}

/**
 * Floating move pad — mobile friendly:
 *  - handle at the top to drag the pad anywhere on screen (so it stops covering the scene/gizmo)
 *  - collapse button → leaves only a small round button
 *  - true centering (physical left-1/2, RTL-independent)
 *  - keyboard hints render only on mouse-capable devices
 */
export function MovePad({
  onNudge,
  onRotate,
  onDelete,
  onDuplicate,
  title,
  storageKey = 'c3d-movepad',
}: MovePadProps) {
  const [collapsed, setCollapsed] = useState(() => readSaved(storageKey).collapsed);
  const [pos, setPos] = useState<PadPos>(() => readSaved(storageKey).pos);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const persist = useCallback(
    (next: { collapsed?: boolean; pos?: PadPos }) => {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
    },
    [storageKey],
  );

  // ---- Drag the pad by its handle ----
  const onHandleDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const rect = rootRef.current?.getBoundingClientRect();
    const padW = rect?.width ?? 160;
    // Convert to relative left/bottom coordinates
    const left = rect?.left ?? 0;
    const bottomFromViewport = window.innerHeight - (rect?.bottom ?? 0);
    setPos((prev) => {
      const x = prev.x ?? left;
      const y = prev.y ?? Math.max(bottomFromViewport, 0);
      dragRef.current = { px: e.clientX, py: e.clientY, ox: x, oy: y };
      return { x, y };
    });
    setDragging(true);
  };

  const onHandleMove = (e: React.PointerEvent) => {
    if (!dragging || !dragRef.current) return;
    const { px, py, ox, oy } = dragRef.current;
    const dx = e.clientX - px;
    const dy = -(e.clientY - py); // bottom is positive
    const padW = rootRef.current?.offsetWidth ?? 160;
    const padH = rootRef.current?.offsetHeight ?? 200;
    const nx = Math.min(Math.max(ox + dx, 4), Math.max(window.innerWidth - padW - 4, 4));
    const ny = Math.min(Math.max(oy + dy, 4), Math.max(window.innerHeight - padH - 4, 4));
    setPos({ x: nx, y: ny });
  };

  const onHandleUp = () => {
    if (!dragging) return;
    dragRef.current = null;
    setDragging(false);
    setPos((p) => {
      persist({ collapsed, pos: p });
      return p;
    });
  };

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    setPos((p) => {
      persist({ collapsed: next, pos: p });
      return p;
    });
  };

  // Position: defaults to bottom-center — exact coordinates after dragging
  const positionStyle: React.CSSProperties | undefined =
    pos.x !== null && pos.y !== null ? { left: pos.x, bottom: pos.y } : undefined;

  // ---- Collapsed state: a single round button ----
  if (collapsed) {
    return (
      <div
        ref={rootRef}
        dir="ltr"
        className={cn(
          'absolute z-30 pointer-events-auto',
          pos.x !== null && pos.y !== null ? '' : 'bottom-20 left-1/2 -translate-x-1/2'
        )}
        style={positionStyle}
      >
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={title ?? 'Open move pad'}
          title={title ?? 'Open move pad'}
          className="h-12 w-12 rounded-full bg-card/95 backdrop-blur shadow-xl border flex items-center justify-center text-primary active:scale-95 transition-transform touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <Move3d className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      dir="ltr"
      role="group"
      aria-label={title ?? 'Move pad for the selected object'}
      className={cn(
        'absolute z-30 rounded-2xl bg-card/95 backdrop-blur shadow-xl border p-1.5 pointer-events-auto',
        dragging && 'shadow-2xl ring-2 ring-primary/30 transition-none',
        pos.x !== null && pos.y !== null ? '' : 'bottom-20 left-1/2 -translate-x-1/2'
      )}
      style={positionStyle}
    >
      <div className="flex flex-col items-center gap-1">
        {/* Drag handle + collapse */}
        <div
          className="flex items-center gap-1 w-full px-1 cursor-grab active:cursor-grabbing touch-none select-none"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          role="separator"
          aria-label="Move pad"
        >
          <GripHorizontal className={cn('h-4 w-4 mx-auto text-muted-foreground/70', dragging && 'text-primary')} />
          <button
            type="button"
            onClick={toggleCollapsed}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Collapse pad"
            title="Collapse pad"
            className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent/60 shrink-0 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        {/* Rotation row */}
        <div className="flex items-center gap-1">
          <HoldButton label="Rotate left (45°)" onHold={() => onRotate(-Math.PI / 4)} className="text-amber-700">
            <RotateCcw className="h-4.5 w-4.5" />
          </HoldButton>
          <span className="text-[10px] text-muted-foreground font-medium min-w-12 text-center">Rotate 45°</span>
          <HoldButton label="Rotate right (45°)" onHold={() => onRotate(Math.PI / 4)} className="text-amber-700">
            <RotateCw className="h-4.5 w-4.5" />
          </HoldButton>
        </div>

        <div className="flex items-start gap-1">
          {/* Height column */}
          <div className="flex flex-col gap-1">
            <HoldButton label="Raise (height)" onHold={() => onNudge([0, 0.05, 0])} className="text-primary">
              <ChevronsUp className="h-4.5 w-4.5" />
            </HoldButton>
            <span className="text-[9px] text-muted-foreground text-center leading-none">Up</span>
            <HoldButton label="Lower (height)" onHold={() => onNudge([0, -0.05, 0])} className="text-primary">
              <ChevronsDown className="h-4.5 w-4.5" />
            </HoldButton>
            <span className="text-[9px] text-muted-foreground text-center leading-none">Down</span>
          </div>

          {/* Four directions */}
          <div className="grid grid-cols-3 gap-1">
            <span />
            <div className="flex flex-col items-center">
              <HoldButton label="Forward (toward the back wall)" onHold={() => onNudge([0, 0, -0.05])}>
                <ChevronUp className="h-5 w-5" />
              </HoldButton>
              <span className="text-[9px] text-muted-foreground leading-none mt-0.5">Forward</span>
            </div>
            <span />
            <div className="flex flex-col items-center">
              <HoldButton label="Left" onHold={() => onNudge([-0.05, 0, 0])}>
                <ChevronLeft className="h-5 w-5" />
              </HoldButton>
              <span className="text-[9px] text-muted-foreground leading-none mt-0.5">Left</span>
            </div>
            <span />
            <div className="flex flex-col items-center">
              <HoldButton label="Right" onHold={() => onNudge([0.05, 0, 0])}>
                <ChevronRight className="h-5 w-5" />
              </HoldButton>
              <span className="text-[9px] text-muted-foreground leading-none mt-0.5">Right</span>
            </div>
            <span />
            <div className="flex flex-col items-center">
              <HoldButton label="Back (toward you)" onHold={() => onNudge([0, 0, 0.05])}>
                <ChevronDown className="h-5 w-5" />
              </HoldButton>
              <span className="text-[9px] text-muted-foreground leading-none mt-0.5">Back</span>
            </div>
            <span />
          </div>
        </div>

        {/* Duplicate/Delete (optional) */}
        {(onDuplicate || onDelete) && (
          <div className="flex items-center gap-1 pt-0.5 border-t w-full justify-center">
            {onDuplicate && (
              <HoldButton label="Duplicate object" onHold={onDuplicate} className="mt-1">
                <Copy className="h-4 w-4" />
              </HoldButton>
            )}
            {onDelete && (
              <HoldButton
                label="Delete object"
                onHold={onDelete}
                className="mt-1 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </HoldButton>
            )}
          </div>
        )}

        {/* Keyboard hints — desktop only (mouse/trackpad) */}
        <p className="hidden [@media(hover:hover)_and_(pointer:fine)]:block text-[10px] text-muted-foreground text-center leading-snug pt-0.5">
          Keyboard: arrow keys = move • Shift = larger step • PageUp/PageDown = height • Q/E = rotate
        </p>
      </div>
    </div>
  );
}
