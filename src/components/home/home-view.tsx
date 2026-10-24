'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Boxes,
  Camera,
  CheckCircle2,
  ChevronDown,
  FilePlus2,
  FolderInput,
  FolderPlus,
  Folder as FolderIcon,
  Globe,
  Image as ImageIcon,
  Loader2,
  Lock,
  MoreVertical,
  MousePointerClick,
  Pencil,
  Share2,
  Sparkles,
  SquarePen,
  Trash2,
  UploadCloud,
  Users,
  Video,
  X,
} from 'lucide-react';
import { api, type FolderDTO, type ProjectDTO } from '@/lib/api';
import { fileToResizedDataUrl, videoToFrames } from '@/lib/image-utils';
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
import { ShareDialog } from '@/components/editor/share-dialog';

// مراحل انیمیشن بازسازی (نسخه ۲: چند تصویر + تشخیص تجهیزات)
const AI_STEPS = [
  'ارسال تصاویر به موتور هوش مصنوعی...',
  'تحلیل فضایی چند زاویه و تخمین ابعاد...',
  'تشخیص دیوارها، پنجره‌ها و درب‌ها...',
  'شناسایی کابینت‌ها، یخچال، اجاق و هود موجود...',
  'ساخت مش سه‌بعدی ویرایش‌پذیر...',
];

type FolderFilter = { kind: 'all' } | { kind: 'none' } | { kind: 'folder'; id: string };

