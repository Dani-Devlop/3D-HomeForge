'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Boxes,
  Camera,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  MousePointerClick,
  Share2,
  Sparkles,
  SquarePen,
  Trash2,
  UploadCloud,
  Users,
} from 'lucide-react';
import { api, type ProjectDTO } from '@/lib/api';
import { fileToResizedDataUrl } from '@/lib/image-utils';
import { SAMPLE_ROOM_SPEC, SAMPLE_SCENE } from '@/lib/sample-room';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { ShareDialog } from '@/components/editor/share-dialog';

// ---------- مراحل انیمیشن بازسازی ----------
const AI_STEPS = [
  'ارسال عکس به موتور هوش مصنوعی...',
  'تحلیل فضایی و تخمین ابعاد...',
  'تشخیص رنگ دیوار، کف و بازشوها...',
  'ساخت مش سه‌بعدی ویرایش‌پذیر...',
];

function ReconstructOverlay({ step }: { step: number }) {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Sparkles className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <div>
              <p className="font-semibold">بازسازی سه‌بعدی در جریان است</p>
              <p className="text-xs text-muted-foreground">مدل شما دقیقاً شبیه فضای واقعی ساخته می‌شود</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {AI_STEPS.map((s, i) => (
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
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-700 ease-out"
              style={{ width: `${Math.min(95, ((step + 1) / AI_STEPS.length) * 90)}%` }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- کارت آپلود ----------
function UploadCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [aiStep, setAiStep] = useState(-1);

  useEffect(() => {
    if (aiStep < 0) return;
    const timer = setInterval(() => {
      setAiStep((s) => Math.min(s + 1, AI_STEPS.length - 1));
    }, 1600);
    return () => clearInterval(timer);
  }, [aiStep]);

  const pickFile = async (f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast({ title: 'فقط تصویر مجاز است', description: 'عکس آشپزخانه یا اتاق خواب انتخاب کنید', variant: 'destructive' });
      return;
    }
    try {
      const dataUrl = await fileToResizedDataUrl(f);
      setFile(f);
      setPreview(dataUrl);
    } catch {
      toast({ title: 'خواندن تصویر ناموفق بود', variant: 'destructive' });
    }
  };

  const reconstruct = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('ابتدا عکس فضا را انتخاب کنید');
      const image = preview ?? (await fileToResizedDataUrl(file));
      setAiStep(0);
      const res = await api.reconstruct(image);
      // اگر AI سریع‌تر از انیمیشن بود، کمی صحنه را نشان بده
      await new Promise((r) => setTimeout(r, 800));
      return res;
    },
    onSuccess: async (res) => {
      setAiStep(AI_STEPS.length - 1);
      const created = await api.createProject({
        name: name.trim() || 'پروژه بازسازی‌شده',
        roomType: res.roomType,
        roomSpec: res.roomSpec,
      });
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: 'مدل سه‌بعدی ساخته شد ✓', description: res.description || undefined });
      window.location.hash = `/editor/${created.project.id}`;
    },
    onError: (e: Error) => {
      setAiStep(-1);
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
          <h2 className="font-bold">عکس فضای واقعی را به مدل سه‌بعدی تبدیل کنید</h2>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
          aria-hidden
        />

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pickFile(e.dataTransfer.files?.[0]);
          }}
          className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary/60 bg-muted/30 transition-colors p-6 flex flex-col items-center gap-2 cursor-pointer group min-h-[140px] justify-center"
          aria-label="انتخاب عکس فضا"
        >
          {preview ? (
            <img src={preview} alt="پیش‌نمایش عکس فضا" className="max-h-40 rounded-lg shadow-md object-cover" />
          ) : (
            <>
              <UploadCloud className="h-9 w-9 text-muted-foreground/50 group-hover:text-primary transition-colors" />
              <p className="text-sm font-medium">عکس آشپزخانه / اتاق خواب را بکشید یا انتخاب کنید</p>
              <p className="text-xs text-muted-foreground">JPG یا PNG — AI ابعاد، رنگ‌ها و بازشوها را تشخیص می‌دهد</p>
            </>
          )}
        </button>

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
            disabled={!file || reconstruct.isPending}
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
            شروع با فضای نمونه
          </Button>
        </div>
      </CardContent>

      {aiStep >= 0 && <ReconstructOverlay step={aiStep} />}
    </Card>
  );
}

