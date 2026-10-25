'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Boxes,
  CalendarClock,
  Camera,
  CheckCircle2,
  ChevronDown,
  Contact,
  FilePlus2,
  FolderInput,
  FolderPlus,
  Folder as FolderIcon,
  Globe,
  Image as ImageIcon,
  Images,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  MoreVertical,
  Pencil,
  Phone,
  Ruler,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  SquarePen,
  Trash2,
  UploadCloud,
  User,
  Users,
  Video,
  X,
} from 'lucide-react';
import { api, type FolderDTO, type ProjectDTO, type ProjectCrmFields } from '@/lib/api';
import { fileToResizedDataUrl, videoToFrames } from '@/lib/image-utils';
import { formatFaDate, relativeFa, isoToLocalInput, localInputToIso } from '@/lib/format';
import { SAMPLE_ROOM_SPEC, SAMPLE_SCENE } from '@/lib/sample-room';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import SiteLanding, { SiteFooter } from './site-landing';
import { PortfolioManager } from './portfolio-manager';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShareDialog } from '@/components/editor/share-dialog';

// ============================================================
// CRM — دیالوگ مشترک مشتری و زمان‌بندی
// ============================================================
interface CrmSave extends ProjectCrmFields {
  name?: string;
}

function CrmDialog({
  title,
  initial,
  withName,
  saving,
  onSave,
  onCancel,
}: {
  title: string;
  initial: {
    name?: string;
    clientName?: string | null;
    clientPhone?: string | null;
    address?: string | null;
    visitAt?: string | null;
    installAt?: string | null;
    dueAt?: string | null;
  };
  withName?: boolean;
  saving: boolean;
  onSave: (v: CrmSave) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name ?? '');
  const [clientName, setClientName] = useState(initial.clientName ?? '');
  const [clientPhone, setClientPhone] = useState(initial.clientPhone ?? '');
  const [address, setAddress] = useState(initial.address ?? '');
  const [visitAt, setVisitAt] = useState(isoToLocalInput(initial.visitAt));
  const [installAt, setInstallAt] = useState(isoToLocalInput(initial.installAt));
  const [dueAt, setDueAt] = useState(isoToLocalInput(initial.dueAt));

  const submit = () =>
    onSave({
      ...(withName ? { name } : {}),
      clientName,
      clientPhone,
      address,
      visitAt: localInputToIso(visitAt),
      installAt: localInputToIso(installAt),
      dueAt: localInputToIso(dueAt),
    });

  return (
    <Dialog open onOpenChange={(v) => !v && onCancel()}>
      <DialogContent dir="rtl" className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {withName && (
            <div className="space-y-1">
              <Label className="text-xs">نام پروژه</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: آشپزخانه آقای رضایی" maxLength={80} autoFocus />
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">نام مشتری</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="مثلاً: آقای محمدی" maxLength={80} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">شماره تماس</Label>
              <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} dir="ltr" className="text-start" placeholder="0912…" maxLength={30} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">آدرس</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="نشانی محل اجرا" maxLength={300} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">زمان بازدید</Label>
              <Input type="datetime-local" value={visitAt} onChange={(e) => setVisitAt(e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">زمان اجرا و پیاده‌سازی</Label>
              <Input type="datetime-local" value={installAt} onChange={(e) => setInstallAt(e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">زمان اتمام</Label>
              <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="h-9 text-xs" />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">فیلدهای خالی نادیده گرفته می‌شوند — همه اطلاعات اختیاری است.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>انصراف</Button>
          <Button onClick={submit} disabled={saving || (withName && !name.trim())}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} ذخیره
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// پنل مدیریت
// ============================================================
const ROOM_TYPE_LABEL: Record<string, string> = {
  kitchen: 'آشپزخانه',
  bedroom: 'اتاق خواب',
  living: 'نشیمن',
  dining: 'ناهارخوری',
  bathroom: 'سرویس',
  office: 'اتاق کار',
  other: 'سایر',
};

const ROLE_FA: Record<string, string> = { viewer: 'نمایشگر', modifier: 'ویرایشگر' };

function StatCard({ icon: Icon, label, value }: { icon: typeof FolderIcon; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-black tabular-nums leading-none">{value.toLocaleString('fa-IR')}</p>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminPanel() {
  const { toast } = useToast();
  const statsQ = useQuery({ queryKey: ['admin-stats'], queryFn: api.adminStats, staleTime: 15_000 });

  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [rep, setRep] = useState('');

  const changePw = useMutation({
    mutationFn: () => api.changePassword(cur, nw),
    onSuccess: () => {
      toast({ title: 'رمز تغییر کرد' });
      setCur('');
      setNw('');
      setRep('');
    },
    onError: (e: Error) =>
      toast({ title: 'تغییر رمز ناموفق بود', description: e.message, variant: 'destructive' }),
  });

  const pwError =
    nw.length > 0 && nw.length < 4
      ? 'رمز جدید حداقل ۴ کاراکتر باشد'
      : rep.length > 0 && nw !== rep
        ? 'تکرار رمز با رمز جدید مطابقت ندارد'
        : '';

  if (statsQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (statsQ.isError || !statsQ.data) {
    return (
      <div className="py-16 text-center space-y-2">
        <p className="text-sm text-destructive">{(statsQ.error as Error)?.message ?? 'دریافت آمار ناموفق بود'}</p>
        <Button variant="outline" size="sm" onClick={() => statsQ.refetch()}>تلاش دوباره</Button>
      </div>
    );
  }

  const { stats, roomTypes, recentGuests, upcoming } = statsQ.data;

  return (
    <div className="space-y-6">
      {/* کارت‌های آمار */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={FolderIcon} label="پروژه‌ها" value={stats.projects} />
        <StatCard icon={Boxes} label="پوشه‌ها" value={stats.folders} />
        <StatCard icon={Users} label="مهمان‌ها" value={stats.guests} />
        <StatCard icon={Send} label="لینک‌های فعال" value={stats.activeShareLinks} />
        <StatCard icon={Globe} label="نمونه‌کارهای عمومی" value={stats.publicProjects} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* زمان‌بندی پیش‌رو */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-bold flex items-center gap-2 text-sm">
              <CalendarClock className="h-4.5 w-4.5 text-primary" /> زمان‌بندی پیش‌رو
            </h3>
            {upcoming.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                بازدید، اجرا یا اتمامی در ۴۵ روز آینده ثبت نشده است
              </p>
            ) : (
              <ul className="divide-y">
                {upcoming.map((u) => (
                  <li key={u.id} className="py-2.5 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{u.name}</p>
                      {u.clientName && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" /> {u.clientName}
                        </span>
                      )}
                      {u.clientPhone && (
                        <span dir="ltr" className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {u.clientPhone}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[10px]">
                      {u.visitAt && (
                        <Badge className="bg-amber-100 text-amber-900 border-amber-200 h-5 px-2">
                          بازدید: {formatFaDate(u.visitAt)}
                        </Badge>
                      )}
                      {u.installAt && (
                        <Badge className="bg-emerald-100 text-emerald-900 border-emerald-200 h-5 px-2">
                          اجرا: {formatFaDate(u.installAt)}
                        </Badge>
                      )}
                      {u.dueAt && (
                        <Badge className="bg-stone-200 text-stone-800 border-stone-300 h-5 px-2">
                          اتمام: {formatFaDate(u.dueAt)}
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* مهمان‌های اخیر */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-bold flex items-center gap-2 text-sm">
              <Users className="h-4.5 w-4.5 text-primary" /> مهمان‌های اخیر
            </h3>
            {recentGuests.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">هنوز بازدیدکننده‌ای نداشته‌اید</p>
            ) : (
              <ul className="divide-y">
                {recentGuests.map((g) => (
                  <li key={g.id} className="py-2 flex items-center gap-2 flex-wrap">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: g.color }}
                      aria-hidden
                    />
                    <span className="text-sm font-medium">{g.name}</span>
                    {g.projectName && (
                      <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                        {g.projectName}
                      </span>
                    )}
                    <span className="ms-auto flex items-center gap-1.5">
                      <Badge variant={g.role === 'modifier' ? 'secondary' : 'outline'} className="text-[10px] h-5">
                        {ROLE_FA[g.role] ?? g.role}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{relativeFa(g.lastSeenAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* تغییر رمز مدیر */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-bold flex items-center gap-2 text-sm">
              <KeyRound className="h-4.5 w-4.5 text-primary" /> تغییر رمز مدیر
            </h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">رمز فعلی</Label>
                <Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">رمز جدید</Label>
                <Input type="password" value={nw} onChange={(e) => setNw(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">تکرار رمز جدید</Label>
                <Input type="password" value={rep} onChange={(e) => setRep(e.target.value)} className="h-9" />
              </div>
            </div>
            {pwError && <p className="text-xs text-destructive">{pwError}</p>}
            <Button
              size="sm"
              className="gap-1.5"
              disabled={!cur || nw.length < 4 || nw !== rep || changePw.isPending}
              onClick={() => changePw.mutate()}
            >
              {changePw.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              ذخیره رمز جدید
            </Button>
          </CardContent>
        </Card>

        {/* انواع فضا */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-bold flex items-center gap-2 text-sm">
              <Box className="h-4.5 w-4.5 text-primary" /> انواع فضاها
            </h3>
            {Object.keys(roomTypes).length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">هنوز پروژه‌ای ثبت نشده است</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(roomTypes).map(([t, n]) => (
                  <Badge key={t} variant="outline" className="gap-1.5 h-7 px-3 text-xs">
                    {ROOM_TYPE_LABEL[t] ?? t}
                    <span className="tabular-nums text-primary font-bold">{n.toLocaleString('fa-IR')}</span>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// پوشش پیشرفت بازسازی (استریم زنده)
// ============================================================
function ReconstructOverlay({
  steps,
  step,
  percent,
  message,
}: {
  steps: string[];
  step: number;
  percent: number;
  message: string;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-primary animate-pulse" />
            <div>
              <p className="font-semibold">بازسازی سه‌بعدی در جریان است</p>
              <p className="text-xs text-muted-foreground">فضای واقعی شما با تجهیزاتش بازسازی می‌شود</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2.5 text-sm">
                {i < step ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : i === step ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                ) : (
                  <span className="h-4 w-4 rounded-full border-2 border-muted-foreground/25 shrink-0" />
                )}
                <span className={i <= step ? 'text-foreground' : 'text-muted-foreground/60'}>{s}</span>
              </div>
            ))}
          </div>
          {message && (
            <p className="text-xs text-primary bg-primary/5 border border-primary/15 rounded-md px-3 py-2 leading-relaxed" aria-live="polite">
              {message}
            </p>
          )}
          <div className="space-y-1.5">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${Math.min(100, Math.max(4, percent))}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-center tabular-nums">
              {Math.round(percent).toLocaleString('fa-IR')}٪
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// کارت آپلود (چند عکس + ویدیو + پلان اختیاری) با پیشرفت زنده
// ============================================================
interface Shot {
  key: string;
  src: string;
}

const MAX_SHOTS = 8;

function UploadCard({ folderId }: { folderId: string | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const planRef = useRef<HTMLInputElement>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [videoKey, setVideoKey] = useState<string | null>(null);
  const [floorPlan, setFloorPlan] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [recSteps, setRecSteps] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ step: number; percent: number; message: string } | null>(null);
  const stepsRef = useRef<string[]>([]);

  const buildSteps = (hasPlan: boolean) => {
    const steps = ['ارسال تصاویر به موتور هوش مصنوعی...'];
    if (hasPlan) steps.push('خواندن پلان خانه برای ابعاد دقیق...');
    steps.push('تحلیل عکس‌ها و تشخیص فضا و تجهیزات...');
    steps.push('ادغام نتایج چند زاویه...');
    steps.push('ساخت مش سه‌بعدی ویرایش‌پذیر...');
    return steps;
  };

  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) {
      toast({ title: 'فقط تصویر مجاز است', variant: 'destructive' });
      return;
    }
    try {
      const remaining = MAX_SHOTS - shots.length;
      if (remaining <= 0) {
        toast({ title: `حداکثر ${MAX_SHOTS.toLocaleString('fa-IR')} عکس مجاز است`, variant: 'destructive' });
        return;
      }
      const urls = await Promise.all(imgs.slice(0, remaining).map((f) => fileToResizedDataUrl(f)));
      setShots((prev) => {
        const merged = [
          ...prev.filter((s) => s.key !== videoKey || !videoKey),
          ...urls.map((src, i) => ({ key: `img-${Date.now()}-${i}`, src })),
        ];
        return merged.slice(0, MAX_SHOTS);
      });
    } catch {
      toast({ title: 'خواندن تصویر ناموفق بود', variant: 'destructive' });
    }
  };

  const addVideo = async (f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('video/')) {
      toast({ title: 'فایل ویدیویی معتبر نیست', variant: 'destructive' });
      return;
    }
    try {
      toast({ title: 'در حال استخراج فریم‌های ویدیو...' });
      const frames = await videoToFrames(f, 3);
      const vk = `vid-${Date.now()}`;
      setVideoKey(vk);
      setShots((prev) =>
        [...prev.filter((s) => !s.key.startsWith('vid-')), ...frames.map((src, i) => ({ key: `${vk}-${i}`, src }))].slice(0, MAX_SHOTS)
      );
    } catch (e) {
      toast({
        title: 'استخراج فریم ناموفق بود',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const addFloorPlan = async (f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast({ title: 'پلان باید تصویر باشد', variant: 'destructive' });
      return;
    }
    try {
      setFloorPlan(await fileToResizedDataUrl(f, 1600));
    } catch {
      toast({ title: 'خواندن پلان ناموفق بود', variant: 'destructive' });
    }
  };

  const reconstruct = useMutation({
    mutationFn: async () => {
      if (!shots.length) throw new Error('حداقل یک عکس یا ویدیو انتخاب کنید');
      const hasPlan = !!floorPlan;
      const steps = buildSteps(hasPlan);
      stepsRef.current = steps;
      setRecSteps(steps);
      setProgress({ step: 0, percent: 5, message: '' });
      const idx = {
        floorplan: hasPlan ? 1 : 0,
        analyze: hasPlan ? 2 : 1,
        merge: hasPlan ? 3 : 2,
      };
      return api.reconstructStream(
        shots.map((s) => s.src),
        floorPlan,
        (p) => {
          if (p.stage === 'floorplan') {
            setProgress({ step: idx.floorplan, percent: 10, message: p.message });
          } else if (p.stage === 'analyze') {
            const frac = p.total ? Math.min(1, (p.index ?? 0) / p.total) : 0;
            setProgress({ step: idx.analyze, percent: 15 + frac * 65, message: p.message });
          } else if (p.stage === 'merge') {
            setProgress({ step: idx.merge, percent: 85, message: p.message });
          } else {
            setProgress((prev) => ({
              step: prev?.step ?? 0,
              percent: prev?.percent ?? 5,
              message: p.message,
            }));
          }
        },
      );
    },
    onSuccess: async (res) => {
      // گام آخر فقط بعد از موفقیت کامل می‌شود — هرگز قبل از آن گیر نمی‌کند
      setProgress({ step: stepsRef.current.length - 1, percent: 100, message: '' });
      const created = await api.createProject({
        name: name.trim() || 'پروژه بازسازی‌شده',
        roomType: res.roomType,
        roomSpec: res.roomSpec,
        sceneState: { objects: res.objects },
        folderId,
      });
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast({
        title: 'مدل سه‌بعدی ساخته شد ✓',
        description: res.objects.length
          ? `${res.objects.length.toLocaleString('fa-IR')} قطعه تجهیزات/کابینت موجود شناسایی شد`
          : res.description || undefined,
      });
      window.location.hash = `/editor/${created.project.id}`;
    },
    onError: (e: Error) => {
      setProgress(null);
      setRecSteps([]);
      toast({
        title: 'بازسازی ناموفق بود',
        description: `${e.message} — می‌توانید با فضای نمونه شروع کنید`,
        variant: 'destructive',
      });
    },
  });

  const startSample = useMutation({
    mutationFn: () =>
      api.createProject({
        name: name.trim() || 'آشپزخانه نمونه',
        roomType: 'kitchen',
        roomSpec: SAMPLE_ROOM_SPEC,
        sceneState: SAMPLE_SCENE,
        folderId,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      window.location.hash = `/editor/${res.project.id}`;
    },
    onError: (e: Error) =>
      toast({ title: 'خطا', description: e.message, variant: 'destructive' }),
  });

  return (
    <Card className="w-full">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          <h2 className="font-bold">بازسازی دقیق فضا از عکس یا ویدیو</h2>
        </div>

        <input
          ref={imgRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addImages(e.target.files);
            e.target.value = '';
          }}
          aria-hidden
        />
        <input
          ref={vidRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            addVideo(e.target.files?.[0]);
            e.target.value = '';
          }}
          aria-hidden
        />
        <input
          ref={planRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            addFloorPlan(e.target.files?.[0]);
            e.target.value = '';
          }}
          aria-hidden
        />

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
            addImages(e.dataTransfer.files);
          }}
          className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary/60 bg-muted/30 transition-colors p-6 flex flex-col items-center gap-2 cursor-pointer group min-h-[120px] justify-center outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label="انتخاب عکس‌های فضا"
        >
          {shots.length === 0 ? (
            <>
              <UploadCloud className="h-9 w-9 text-muted-foreground/50 group-hover:text-primary transition-colors" />
              <p className="text-sm font-medium">چند عکس از زوایای مختلف بکشید یا انتخاب کنید</p>
              <p className="text-xs text-muted-foreground">
                روبه‌رو، چپ و راست — پوشش کامل ۳۶۰ درجه لازم نیست
              </p>
            </>
          ) : (
            <div className="grid grid-cols-4 gap-2 w-full">
              {shots.map((s) => (
                <div key={s.key} className="relative group/th rounded-lg overflow-hidden border">
                  <img src={s.src} alt="نمای آپلودشده فضا" className="w-full h-16 object-cover" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShots((prev) => prev.filter((x) => x.key !== s.key));
                    }}
                    className="absolute top-1 end-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover/th:opacity-100 transition-opacity"
                    aria-label="حذف تصویر"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {shots.length < MAX_SHOTS && (
                <div className="h-16 rounded-lg border border-dashed flex flex-col items-center justify-center text-[10px] text-muted-foreground gap-0.5">
                  <ImageIcon className="h-4 w-4" />
                  افزودن (تا {(MAX_SHOTS - shots.length).toLocaleString('fa-IR')})
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={() => imgRef.current?.click()}
            disabled={shots.length >= MAX_SHOTS}
          >
            <ImageIcon className="h-3.5 w-3.5" /> عکس‌های بیشتر
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={() => vidRef.current?.click()}
            disabled={shots.length >= MAX_SHOTS - 1}
          >
            <Video className="h-3.5 w-3.5" /> آپلود ویدیو
          </Button>
        </div>

        {/* پلان خانه — اختیاری */}
        {floorPlan ? (
          <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-2">
            <img src={floorPlan} alt="پلان خانه" className="h-14 w-20 object-cover rounded-lg border shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium flex items-center gap-1.5">
                <Ruler className="h-3.5 w-3.5 text-primary" /> پلان خانه افزوده شد
              </p>
              <p className="text-[10px] text-muted-foreground">ابعاد از روی پلان خوانده می‌شود</p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              onClick={() => setFloorPlan(null)}
              aria-label="حذف پلان"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={() => planRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                planRef.current?.click();
              }
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFloorPlan(e.dataTransfer.files?.[0]);
            }}
            className="w-full rounded-xl border-2 border-dashed border-primary/25 hover:border-primary/60 bg-primary/5 transition-colors p-3 flex items-center gap-3 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="افزودن پلان خانه (اختیاری)"
          >
            <Ruler className="h-6 w-6 text-primary/60 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium">پلان خانه (اختیاری — برای دقت بیشتر)</p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                لازم نیست همیشه پلان بدهید — فقط وقتی عکس پلان دارید اضافه کنید تا ابعاد دقیق‌تر شود
              </p>
            </div>
          </div>
        )}

        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="نام پروژه (اختیاری)"
          maxLength={80}
        />

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            className="flex-1 gap-2 h-11"
            onClick={() => reconstruct.mutate()}
            disabled={!shots.length || reconstruct.isPending}
          >
            <Sparkles className="h-4 w-4" />
            {reconstruct.isPending ? 'در حال بازسازی...' : 'بازسازی سه‌بعدی با AI'}
          </Button>
          <Button
            variant="outline"
            className="sm:w-auto gap-2 h-11"
            onClick={() => startSample.mutate()}
            disabled={startSample.isPending}
          >
            <Boxes className="h-4 w-4" />
            فضای نمونه
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          AI دیوارها، بازشوها و تجهیزات موجود (کابینت، یخچال، اجاق، هود، مبلمان) را تشخیص می‌دهد و مدل
          سه‌بعدی تقریبی اما قابل ویرایش می‌سازد.
        </p>
      </CardContent>

      {progress && (
        <ReconstructOverlay
          steps={recSteps}
          step={progress.step}
          percent={progress.percent}
          message={progress.message}
        />
      )}
    </Card>
  );
}

// ============================================================
// دیالوگ پوشه
// ============================================================
function FolderDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: { id?: string; name?: string };
  onSave: (name: string) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial?.id ? 'تغییر نام پوشه' : 'پوشه جدید'}</DialogTitle>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="مثلاً: خانه آقای رضایی"
          maxLength={60}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) onSave(name.trim());
          }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>انصراف</Button>
          <Button onClick={() => name.trim() && onSave(name.trim())} disabled={!name.trim() || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} ذخیره
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// نوار پوشه‌ها
// ============================================================
function FolderBar({
  folders,
  selected,
  onSelect,
  currentFolderId,
}: {
  folders: FolderDTO[];
  selected: FolderFilter;
  onSelect: (f: FolderFilter) => void;
  currentFolderId: string | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dlgOpen, setDlgOpen] = useState(false);
  const [editing, setEditing] = useState<{ id?: string; name?: string } | undefined>();
  const [newOpen, setNewOpen] = useState(false);

  const createFolder = useMutation({
    mutationFn: (name: string) => api.createFolder(name),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['folders'] });
      setDlgOpen(false);
      onSelect({ kind: 'folder', id: res.folder.id });
      toast({ title: `پوشه «${res.folder.name}» ساخته شد` });
    },
    onError: (e: Error) => toast({ title: 'خطا', description: e.message, variant: 'destructive' }),
  });

  const renameFolder = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.renameFolder(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      setDlgOpen(false);
      toast({ title: 'نام پوشه تغییر کرد' });
    },
    onError: (e: Error) => toast({ title: 'خطا', description: e.message, variant: 'destructive' }),
  });

  const deleteFolder = useMutation({
    mutationFn: (id: string) => api.deleteFolder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      onSelect({ kind: 'all' });
      toast({ title: 'پوشه حذف شد', description: 'پروژه‌های آن بدون پوشه شدند' });
    },
    onError: (e: Error) => toast({ title: 'خطا', description: e.message, variant: 'destructive' }),
  });

  const chip = (active: boolean) =>
    `h-9 px-3 rounded-full border text-xs font-medium flex items-center gap-1.5 transition-colors touch-manipulation ${
      active
        ? 'bg-primary text-primary-foreground border-primary'
        : 'bg-card hover:bg-accent/60 border-border'
    }`;

  const newProject = useMutation({
    mutationFn: (crm: CrmSave) =>
      api.createProject({
        name: crm.name?.trim() || 'پروژه جدید',
        roomSpec: {
          widthM: 4, depthM: 3.4, heightM: 2.8,
          wallColor: '#ece7dd', floorColor: '#a97c50', ceilingColor: '#fafafa',
          windows: [], doorways: [],
        },
        folderId: currentFolderId,
        clientName: crm.clientName,
        clientPhone: crm.clientPhone,
        address: crm.address,
        visitAt: crm.visitAt,
        installAt: crm.installAt,
        dueAt: crm.dueAt,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['folders'] });
      window.location.hash = `/editor/${res.project.id}`;
    },
    onError: (e: Error) => toast({ title: 'خطا', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={chip(selected.kind === 'all')} onClick={() => onSelect({ kind: 'all' })}>
        <Boxes className="h-3.5 w-3.5" /> همه
      </button>
      <button type="button" className={chip(selected.kind === 'none')} onClick={() => onSelect({ kind: 'none' })}>
        <FolderIcon className="h-3.5 w-3.5 opacity-50" /> بدون پوشه
      </button>
      {folders.map((f) => (
        <div key={f.id} className="flex items-center">
          <button
            type="button"
            className={`${chip(selected.kind === 'folder' && selected.id === f.id)} rounded-s-full`}
            onClick={() => onSelect({ kind: 'folder', id: f.id })}
          >
            <FolderIcon className="h-3.5 w-3.5" />
            {f.name}
            {typeof f.projectCount === 'number' && (
              <span className="opacity-70">({f.projectCount.toLocaleString('fa-IR')})</span>
            )}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`${chip(false)} rounded-e-full !px-1.5 !-ms-px`}
                aria-label={`گزینه‌های پوشه ${f.name}`}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => { setEditing({ id: f.id, name: f.name }); setDlgOpen(true); }}>
                <Pencil className="h-3.5 w-3.5" /> تغییر نام
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => deleteFolder.mutate(f.id)}
              >
                <Trash2 className="h-3.5 w-3.5" /> حذف پوشه
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="h-9 rounded-full gap-1.5 text-xs"
        onClick={() => { setEditing(undefined); setDlgOpen(true); }}
      >
        <FolderPlus className="h-3.5 w-3.5" /> پوشه جدید
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-9 rounded-full gap-1.5 text-xs"
        onClick={() => setNewOpen(true)}
        disabled={newProject.isPending}
      >
        <FilePlus2 className="h-3.5 w-3.5" /> پروژه جدید
      </Button>

      {dlgOpen && (
        <FolderDialog
          open
          onOpenChange={setDlgOpen}
          initial={editing}
          saving={createFolder.isPending || renameFolder.isPending}
          onSave={(name) =>
            editing?.id ? renameFolder.mutate({ id: editing.id, name }) : createFolder.mutate(name)
          }
        />
      )}

      {newOpen && (
        <CrmDialog
          title="پروژه جدید"
          initial={{}}
          withName
          saving={newProject.isPending}
          onSave={(crm) => newProject.mutate(crm)}
          onCancel={() => setNewOpen(false)}
        />
      )}
    </div>
  );
}

type FolderFilter = { kind: 'all' } | { kind: 'none' } | { kind: 'folder'; id: string };

// ============================================================
// کارت پروژه — با بج‌های CRM و دیالوگ مشتری/زمان‌بندی
// ============================================================
function ProjectCard({
  project,
  folders,
}: {
  project: ProjectDTO;
  folders: FolderDTO[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [crmOpen, setCrmOpen] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['projects'] });
    qc.invalidateQueries({ queryKey: ['folders'] });
  };

  const del = useMutation({
    mutationFn: () => api.deleteProject(project.id),
    onSuccess: () => {
      invalidate();
      toast({ title: 'پروژه حذف شد' });
    },
    onError: (e: Error) => toast({ title: 'خطا در حذف', description: e.message, variant: 'destructive' }),
  });

  const togglePublic = useMutation({
    mutationFn: () => api.patchProject(project.id, { isPublic: !project.isPublic }),
    onSuccess: () => {
      invalidate();
      toast({ title: project.isPublic ? 'پروژه خصوصی شد' : 'پروژه عمومی شد (نمونه‌کار)' });
    },
    onError: (e: Error) => toast({ title: 'خطا', description: e.message, variant: 'destructive' }),
  });

  const moveToFolder = useMutation({
    mutationFn: (folderId: string | null) => api.patchProject(project.id, { folderId }),
    onSuccess: () => {
      invalidate();
      toast({ title: 'پروژه منتقل شد' });
    },
    onError: (e: Error) => toast({ title: 'خطا', description: e.message, variant: 'destructive' }),
  });

  const saveCrm = useMutation({
    mutationFn: (crm: CrmSave) =>
      api.patchProject(project.id, {
        clientName: crm.clientName ?? '',
        clientPhone: crm.clientPhone ?? '',
        address: crm.address ?? '',
        visitAt: crm.visitAt ?? null,
        installAt: crm.installAt ?? null,
        dueAt: crm.dueAt ?? null,
      }),
    onSuccess: () => {
      invalidate();
      setCrmOpen(false);
      toast({ title: 'اطلاعات مشتری ذخیره شد ✓' });
    },
    onError: (e: Error) => toast({ title: 'خطا در ذخیره', description: e.message, variant: 'destructive' }),
  });

  return (
    <Card className="overflow-hidden group hover:shadow-lg transition-shadow">
      <button
        type="button"
        className="block w-full text-start"
        onClick={() => (window.location.hash = `/editor/${project.id}`)}
        aria-label={`باز کردن ${project.name}`}
      >
        <div className="h-36 bg-muted relative overflow-hidden">
          {project.thumbnail ? (
            <img
              src={project.thumbnail}
              alt={`تصویر پروژه ${project.name}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
            </div>
          )}
          <div className="absolute top-2 start-2 flex gap-1">
            <Badge className="text-[10px]">
              {project.roomType === 'kitchen' ? 'آشپزخانه' : project.roomType === 'bedroom' ? 'اتاق خواب' : 'فضا'}
            </Badge>
            {project.isPublic ? (
              <Badge variant="secondary" className="text-[10px] gap-1 bg-emerald-600/90 text-white border-0">
                <Globe className="h-2.5 w-2.5" /> عمومی
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] gap-1 bg-black/45 text-white border-0 backdrop-blur">
                <Lock className="h-2.5 w-2.5" /> خصوصی
              </Badge>
            )}
          </div>
        </div>
      </button>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{project.name}</p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              {project.folderName && (
                <>
                  <FolderIcon className="h-3 w-3" /> {project.folderName} •
                </>
              )}
              {new Date(project.updatedAt).toLocaleDateString('fa-IR')}
              {typeof project.shareCount === 'number' && project.shareCount > 0 && ` • ${project.shareCount.toLocaleString('fa-IR')} لینک`}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                aria-label={`گزینه‌های ${project.name}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => setCrmOpen(true)}>
                <Contact className="h-3.5 w-3.5" /> اطلاعات مشتری و زمان‌بندی…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => togglePublic.mutate()}>
                {project.isPublic ? (
                  <>
                    <Lock className="h-3.5 w-3.5" /> خصوصی کردن
                  </>
                ) : (
                  <>
                    <Globe className="h-3.5 w-3.5" /> عمومی کردن (نمونه‌کار)
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2">
                  <FolderInput className="h-3.5 w-3.5" /> انتقال به پوشه
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-60 overflow-y-auto">
                  <DropdownMenuItem onClick={() => moveToFolder.mutate(null)}>
                    <FolderIcon className="h-3.5 w-3.5 opacity-50" /> بدون پوشه
                  </DropdownMenuItem>
                  {folders.map((f) => (
                    <DropdownMenuItem
                      key={f.id}
                      disabled={f.id === project.folderId}
                      onClick={() => moveToFolder.mutate(f.id)}
                    >
                      <FolderIcon className="h-3.5 w-3.5" /> {f.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" /> حذف پروژه
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* بج‌های CRM */}
        {(project.clientName || project.clientPhone || project.address) && (
          <div className="flex flex-wrap gap-1">
            {project.clientName && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1 font-normal">
                <User className="h-2.5 w-2.5" /> {project.clientName}
              </Badge>
            )}
            {project.clientPhone && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1 font-normal font-mono" dir="ltr">
                <Phone className="h-2.5 w-2.5" /> {project.clientPhone}
              </Badge>
            )}
            {project.address && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1 font-normal max-w-full">
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate max-w-[150px]">{project.address}</span>
              </Badge>
            )}
          </div>
        )}

        {/* زمان‌بندی */}
        {(project.visitAt || project.installAt || project.dueAt) && (
          <div className="flex flex-wrap gap-1">
            {project.visitAt && (
              <Badge className="bg-amber-100 text-amber-900 border-amber-200 text-[10px] h-5 px-1.5 font-normal">
                بازدید: {formatFaDate(project.visitAt)}
              </Badge>
            )}
            {project.installAt && (
              <Badge className="bg-emerald-100 text-emerald-900 border-emerald-200 text-[10px] h-5 px-1.5 font-normal">
                اجرا: {formatFaDate(project.installAt)}
              </Badge>
            )}
            {project.dueAt && (
              <Badge className="bg-stone-200 text-stone-800 border-stone-300 text-[10px] h-5 px-1.5 font-normal">
                اتمام: {formatFaDate(project.dueAt)}
              </Badge>
            )}
          </div>
        )}

        <div className="flex gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant="secondary"
            className="h-8 gap-1 text-xs flex-1"
            onClick={() => (window.location.hash = `/editor/${project.id}`)}
          >
            <SquarePen className="h-3.5 w-3.5" /> ویرایش
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setShareOpen(true)}>
            <Share2 className="h-3.5 w-3.5" /> اشتراک
          </Button>
        </div>
      </CardContent>

      <ShareDialog projectId={project.id} open={shareOpen} onOpenChange={setShareOpen} />

      {crmOpen && (
        <CrmDialog
          title={`مشتری و زمان‌بندی — ${project.name}`}
          initial={project}
          saving={saveCrm.isPending}
          onSave={(crm) => saveCrm.mutate(crm)}
          onCancel={() => setCrmOpen(false)}
        />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف پروژه؟</AlertDialogTitle>
            <AlertDialogDescription>
              «{project.name}» و همه لینک‌های اشتراکی آن برای همیشه حذف می‌شود. این عمل قابل بازگشت نیست.
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

// ============================================================
// نمای خانه — لندینگ عمومی (پیش‌فرض) + داشبورد مدیر با تب‌ها
// ============================================================
export default function HomeView() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const sessionQ = useQuery({ queryKey: ['session'], queryFn: api.session, staleTime: 60_000 });

  // نما: site (لندینگ عمومی) | dashboard (پنل مدیر) — در نشست مرورگر حفظ می‌شود
  const [view, setView] = useState<'site' | 'dashboard'>(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('c3d_view') === 'dashboard') {
      return 'dashboard';
    }
    return 'site';
  });
  useEffect(() => {
    sessionStorage.setItem('c3d_view', view);
  }, [view]);

  const [folderFilter, setFolderFilter] = useState<FolderFilter>({ kind: 'all' });
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('projects');

  // جست‌وجو با تاخیر ۳۵۰ms
  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const authed = !!sessionQ.data?.authed;

  const folderKey = folderFilter.kind === 'folder' ? folderFilter.id : folderFilter.kind;
  const folderArg = folderFilter.kind === 'all' ? undefined : folderFilter.kind === 'none' ? null : folderFilter.id;

  const projectsQ = useQuery({
    queryKey: ['projects', folderKey, q],
    queryFn: () => api.listProjects(folderArg, q || undefined),
    enabled: authed,
  });
  const foldersQ = useQuery({
    queryKey: ['folders'],
    queryFn: api.listFolders,
    enabled: authed,
  });

  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      qc.clear();
      qc.invalidateQueries({ queryKey: ['session'] });
    },
    onError: (e: Error) =>
      toast({ title: 'خروج ناموفق بود', description: e.message, variant: 'destructive' }),
  });

  // --- لندینگ عمومی: حالت پیش‌فرض صفحه اصلی؛ داشبورد فقط برای مدیر واردشده ---
  if (sessionQ.isLoading && view === 'dashboard') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authed || view === 'site') {
    return (
      <SiteLanding
        authed={authed}
        onEnterDashboard={() => {
          setView('dashboard');
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  const projects = projectsQ.data?.projects ?? [];
  const folders = foldersQ.data?.folders ?? [];
  const publicProjects = projects.filter((p) => p.isPublic);
  const currentFolderId = folderFilter.kind === 'folder' ? folderFilter.id : null;
  const searching = q.length > 0;

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      {/* هدر */}
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-2"
            onClick={() => setView('site')}
            aria-label="بازگشت به صفحه اصلی سایت"
          >
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
              <Box className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-black leading-tight">استودیو۳بعد</h1>
              <p className="text-[10px] text-muted-foreground">از عکس تا فضای سه‌بعدی</p>
            </div>
          </button>
          <Badge variant="secondary" className="mr-auto text-[10px] gap-1 hidden sm:flex">
            <ShieldCheck className="h-3 w-3" /> پنل مدیریت
          </Badge>
          <div className="ml-auto sm:ml-3 flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => setView('site')}
              aria-label="نمایش صفحه اصلی سایت"
            >
              <Globe className="h-4 w-4" /> نمایش سایت
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              aria-label="خروج از حساب مدیر"
            >
              {logout.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              خروج
            </Button>
          </div>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} dir="rtl" className="flex-1 flex flex-col">
        {/* تب‌ها */}
        <div className="max-w-6xl mx-auto px-4 w-full pt-4">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="projects" className="gap-1.5">
              <Boxes className="h-4 w-4" /> پروژه‌ها
            </TabsTrigger>
            <TabsTrigger value="portfolio" className="gap-1.5">
              <Images className="h-4 w-4" /> نمونه‌کارها
            </TabsTrigger>
            <TabsTrigger value="admin" className="gap-1.5">
              <ShieldCheck className="h-4 w-4" /> مدیریت
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ---------- تب پروژه‌ها ---------- */}
        <TabsContent value="projects" className="flex-1 mt-0">
          <main className="flex-1">
            {/* جست‌وجو + پوشه‌ها */}
            <section className="max-w-6xl mx-auto px-4 pb-2 space-y-2">
              <div className="relative">
                <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="جستجو: نام مشتری، شماره، آدرس یا تاریخ..."
                  className="ps-9 h-10 bg-card"
                  aria-label="جستجو در پروژه‌ها"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => setSearchInput('')}
                    className="absolute top-1/2 -translate-y-1/2 end-2 h-6 w-6 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
                    aria-label="پاک کردن جستجو"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <FolderBar
                folders={folders}
                selected={folderFilter}
                onSelect={setFolderFilter}
                currentFolderId={currentFolderId}
              />
            </section>

            {/* آپلود + پروژه‌ها */}
            <section className="max-w-6xl mx-auto px-4 py-6 grid lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-1 lg:sticky lg:top-24">
                <UploadCard folderId={currentFolderId} />
              </div>

              <div className="lg:col-span-2 space-y-3">
                <h3 className="font-bold flex items-center gap-2 flex-wrap">
                  <Boxes className="h-5 w-5 text-primary" />
                  {searching
                    ? 'نتایج جستجو'
                    : folderFilter.kind === 'folder'
                      ? `پروژه‌های پوشه «${folders.find((f) => f.id === folderFilter.id)?.name ?? ''}»`
                      : folderFilter.kind === 'none'
                        ? 'پروژه‌های بدون پوشه'
                        : 'پروژه‌های شما'}
                  {!projectsQ.isLoading && (
                    <Badge variant="secondary" className="text-[10px] tabular-nums">
                      {projects.length.toLocaleString('fa-IR')} پروژه
                    </Badge>
                  )}
                </h3>
                {projectsQ.isLoading ? (
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="rounded-xl border bg-card overflow-hidden">
                        <div className="h-36 bg-muted animate-pulse" />
                        <div className="p-3 space-y-2">
                          <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
                          <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : projects.length ? (
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {projects.map((p) => (
                      <ProjectCard key={p.id} project={p} folders={folders} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed p-10 text-center space-y-2">
                    <Boxes className="h-10 w-10 mx-auto text-muted-foreground/30" />
                    <p className="text-sm font-medium">
                      {searching
                        ? 'نتیجه‌ای برای این جستجو پیدا نشد'
                        : folderFilter.kind === 'all'
                          ? 'هنوز پروژه‌ای ندارید'
                          : 'این پوشه خالی است'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {searching
                        ? 'نام مشتری، شماره تماس، آدرس یا تاریخ (مثل 2025-01-12) را امتحان کنید'
                        : 'از کارت کنار، عکس فضا را آپلود کنید یا با فضای نمونه شروع کنید'}
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* نمونه‌کارهای عمومی */}
            {publicProjects.length > 0 && (
              <section className="max-w-6xl mx-auto px-4 pb-8 space-y-3">
                <h3 className="font-bold flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" /> نمونه‌کارهای عمومی
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {publicProjects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => (window.location.hash = `/editor/${p.id}`)}
                      className="rounded-xl border bg-card overflow-hidden text-start hover:shadow-md transition-shadow group"
                      aria-label={`نمونه‌کار ${p.name}`}
                    >
                      <div className="h-24 bg-muted relative">
                        {p.thumbnail ? (
                          <img
                            src={p.thumbnail}
                            alt={`نمونه‌کار ${p.name}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs font-medium p-2 truncate">{p.name}</p>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </main>
        </TabsContent>

        {/* ---------- تب نمونه‌کارها ---------- */}
        <TabsContent value="portfolio" className="flex-1 mt-0">
          <main className="max-w-6xl mx-auto px-4 py-6">
            <PortfolioManager />
          </main>
        </TabsContent>

        {/* ---------- تب مدیریت ---------- */}
        <TabsContent value="admin" className="flex-1 mt-0">
          <main className="max-w-6xl mx-auto px-4 py-6">
            <AdminPanel />
          </main>
        </TabsContent>
      </Tabs>

      {/* فوتر چسبان مشترک با سایت */}
      <SiteFooter />
    </div>
  );
}
