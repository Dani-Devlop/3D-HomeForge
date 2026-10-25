'use client';

// ============================================================
// پد حرکت شناور — جابه‌جایی/چرخش آبجکت انتخاب‌شده با دکمه (موبایل + دسکتاپ)
// جهت‌ها حسی است: «جلو» = -z (به سمت دیوار پشت)، «عقب» = +z، «چپ» = -x، «راست» = +x
// ============================================================

import { useCallback, useEffect, useRef } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Copy,
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
}

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

/**
 * پد شناور جابه‌جایی — بالای نوار راهنما (bottom-16) وسط صحنه.
 * ردیف ۱: چرخش چپ/راست — ردیف ۲: جلو/چپ/راست/عقب + ستون ارتفاع — ردیف ۳: تکثیر/حذف (اختیاری)
 */
export function MovePad({ onNudge, onRotate, onDelete, onDuplicate, title }: MovePadProps) {
  return (
    <div
      dir="rtl"
      className="absolute bottom-16 start-1/2 -translate-x-1/2 z-20 rounded-2xl bg-card/95 backdrop-blur shadow-xl border p-2 pointer-events-auto"
      role="group"
      aria-label={title ?? 'پد جابه‌جایی آبجکت انتخاب‌شده'}
    >
      <div className="flex flex-col items-center gap-1.5">
        {/* ردیف ۱ — چرخش */}
        <div className="flex items-center gap-1.5">
          <HoldButton label="چرخش به چپ (۴۵ درجه)" onHold={() => onRotate(-Math.PI / 4)} className="text-amber-700">
            <RotateCcw className="h-4.5 w-4.5" />
          </HoldButton>
          <span className="text-[10px] text-muted-foreground font-medium min-w-14 text-center">چرخش ۴۵°</span>
          <HoldButton label="چرخش به راست (۴۵ درجه)" onHold={() => onRotate(Math.PI / 4)} className="text-amber-700">
            <RotateCw className="h-4.5 w-4.5" />
          </HoldButton>
        </div>

        <div className="flex items-start gap-1.5">
          {/* ستون ارتفاع */}
          <div className="flex flex-col gap-1.5">
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
          <div className="grid grid-cols-3 gap-1.5">
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

        {/* ردیف ۳ — تکثیر/حذف (اختیاری) */}
        {(onDuplicate || onDelete) && (
          <div className="flex items-center gap-1.5 pt-0.5 border-t w-full justify-center">
            {onDuplicate && (
              <HoldButton label="تکثیر آبجکت" onHold={onDuplicate} className="mt-1.5">
                <Copy className="h-4 w-4" />
              </HoldButton>
            )}
            {onDelete && (
              <HoldButton
                label="حذف آبجکت"
                onHold={onDelete}
                className="mt-1.5 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </HoldButton>
            )}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground text-center leading-snug pt-0.5">
          کیبورد: کلیدهای جهت‌نما = حرکت • Shift = قدم بزرگ • PageUp/PageDown = ارتفاع • Q/E = چرخش
        </p>
      </div>
    </div>
  );
}