// ---------- کارت پروژه ----------
function ProjectCard({ project }: { project: ProjectDTO }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const del = useMutation({
    mutationFn: () => api.deleteProject(project.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: 'پروژه حذف شد' });
    },
    onError: (e: Error) => toast({ title: 'خطا در حذف', description: e.message, variant: 'destructive' }),
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
          <Badge className="absolute top-2 start-2 text-[10px]">
            {project.roomType === 'kitchen' ? 'آشپزخانه' : project.roomType === 'bedroom' ? 'اتاق خواب' : 'فضا'}
          </Badge>
        </div>
      </button>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{project.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {new Date(project.updatedAt).toLocaleDateString('fa-IR')} •{' '}
              {typeof project.shareCount === 'number' && project.shareCount > 0 ? `${project.shareCount} لینک فعال` : 'بدون لینک'}
            </p>
          </div>
        </div>
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
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
            aria-label={`حذف ${project.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>

      <ShareDialog projectId={project.id} open={shareOpen} onOpenChange={setShareOpen} />

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

// ---------- نمای خانه ----------
export default function HomeView() {
  const projectsQ = useQuery({ queryKey: ['projects'], queryFn: api.listProjects });

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      {/* هدر */}
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
              <Box className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold leading-tight">کابین‌۳بعد</h1>
              <p className="text-[10px] text-muted-foreground">طراحی و اشتراک‌گذاری سه‌بعدی کابینت</p>
            </div>
          </div>
          <Badge variant="secondary" className="mr-auto text-[10px] gap-1">
            <Sparkles className="h-3 w-3" /> MVP
          </Badge>
        </div>
      </header>

      <main className="flex-1">
        {/* هیرو */}
        <section className="max-w-6xl mx-auto px-4 pt-8 pb-4 grid md:grid-cols-2 gap-6 items-center">
          <div className="space-y-4">
            <h2 className="text-2xl md:text-3xl font-black leading-snug">
              از عکس فضا تا{' '}
              <span className="text-primary">مدل سه‌بعدی تعاملی</span>
              {' '}و لینک اشتراکی مشتری
            </h2>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              عکس آشپزخانه یا اتاق خواب را آپلود کنید؛ هوش مصنوعی مدل مش ویرایش‌پذیر می‌سازد. کابینت‌های پارامتریک را
              بچینید، درب‌ها و چراغ‌ها را تعریف کنید و با یک لینک ساده به مشتری نشان دهید — بدون نیاز به ثبت‌نام.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { icon: Camera, text: 'عکس → مش سه‌بعدی' },
                { icon: MousePointerClick, text: 'Drag & Drop کابینت' },
                { icon: Users, text: 'لینک مهمان با نقش' },
                { icon: Box, text: 'خروجی استاندارد GLB' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl overflow-hidden border shadow-lg animate-float">
            <img
              src="/hero-kitchen.png"
              alt="نمای سه‌بعدی آشپزخانه طراحی‌شده در پلتفرم"
              className="w-full h-auto object-cover"
            />
          </div>
        </section>

        {/* آپلود + پروژه‌ها */}
        <section className="max-w-6xl mx-auto px-4 py-6 grid lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-1 lg:sticky lg:top-24">
            <UploadCard />
          </div>

          <div className="lg:col-span-2 space-y-3">
            <h3 className="font-bold flex items-center gap-2">
              <Boxes className="h-5 w-5 text-primary" /> پروژه‌های شما
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
            ) : projectsQ.data?.projects?.length ? (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {projectsQ.data.projects.map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-10 text-center space-y-2">
                <Boxes className="h-10 w-10 mx-auto text-muted-foreground/30" />
                <p className="text-sm font-medium">هنوز پروژه‌ای ندارید</p>
                <p className="text-xs text-muted-foreground">
                  از کارت کنار، عکس فضا را آپلود کنید یا با فضای نمونه شروع کنید
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* فوتر چسبان */}
      <footer className="mt-auto border-t bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>کابین‌۳بعد — چرخه کامل عکس → سه‌بعدی → اشتراک‌گذاری، برای کابینت‌سازها</p>
          <p dir="ltr" className="font-mono">glTF / GLB • React Three Fiber</p>
        </div>
      </footer>
    </div>
  );
}
