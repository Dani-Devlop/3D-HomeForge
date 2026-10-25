'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ImageIcon,
  Images,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { api, type PortfolioItemDTO } from '@/lib/api';
import { fileToResizedDataUrl } from '@/lib/image-utils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { CATEGORY_LABEL } from './site-landing';

// ============================================================
// مدیریت نمونه‌کارها — محتوای بخش عمومی «نمونه‌کارها» را اداره می‌کند
// ============================================================

const CATEGORIES = ['kitchen', 'bedroom', 'living', 'office', 'other'] as const;

// ---------- دیالوگ افزودن/ویرایش ----------
function ItemDialog({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial?: PortfolioItemDTO;
  saving: boolean;
  onSave: (v: {
    title: string;
    description: string;
    category: string;
    image: string;
    visible: boolean;
  }) => void;
  onCancel: () => void;
}) {
  const imgRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState(initial?.category ?? 'kitchen');
  const [image, setImage] = useState(initial?.image ?? '');
  const [visible, setVisible] = useState(initial?.visible ?? true);
  const [reading, setReading] = useState(false);

  const pickImage = async (f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return;
    try {
      setReading(true);
      setImage(await fileToResizedDataUrl(f, 1400, 0.82));
    } catch {
      setImage('');
    } finally {
      setReading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onCancel()}>
      <DialogContent dir="rtl" className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'ویرایش نمونه‌کار' : 'نمونه‌کار جدید'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* تصویر */}
          <input
            ref={imgRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              pickImage(e.target.files?.[0]);
              e.target.value = '';
            }}
            aria-hidden
          />
          {image ? (
            <div className="relative rounded-xl overflow-hidden border">
              <img src={image} alt="پیش‌نمایش تصویر نمونه‌کار" className="w-full aspect-video object-cover" />
              <div className="absolute top-2 end-2 flex gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7 text-[11px] gap-1"
                  onClick={() => imgRef.current?.click()}
                >
                  <UploadCloud className="h-3 w-3" /> تغییر تصویر
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="h-7 w-7"
                  onClick={() => setImage('')}
                  aria-label="حذف تصویر"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => imgRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  imgRef.current?.click();
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                pickImage(e.dataTransfer.files?.[0]);
              }}
              className="w-full aspect-video rounded-xl border-2 border-dashed border-border hover:border-primary/60 bg-muted/30 flex flex-col items-center justify-center gap-2 cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-label="انتخاب تصویر نمونه‌کار"
            >
              {reading ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : (
                <>
                  <UploadCloud className="h-8 w-8 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                  <p className="text-xs font-medium">تصویر نمونه‌کار را انتخاب یا بکشید اینجا</p>
                  <p className="text-[10px] text-muted-foreground">بهتر است عریض و باکیفیت باشد</p>
                </>
              )}
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">عنوان</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: آشپزخانه مدرن چوبی"
              maxLength={80}
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">دسته‌بندی</Label>
            <Select value={category} onValueChange={setCategory} dir="rtl">
              <SelectTrigger className="w-full" aria-label="دسته‌بندی نمونه‌کار">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">توضیح (اختیاری)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="یک یا دو جمله درباره این نمونه‌کار..."
              rows={3}
              maxLength={400}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border px-3 py-2.5">
            <div className="space-y-0.5">
              <Label className="text-xs">نمایش در صفحه اصلی</Label>
              <p className="text-[10px] text-muted-foreground">
                نمونه‌کارهای پنهان فقط اینجا دیده می‌شوند
              </p>
            </div>
            <Switch
              checked={visible}
              onCheckedChange={setVisible}
              aria-label="نمایش در صفحه اصلی"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            انصراف
          </Button>
          <Button onClick={() => onSave({ title: title.trim(), description: description.trim(), category, image, visible })} disabled={!title.trim() || !image || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} ذخیره
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- کارت مدیریت ----------
function ManagerCard({
  item,
  index,
  total,
  onEdit,
}: {
  item: PortfolioItemDTO;
  index: number;
  total: number;
  onEdit: (item: PortfolioItemDTO) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [delOpen, setDelOpen] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['portfolio'] });
  };

  const toggle = useMutation({
    mutationFn: () => api.updatePortfolioItem(item.id, { visible: !item.visible }),
    onSuccess: () => {
      invalidate();
      toast({ title: item.visible ? 'از صفحه اصلی پنهان شد' : 'در صفحه اصلی نمایش داده می‌شود' });
    },
    onError: (e: Error) => toast({ title: 'خطا', description: e.message, variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: () => api.deletePortfolioItem(item.id),
    onSuccess: () => {
      invalidate();
      toast({ title: 'نمونه‌کار حذف شد' });
    },
    onError: (e: Error) => toast({ title: 'خطا در حذف', description: e.message, variant: 'destructive' }),
  });

  const move = useMutation({
    mutationFn: async (dir: -1 | 1) => {
      const target = index + dir;
      if (target < 0 || target >= total) return null;
      const list = qc.getQueryData<{ items: PortfolioItemDTO[] }>(['portfolio', 'all']);
      const neighbor = list?.items[target];
      if (!neighbor) return null;
      await api.updatePortfolioItem(item.id, { sortOrder: neighbor.sortOrder });
      await api.updatePortfolioItem(neighbor.id, { sortOrder: item.sortOrder });
      return true;
    },
    onSuccess: (ok) => {
      if (ok) {
        invalidate();
      }
    },
    onError: (e: Error) => toast({ title: 'خطا در جابه‌جایی', description: e.message, variant: 'destructive' }),
  });

  const iconBtn =
    'h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent';

  return (
    <Card className="overflow-hidden">
      <div className="aspect-video bg-muted relative">
        {item.image ? (
          <img src={item.image} alt={`نمونه‌کار ${item.title}`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute top-2 start-2 flex gap-1">
          <Badge className="text-[10px] bg-black/50 text-white border-0 backdrop-blur">
            {CATEGORY_LABEL[item.category] ?? 'فضا'}
          </Badge>
          {item.visible ? (
            <Badge variant="secondary" className="text-[10px] gap-1 bg-emerald-600/90 text-white border-0">
              <Eye className="h-2.5 w-2.5" /> نمایش
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] gap-1 bg-black/50 text-white border-0 backdrop-blur">
              <EyeOff className="h-2.5 w-2.5" /> پنهان
            </Badge>
          )}
        </div>
      </div>
      <CardContent className="p-3 space-y-2">
        <p className="font-semibold text-sm truncate">{item.title}</p>
        {item.description && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{item.description}</p>
        )}
        <div className="flex items-center justify-between gap-1 pt-1">
          <div className="flex items-center gap-0.5">
            <Button
              size="icon"
              variant="ghost"
              className={iconBtn}
              onClick={() => move.mutate(-1)}
              disabled={index === 0 || move.isPending}
              aria-label={`انتقال ${item.title} به عقب در ترتیب`}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={iconBtn}
              onClick={() => move.mutate(1)}
              disabled={index === total - 1 || move.isPending}
              aria-label={`انتقال ${item.title} به جلو در ترتیب`}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={iconBtn}
              onClick={() => toggle.mutate()}
              disabled={toggle.isPending}
              aria-label={item.visible ? `پنهان کردن ${item.title}` : `نمایش ${item.title}`}
            >
              {item.visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex items-center gap-0.5">
            <Button size="icon" variant="ghost" className={iconBtn} onClick={() => onEdit(item)} aria-label={`ویرایش ${item.title}`}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={`${iconBtn} hover:text-destructive hover:bg-destructive/10`}
              onClick={() => setDelOpen(true)}
              aria-label={`حذف ${item.title}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>

      <AlertDialog open={delOpen} onOpenChange={setDelOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف نمونه‌کار؟</AlertDialogTitle>
            <AlertDialogDescription>
              «{item.title}» برای همیشه از لیست نمونه‌کارها حذف می‌شود. این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => del.mutate()}
            >
              حذف کن
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ---------- پنل کامل ----------
export function PortfolioManager() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dlg, setDlg] = useState<{ open: boolean; item?: PortfolioItemDTO }>({ open: false });

  const itemsQ = useQuery({
    queryKey: ['portfolio', 'all'],
    queryFn: () => api.listPortfolio(true),
  });

  const create = useMutation({
    mutationFn: (v: { title: string; description: string; category: string; image: string; visible: boolean }) =>
      api.createPortfolioItem(v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio'] });
      setDlg({ open: false });
      toast({ title: 'نمونه‌کار اضافه شد ✓' });
    },
    onError: (e: Error) => toast({ title: 'خطا در ذخیره', description: e.message, variant: 'destructive' }),
  });

  const update = useMutation({
    mutationFn: ({ id, ...v }: { id: string } & { title: string; description: string; category: string; image: string; visible: boolean }) =>
      api.updatePortfolioItem(id, v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio'] });
      setDlg({ open: false });
      toast({ title: 'نمونه‌کار به‌روزرسانی شد ✓' });
    },
    onError: (e: Error) => toast({ title: 'خطا در ذخیره', description: e.message, variant: 'destructive' }),
  });

  const items = itemsQ.data?.items ?? [];
  const visibleCount = items.filter((i) => i.visible).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-bold flex items-center gap-2">
            <Images className="h-5 w-5 text-primary" /> مدیریت نمونه‌کارها
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            این موارد در صفحه اصلی عمومی (لندینگ مشتری) نمایش داده می‌شوند —{' '}
            <span className="tabular-nums">{visibleCount.toLocaleString('fa-IR')} مورد نمایش</span> از{' '}
            <span className="tabular-nums">{items.length.toLocaleString('fa-IR')} مورد</span>
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setDlg({ open: true })}>
          <Plus className="h-4 w-4" /> نمونه‌کار جدید
        </Button>
      </div>

      {itemsQ.isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border bg-card overflow-hidden">
              <div className="aspect-video bg-muted animate-pulse" />
              <div className="p-3 space-y-2">
                <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
                <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center space-y-2">
          <Images className="h-10 w-10 mx-auto text-muted-foreground/30" />
          <p className="text-sm font-medium">هنوز نمونه‌کاری ندارید</p>
          <p className="text-xs text-muted-foreground">
            با «نمونه‌کار جدید» تصویر و توضیح کارهای خود را برای صفحه اصلی اضافه کنید
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it, i) => (
            <ManagerCard
              key={it.id}
              item={it}
              index={i}
              total={items.length}
              onEdit={(item) => setDlg({ open: true, item })}
            />
          ))}
        </div>
      )}

      {dlg.open && (
        <ItemDialog
          initial={dlg.item}
          saving={create.isPending || update.isPending}
          onCancel={() => setDlg({ open: false })}
          onSave={(v) => {
            if (dlg.item) update.mutate({ id: dlg.item.id, ...v });
            else create.mutate(v);
          }}
        />
      )}
    </div>
  );
}
