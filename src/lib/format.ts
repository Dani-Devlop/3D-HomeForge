// ============================================================
// Small formatting helpers — short date, relative time, datetime input
// ============================================================

const FA_DATE = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const FA_DATETIME = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** Short date — empty → "—" */
export function formatFaDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return FA_DATE.format(d);
}

/** Date and time — empty → "—" */
export function formatFaDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return FA_DATETIME.format(d);
}

/** Relative time: "just now", "5 min ago", "3 hr ago", "2 days ago" */
export function relativeFa(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes.toLocaleString('en-US')} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours.toLocaleString('en-US')} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days.toLocaleString('en-US')} days ago`;
  return formatFaDate(iso);
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** datetime-local input value → ISO UTC (empty string → null) */
export function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** ISO → datetime-local input value (local time without offset — empty → '') */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // getFullYear and friends already return local time
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  );
}
