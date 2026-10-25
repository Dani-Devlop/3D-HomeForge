'use client';

import { useRef, useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  X,
} from 'lucide-react';
import { api, type ProjectCrmFields } from '@/lib/api';
import { PROJECT_STAGES, formatToman, type ProjectStage } from '@/lib/crm';
import { fileToResizedDataUrl } from '@/lib/image-utils';
import { isoToLocalInput, localInputToIso } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ============================================================
// دیالوگ کامل پروژه — مشتری، قرارداد و مالی، زمان‌بندی
// جایگزین CrmDialog قدیمی؛ هم برای ساخت پروژه جدید و هم ویرایش
// ============================================================

/** فیلدهای خروجی دیالوگ — رشته خالی یعنی «پاک شود» (سرور null می‌کند) */
export type ProjectFormSave = ProjectCrmFields & { name?: string };

/** زیرمجموعه‌ای از ProjectDTO برای مقدار اولیه (پروژه موجود یا {}) */
export interface ProjectFormInitial {
  name?: string;
  clientName?: string | null;
  clientPhone?: string | null;
  address?: string | null;
  stage?: ProjectStage;
  dealAt?: string | null;
  contractAmount?: number | null;
  contractPhoto?: string | null;
  invoicePhoto?: string | null;
  visitAt?: string | null;
  installAt?: string | null;
  dueAt?: string | null;
}

/** نتیجه پیدا/ساختن پوشه مشتری — existed یعنی پوشه از قبل بوده و استفاده شد */
export interface ResolvedCustomerFolder {
  id: string | null;
  existed: boolean;
}

/**
 * پوشه مشتری را بر اساس نام پیدا یا می‌سازد (پوشه = مشتری).
 * سرور خودش پوشه‌های هم‌نام را یکی می‌کند و پوشه موجود را برمی‌گرداند —
 * پس یک فراخوانی createFolder هم «پیدا کردن» و هم «ساختن» را حل می‌کند.
 * نام خالی → بدون پوشه. خطاهای شبکه به فراخواننده منتقل می‌شود.
 */
export async function resolveCustomerFolder(
  name: string,
  phone?: string,
): Promise<ResolvedCustomerFolder> {
  const trimmed = name.trim();
  if (!trimmed) return { id: null, existed: false };
  const res = await api.createFolder(trimmed, phone?.trim() || undefined);
  return { id: res.folder.id, existed: !!res.existed };
}

// --- تاریخ قرارداد: ورودی date ساده ↔ ISO (ظهر محلی برای جلوگیری از جابه‌جایی روز) ---
const dealIsoToDateInput = (iso: string | null | undefined): string =>
  iso ? iso.slice(0, 10) : '';

