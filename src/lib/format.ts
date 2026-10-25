// ============================================================
// هلپرهای کوچک قالب‌بندی — تاریخ شمسی، زمان نسبی، ورودی datetime
// ============================================================

const FA_DATE = new Intl.DateTimeFormat('fa-IR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const FA_DATETIME = new Intl.DateTimeFormat('fa-IR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** تاریخ شمسی کوتاه — خالی → «—» */
export function formatFaDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return FA_DATE.format(d);
}

/** تاریخ و ساعت شمسی — خالی → «—» */
export function formatFaDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return FA_DATETIME.format(d);
}

/** فاصله زمانی نسبی فارسی: «چند لحظه پیش»، «۵ دقیقه پیش»، «۳ ساعت پیش»، «۲ روز پیش» */
export function relativeFa(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'چند لحظه پیش';
  if (minutes < 60) return `${minutes.toLocaleString('fa-IR')} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours.toLocaleString('fa-IR')} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days.toLocaleString('fa-IR')} روز پیش`;
  return formatFaDate(iso);
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** مقدار ورودی datetime-local → ISO UTC (رشته خالی → null) */
export function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** ISO → مقدار ورودی datetime-local (زمان محلی بدون آفست — خالی → '') */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // getFullYear و بقیه از قبل زمان محلی را برمی‌گردانند
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  );
}
