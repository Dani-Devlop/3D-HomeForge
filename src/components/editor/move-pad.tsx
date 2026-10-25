'use client';

// ============================================================
// پد حرکت شناور — جابه‌جایی/چرخش آبجکت انتخاب‌شده با دکمه (موبایل + دسکتاپ)
// جهت‌ها حسی است: «جلو» = -z (به سمت دیوار پشت)، «عقب» = +z، «چپ» = -x، «راست» = +x
// v2: قابل جمع‌شدن + قابل جابه‌جایی با دستگیره + فیکس وسط‌چین + راهنمای کیبورد فقط دسکتاپ
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
  /** کلید ذخیره وضعیت (باز/بسته و موقعیت) در sessionStorage */
  storageKey?: string;
}

interface PadPos {
  /** فاصله از چپ ویوئوپورت (px) — null = وسط */
  x: number | null;
  /** فاصله از پایین ویوئوپورت (px) — null = پیش‌فرض */
  y: number | null;
}

const DEFAULT_POS: PadPos = { x: null, y: null };

/** دکمه با نگه‌داشتن → تکرار خودکار (اول فوری، سپس هر ۱۳۰ms) */
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

/** خواندن امن از sessionStorage (کلاینت‌only است — داخل dynamic ssr:false) */
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
 * پد شناور جابه‌جایی — موبایل‌پسند:
 *  - دستگیره بالای پد برای جابه‌جایی هرجای صفحه (تا دیگر روی صحنه/گیزموت نیفتد)
 *  - دکمه جمع‌کردن → فقط یک دکمه گرد کوچک می‌ماند
 *  - وسط‌چین واقعی (left-1/2 فیزیکی، مستقل از RTL)
 *  - راهنمای کیبورد فقط روی دستگاه‌های ماوس‌دار رندر می‌شود
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

  // ---- درگ پد با دستگیره ----
  const onHandleDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const rect = rootRef.current?.getBoundingClientRect();
    const padW = rect?.width ?? 160;
    // تبدیل به مختصات left/bottom نسبی
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
    const dy = -(e.clientY - py); // پایین مثبت
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

  // موقعیت: پیش‌فرض وسط پایین — بعد از درگ، مختصات دقیق
  const positionStyle: React.CSSProperties | undefined =
    pos.x !== null && pos.y !== null ? { left: pos.x, bottom: pos.y } : undefined;

  // ---- حالت جمع‌شده: یک دکمه گرد ----
  if (collapsed) {
    return (
      <div
        ref={rootRef}
        dir="rtl"
        className={cn(
          'absolute z-30 pointer-events-auto',
          pos.x !== null && pos.y !== null ? '' : 'bottom-20 left-1/2 -translate-x-1/2'
        )}
        style={positionStyle}
      >
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={title ?? 'باز کردن پد جابه‌جایی'}
          title={title ?? 'باز کردن پد جابه‌جایی'}
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
      dir="rtl"
      role="group"
      aria-label={title ?? 'پد جابه‌جایی آبجکت انتخاب‌شده'}
      className={cn(
        'absolute z-30 rounded-2xl bg-card/95 backdrop-blur shadow-xl border p-1.5 pointer-events-auto',
        dragging && 'shadow-2xl ring-2 ring-primary/30 transition-none',
        pos.x !== null && pos.y !== null ? '' : 'bottom-20 left-1/2 -translate-x-1/2'
      )}
      style={positionStyle}
    >
      <div className="flex flex-col items-center gap-1">
        {/* دستگیره درگ + جمع‌کردن */}
        <div
          className="flex items-center gap-1 w-full px-1 cursor-grab active:cursor-grabbing touch-none select-none"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          role="separator"
          aria-label="جابه‌جایی پد"
        >
          <GripHorizontal className={cn('h-4 w-4 mx-auto text-muted-foreground/70', dragging && 'text-primary')} />
          <button
            type="button"
            onClick={toggleCollapsed}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="جمع کردن پد"
            title="جمع کردن پد"
            className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent/60 shrink-0 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        {/* ردیف چرخش */}
        <div className="flex items-center gap-1">
          <HoldButton label="چرخش به چپ (۴۵ درجه)" onHold={() => onRotate(-Math.PI / 4)} className="text-amber-700">
            <RotateCcw className="h-4.5 w-4.5" />
          </HoldButton>
          <span className="text-[10px] text-muted-foreground font-medium min-w-12 text-center">چرخش ۴۵°</span>
          <HoldButton label="چرخش به راست (۴۵ درجه)" onHold={() => onRotate(Math.PI / 4)} className="text-amber-700">
            <RotateCw className="h-4.5 w-4.5" />
          </HoldButton>
        </div>

        <div className="flex items-start gap-1">
          {/* ستون ارتفاع */}
          <div className="flex flex-col gap-1">
            <HoldButton label="بالا بردن (ارتفاع)" onHold={() => onNudge([0, 0.05, 0])} className="text-primary">
              <ChevronsUp className="h-4.5 w-4.5" />
            </HoldButton>
            <span className="text-[9px] text-muted-foreground text-center leading-none">بالا</span>
            <HoldButton label="پایین آوردن (ارتفاع)" onHold={() => onNudge([0, -0.05, 0])} className="text-primary">
              <ChevronsDown className="h-4.5 w-4.5" />
            </HoldButton>
            <span className="text-[9px] text-muted-foreground text-center leading-none">پایین</span>
          </div>

          {/* چهار جهت */}
          <div className="grid grid-cols-3 gap-1">
            <span />
            <div className="flex flex-col items-center">
              <HoldButton label="جلو (به سمت دیوار پشت)" onHold={() => onNudge([0, 0, -0.05])}>
                <ChevronUp className="h-5 w-5" />
              </HoldButton>
              <span className="text-[9px] text-muted-foreground leading-none mt-0.5">جلو</span>
            </div>
            <span />
            <div className="flex flex-col items-center">
              <HoldButton label="چپ" onHold={() => onNudge([-0.05, 0, 0])}>
                <ChevronLeft className="h-5 w-5" />
              </HoldButton>
              <span className="text-[9px] text-muted-foreground leading-none mt-0.5">چپ</span>
            </div>
            <span />
            <div className="flex flex-col items-center">
              <HoldButton label="راست" onHold={() => onNudge([0.05, 0, 0])}>
                <ChevronRight className="h-5 w-5" />
              </HoldButton>
              <span className="text-[9px] text-muted-foreground leading-none mt-0.5">راست</span>
            </div>
            <span />
            <div className="flex flex-col items-center">
              <HoldButton label="عقب (به سمت بیرون)" onHold={() => onNudge([0, 0, 0.05])}>
                <ChevronDown className="h-5 w-5" />
              </HoldButton>
              <span className="text-[9px] text-muted-foreground leading-none mt-0.5">عقب</span>
            </div>
            <span />
          </div>
        </div>

        {/* تکثیر/حذف (اختیاری) */}
        {(onDuplicate || onDelete) && (
          <div className="flex items-center gap-1 pt-0.5 border-t w-full justify-center">
            {onDuplicate && (
              <HoldButton label="تکثیر آبجکت" onHold={onDuplicate} className="mt-1">
                <Copy className="h-4 w-4" />
              </HoldButton>
            )}
            {onDelete && (
              <HoldButton
                label="حذف آبجکت"
                onHold={onDelete}
                className="mt-1 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </HoldButton>
            )}
          </div>
        )}

        {/* راهنمای کیبورد — فقط دسکتاپ (ماوس/ترک‌پد) */}
        <p className="hidden [@media(hover:hover)_and_(pointer:fine)]:block text-[10px] text-muted-foreground text-center leading-snug pt-0.5">
          کیبورد: کلیدهای جهت‌نما = حرکت • Shift = قدم بزرگ • PageUp/PageDown = ارتفاع • Q/E = چرخش
        </p>
      </div>
    </div>
  );
}