const dateInputToDealIso = (v: string): string | null => {
  if (!v) return null;
  const d = new Date(`${v}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

type PhotoField = 'contract' | 'invoice';

function PhotoFieldRow({
  label,
  value,
  busy,
  inputRef,
  onPick,
  onRemove,
}: {
  label: string;
  value: string;
  busy: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (file: File | null | undefined) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files?.[0]);
          e.target.value = '';
        }}
        aria-hidden
      />
      {value ? (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-1.5">
          <img src={value} alt={label} className="h-12 w-16 rounded-md border object-cover shrink-0" />
          <p className="text-xs text-muted-foreground flex-1 min-w-0 truncate">تصویر افزوده شد</p>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={onRemove}
            aria-label={`حذف ${label}`}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="w-full rounded-lg border border-dashed border-border hover:border-primary/60 bg-muted/30 transition-colors h-10 px-3 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : label.includes('فاکتور') ? (
            <FileText className="h-3.5 w-3.5" />
          ) : (
            <Paperclip className="h-3.5 w-3.5" />
          )}
          افزودن تصویر
        </button>
      )}
    </div>
  );
}

export function ProjectFormDialog({
  title,
  initial,
  withName,
  saving,
  onSave,
  onCancel,
}: {
  title: string;
  initial: ProjectFormInitial;
  withName?: boolean;
  saving: boolean;
  onSave: (v: ProjectFormSave) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name ?? '');
  const [clientName, setClientName] = useState(initial.clientName ?? '');
  const [clientPhone, setClientPhone] = useState(initial.clientPhone ?? '');
  const [address, setAddress] = useState(initial.address ?? '');
  const [stage, setStage] = useState<ProjectStage>(initial.stage ?? 'visit');
  const [amountInput, setAmountInput] = useState(
    initial.contractAmount != null ? String(initial.contractAmount) : '',
  );
  const [dealAt, setDealAt] = useState(dealIsoToDateInput(initial.dealAt));
  const [contractPhoto, setContractPhoto] = useState(initial.contractPhoto ?? '');
  const [invoicePhoto, setInvoicePhoto] = useState(initial.invoicePhoto ?? '');
  const [visitAt, setVisitAt] = useState(isoToLocalInput(initial.visitAt));
  const [installAt, setInstallAt] = useState(isoToLocalInput(initial.installAt));
  const [dueAt, setDueAt] = useState(isoToLocalInput(initial.dueAt));
  const [photoBusy, setPhotoBusy] = useState<PhotoField | null>(null);

  const contractImgRef = useRef<HTMLInputElement>(null);
  const invoiceImgRef = useRef<HTMLInputElement>(null);

  const pickPhoto = async (field: PhotoField, file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    try {
      setPhotoBusy(field);
      // عرض ~1100 و کیفیت ۰٫۷۵ برای کوچک‌ماندن حجم dataURL
      const url = await fileToResizedDataUrl(file, 1100, 0.75);
      if (field === 'contract') setContractPhoto(url);
      else setInvoicePhoto(url);
    } catch {
      // خواندن ناموفق — بدون تغییر
    } finally {
      setPhotoBusy(null);
    }
  };

  const amountNumber = amountInput.trim() === '' ? null : Number(amountInput);
  const amountValid =
    amountNumber === null || (Number.isFinite(amountNumber) && amountNumber >= 0);

  const submit = () => {
    onSave({
      ...(withName ? { name } : {}),
      clientName,
      clientPhone,
      address,
      stage,
      dealAt: dateInputToDealIso(dealAt),
      contractAmount:
        amountNumber !== null && Number.isFinite(amountNumber) && amountNumber >= 0
          ? Math.round(amountNumber)
          : null,
      contractPhoto,
      invoicePhoto,
      visitAt: localInputToIso(visitAt),
      installAt: localInputToIso(installAt),
      dueAt: localInputToIso(dueAt),
    });
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onCancel()}>
      <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {withName && (
            <div className="space-y-1">
              <Label className="text-xs">نام پروژه</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثلاً: آشپزخانه آقای رضایی"
                maxLength={80}
                autoFocus
              />
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">همه فیلدها اختیاری هستند</p>

          {/* ---------- مشتری ---------- */}
          <section className="space-y-2">
            <h4 className="text-[11px] font-bold text-muted-foreground">مشتری</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">نام مشتری</Label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="مثلاً: آقای محمدی"
                  maxLength={80}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">شماره‌های تماس</Label>
                <Input
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  dir="ltr"
                  className="text-start"
                  placeholder="0912… 021…"
                  maxLength={60}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">مکان اجرا</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="مثلاً: تهران، سعادت‌آباد، کوچه…"
                maxLength={300}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">مرحله پیشرفت</Label>
              <Select value={stage} onValueChange={(v) => setStage(v as ProjectStage)} dir="rtl">
                <SelectTrigger className="w-full" aria-label="مرحله پیشرفت پروژه">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STAGES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          {/* ---------- قرارداد و مالی ---------- */}
          <section className="space-y-2">
            <h4 className="text-[11px] font-bold text-muted-foreground">قرارداد و مالی</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">مبلغ قرارداد</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  dir="ltr"
                  className="text-start"
                  placeholder="تومان"
                />
                {amountValid && amountNumber !== null ? (
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    {formatToman(amountNumber)}
                  </p>
                ) : (
                  <p className="text-[10px] text-transparent select-none">—</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">تاریخ قرارداد</Label>
                <Input
                  type="date"
                  value={dealAt}
                  onChange={(e) => setDealAt(e.target.value)}
                  dir="ltr"
                  className="text-start h-9"
                />
              </div>
            </div>
            <PhotoFieldRow
              label="عکس قرارداد"
              value={contractPhoto}
              busy={photoBusy === 'contract'}
              inputRef={contractImgRef}
              onPick={(f) => pickPhoto('contract', f)}
              onRemove={() => setContractPhoto('')}
            />
            <PhotoFieldRow
              label="فاکتور"
              value={invoicePhoto}
              busy={photoBusy === 'invoice'}
              inputRef={invoiceImgRef}
              onPick={(f) => pickPhoto('invoice', f)}
              onRemove={() => setInvoicePhoto('')}
            />
          </section>

          {/* ---------- زمان‌بندی ---------- */}
          <section className="space-y-2">
            <h4 className="text-[11px] font-bold text-muted-foreground">زمان‌بندی</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">زمان بازدید</Label>
                <Input
                  type="datetime-local"
                  value={visitAt}
                  onChange={(e) => setVisitAt(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">زمان اجرا</Label>
                <Input
                  type="datetime-local"
                  value={installAt}
                  onChange={(e) => setInstallAt(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">زمان اتمام</Label>
                <Input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </section>

          {!contractPhoto && !invoicePhoto && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <ImageIcon className="h-3 w-3" /> عکس قرارداد و فاکتور اختیاری‌اند و بعداً هم قابل افزودن است
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            انصراف
          </Button>
          <Button onClick={submit} disabled={saving || !amountValid || (withName && !name.trim())}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} ذخیره
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
