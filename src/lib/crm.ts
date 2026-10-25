// ============================================================
// مراحل پیشرفت پروژه (CRM کابینت‌سازی) — مشترک بین API و UI
// بازدید اولیه و متر کردن ← طراحی ← ساخت ← نصب ← تحویل
// ============================================================

export type ProjectStage = 'visit' | 'design' | 'build' | 'install' | 'delivered';

export interface StageInfo {
  id: ProjectStage;
  label: string;
  /** کلاس رنگ بج (tailwind) */
  badge: string;
  /** رنگ نقطه وضعیت */
  dot: string;
}

export const PROJECT_STAGES: StageInfo[] = [
  {
    id: 'visit',
    label: 'بازدید و متر کردن',
    badge: 'bg-sky-100 text-sky-900 border-sky-200',
    dot: '#0284c7',
  },
  {
    id: 'design',
    label: 'طراحی و تایید',
    badge: 'bg-violet-100 text-violet-900 border-violet-200',
    dot: '#7c3aed',
  },
  {
    id: 'build',
    label: 'ساخت در کارگاه',
    badge: 'bg-amber-100 text-amber-900 border-amber-200',
    dot: '#d97706',
  },
  {
    id: 'install',
    label: 'در حال نصب',
    badge: 'bg-orange-100 text-orange-900 border-orange-200',
    dot: '#ea580c',
  },
  {
    id: 'delivered',
    label: 'اتمام و تحویل',
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    dot: '#059669',
  },
];

export const isProjectStage = (v: unknown): v is ProjectStage =>
  typeof v === 'string' && PROJECT_STAGES.some((s) => s.id === v);

export const stageInfo = (id: string | null | undefined): StageInfo =>
  PROJECT_STAGES.find((s) => s.id === id) ?? PROJECT_STAGES[0];

/** قالب‌بندی مبلغ به تومان با جداکننده فارسی — 25000000 → «۲۵٬۰۰۰٬۰۰۰ تومان» */
export function formatToman(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '';
  return `${Math.round(amount).toLocaleString('fa-IR')} تومان`;
}