function ReconstructOverlay({ step }: { step: number }) {
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

interface Shot {
  key: string;
  src: string;
}

// ---------- کارت آپلود (چند عکس + ویدیو) ----------
function UploadCard({ folderId }: { folderId: string | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [videoKey, setVideoKey] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [aiStep, setAiStep] = useState(-1);

  useEffect(() => {
    if (aiStep < 0) return;
    const timer = setInterval(() => {
      setAiStep((s) => Math.min(s + 1, AI_STEPS.length - 1));
    }, 1800);
    return () => clearInterval(timer);
  }, [aiStep]);

  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) {
      toast({ title: 'فقط تصویر مجاز است', variant: 'destructive' });
      return;
    }
    try {
      const urls = await Promise.all(imgs.slice(0, 4).map((f) => fileToResizedDataUrl(f)));
      setShots((prev) => {
        const merged = [
          ...prev.filter((s) => s.key !== videoKey || !videoKey),
          ...urls.map((src, i) => ({ key: `img-${Date.now()}-${i}`, src })),
        ];
        return merged.slice(0, 5);
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
        [...prev.filter((s) => !s.key.startsWith('vid-')), ...frames.map((src, i) => ({ key: `${vk}-${i}`, src }))].slice(0, 5)
      );
    } catch (e) {
      toast({
        title: 'استخراج فریم ناموفق بود',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const reconstruct = useMutation({
    mutationFn: async () => {
      if (!shots.length) throw new Error('حداقل یک عکس یا ویدیو انتخاب کنید');
      setAiStep(0);
      const res = await api.reconstruct(shots.map((s) => s.src));
      await new Promise((r) => setTimeout(r, 800));
      return res;
    },
    onSuccess: async (res) => {
      setAiStep(AI_STEPS.length - 1);
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
          ? `${res.objects.length} قطعه تجهیزات/کابینت موجود شناسایی شد`
          : res.description || undefined,
      });
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
            <div className="grid grid-cols-3 gap-2 w-full">
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
              <div className="h-16 rounded-lg border border-dashed flex flex-col items-center justify-center text-[10px] text-muted-foreground gap-0.5">
                <ImageIcon className="h-4 w-4" />
                افزودن (تا {5 - shots.length})
              </div>
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
            disabled={shots.length >= 5}
          >
            <ImageIcon className="h-3.5 w-3.5" /> عکس‌های بیشتر
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={() => vidRef.current?.click()}
            disabled={shots.length >= 4}
          >
            <Video className="h-3.5 w-3.5" /> آپلود ویدیو
          </Button>
        </div>

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
          AI دیوارها، بازشوها و تجهیزات موجود (کابینت، یخچال، اجاق، هود) را تشخیص می‌دهد و مدل
          سه‌بعدی تقریبی اما قابل ویرایش می‌سازد.
        </p>
      </CardContent>

      {aiStep >= 0 && <ReconstructOverlay step={aiStep} />}
    </Card>
  );
}

// ---------- دیالوگ پوشه ----------
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

// ---------- نوار پوشه‌ها ----------
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

  const newEmptyProject = useMutation({
    mutationFn: () =>
      api.createProject({
        name: 'پروژه جدید',
        roomSpec: {
          widthM: 4, depthM: 3.4, heightM: 2.8,
          wallColor: '#ece7dd', floorColor: '#a97c50', ceilingColor: '#fafafa',
          windows: [], doorways: [],
        },
        folderId: currentFolderId,
      }),
    onSuccess: (res) => (window.location.hash = `/editor/${res.project.id}`),
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
              <span className="opacity-70">({f.projectCount})</span>
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
        onClick={() => newEmptyProject.mutate()}
        disabled={newEmptyProject.isPending}
      >
        <FilePlus2 className="h-3.5 w-3.5" /> پروژه خالی
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
    </div>
  );
}

// ---------- کارت پروژه ----------
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
              {typeof project.shareCount === 'number' && project.shareCount > 0 && ` • ${project.shareCount} لینک`}
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
            <DropdownMenuContent align="end" className="w-48">
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
  const projectsQ = useQuery({ queryKey: ['projects'], queryFn: () => api.listProjects() });
  const foldersQ = useQuery({ queryKey: ['folders'], queryFn: api.listFolders });
  const [folderFilter, setFolderFilter] = useState<FolderFilter>({ kind: 'all' });

  const projects = projectsQ.data?.projects ?? [];
  const folders = foldersQ.data?.folders ?? [];

  const filtered = projects.filter((p) => {
    if (folderFilter.kind === 'none') return !p.folderId;
    if (folderFilter.kind === 'folder') return p.folderId === folderFilter.id;
    return true;
  });

  const currentFolderId = folderFilter.kind === 'folder' ? folderFilter.id : null;
  const publicProjects = projects.filter((p) => p.isPublic);

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
            <Sparkles className="h-3 w-3" /> MVP نسخه ۲
          </Badge>
        </div>
      </header>

      <main className="flex-1">
        {/* هیرو */}
        <section className="max-w-6xl mx-auto px-4 pt-8 pb-4 grid md:grid-cols-2 gap-6 items-center">
          <div className="space-y-4">
            <h2 className="text-2xl md:text-3xl font-black leading-snug">
              بازسازی دقیق فضا از{' '}
              <span className="text-primary">عکس و ویدیو</span>
              {' '}، ویرایش با متن و انتشار برای مشتری
            </h2>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              چند عکس یا یک ویدیو از آشپزخانه آپلود کنید؛ AI دیوارها، بازشوها و تجهیزات موجود را تشخیص
              می‌دهد. کابینت پارامتریک با یک جمله بسازید، آبجکت‌ها را با متن تغییر دهید و با لینک ساده
              به مشتری نشان دهید — بدون ثبت‌نام.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { icon: Camera, text: 'عکس/ویدیو → مش سه‌بعدی' },
                { icon: Sparkles, text: 'ساخت کابینت با متن' },
                { icon: MousePointerClick, text: 'Drag & Drop کابینت' },
                { icon: Users, text: 'لینک مهمان با نقش' },
                { icon: FolderIcon, text: 'پوشه‌بندی پروژه‌ها' },
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

        {/* پوشه‌ها */}
        <section className="max-w-6xl mx-auto px-4 pb-2">
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
            <h3 className="font-bold flex items-center gap-2">
              <Boxes className="h-5 w-5 text-primary" />
              {folderFilter.kind === 'folder'
                ? `پروژه‌های پوشه «${folders.find((f) => f.id === folderFilter.id)?.name ?? ''}»`
                : folderFilter.kind === 'none'
                  ? 'پروژه‌های بدون پوشه'
                  : 'پروژه‌های شما'}
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
            ) : filtered.length ? (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((p) => (
                  <ProjectCard key={p.id} project={p} folders={folders} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-10 text-center space-y-2">
                <Boxes className="h-10 w-10 mx-auto text-muted-foreground/30" />
                <p className="text-sm font-medium">
                  {folderFilter.kind === 'all' ? 'هنوز پروژه‌ای ندارید' : 'این پوشه خالی است'}
                </p>
                <p className="text-xs text-muted-foreground">
                  از کارت کنار، عکس فضا را آپلود کنید یا با فضای نمونه شروع کنید
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
