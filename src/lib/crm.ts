// ============================================================
// Project progress stages (cabinet-making CRM) — shared between API and UI
// Survey & measurement → design → build → install → delivery
// ============================================================

export type ProjectStage = 'visit' | 'design' | 'build' | 'install' | 'delivered';

export interface StageInfo {
  id: ProjectStage;
  label: string;
  /** Badge color class (tailwind) */
  badge: string;
  /** Status dot color */
  dot: string;
}

export const PROJECT_STAGES: StageInfo[] = [
  {
    id: 'visit',
    label: 'Survey & measurement',
    badge: 'bg-sky-100 text-sky-900 border-sky-200',
    dot: '#0284c7',
  },
  {
    id: 'design',
    label: 'Design & approval',
    badge: 'bg-violet-100 text-violet-900 border-violet-200',
    dot: '#7c3aed',
  },
  {
    id: 'build',
    label: 'Workshop build',
    badge: 'bg-amber-100 text-amber-900 border-amber-200',
    dot: '#d97706',
  },
  {
    id: 'install',
    label: 'Installing',
    badge: 'bg-orange-100 text-orange-900 border-orange-200',
    dot: '#ea580c',
  },
  {
    id: 'delivered',
    label: 'Delivered',
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    dot: '#059669',
  },
];

export const isProjectStage = (v: unknown): v is ProjectStage =>
  typeof v === 'string' && PROJECT_STAGES.some((s) => s.id === v);

export const stageInfo = (id: string | null | undefined): StageInfo =>
  PROJECT_STAGES.find((s) => s.id === id) ?? PROJECT_STAGES[0];

/** Format an amount in Toman with US separators — 25000000 → "25,000,000 Toman" */
export function formatToman(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '';
  return `${Math.round(amount).toLocaleString('en-US')} Toman`;
}
