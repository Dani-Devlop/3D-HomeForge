'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Boxes,
  CalendarClock,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Contact,
  FilePlus2,
  FileText,
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
  Paperclip,
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
import { api, type FolderDTO, type ProjectDTO } from '@/lib/api';
import { PROJECT_STAGES, formatToman, stageInfo, type ProjectStage } from '@/lib/crm';
import { fileToResizedDataUrl, videoToFrames } from '@/lib/image-utils';
import { formatFaDate, relativeFa } from '@/lib/format';
import { SAMPLE_ROOM_SPEC, SAMPLE_SCENE } from '@/lib/sample-room';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme-toggle';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import SiteLanding, { SiteFooter } from './site-landing';
import { PortfolioManager } from './portfolio-manager';
import {
  ProjectFormDialog,
  resolveCustomerFolder,
  type ProjectFormSave,
} from './project-form-dialog';
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
// Image preview (project contract/invoice photo)
// ============================================================
function ImagePreviewDialog({
  url,
  title,
  onClose,
}: {
  url: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="ltr" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <img
          src={url}
          alt={title}
          className="w-full max-h-[65vh] object-contain rounded-lg border bg-muted"
        />
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Admin panel
// ============================================================
const ROOM_TYPE_LABEL: Record<string, string> = {
  kitchen: 'Kitchen',
  bedroom: 'Bedroom',
  living: 'Living room',
  dining: 'Dining room',
  bathroom: 'Bathroom',
  office: 'Office',
  other: 'Other',
};

const ROLE_FA: Record<string, string> = { viewer: 'Viewer', modifier: 'Editor' };

function StatCard({ icon: Icon, label, value }: { icon: typeof FolderIcon; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-black tabular-nums leading-none">{value.toLocaleString('en-US')}</p>
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
      toast({ title: 'Password changed' });
      setCur('');
      setNw('');
      setRep('');
    },
    onError: (e: Error) =>
      toast({ title: 'Password change failed', description: e.message, variant: 'destructive' }),
  });

  const pwError =
    nw.length > 0 && nw.length < 4
      ? 'New password must be at least 4 characters'
      : rep.length > 0 && nw !== rep
        ? 'Password confirmation does not match'
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
        <p className="text-sm text-destructive">{(statsQ.error as Error)?.message ?? 'Failed to load stats'}</p>
        <Button variant="outline" size="sm" onClick={() => statsQ.refetch()}>Retry</Button>
      </div>
    );
  }

  const { stats, roomTypes, recentGuests, upcoming } = statsQ.data;

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={FolderIcon} label="Projects" value={stats.projects} />
        <StatCard icon={Boxes} label="Folders" value={stats.folders} />
        <StatCard icon={Users} label="Guests" value={stats.guests} />
        <StatCard icon={Send} label="Active links" value={stats.activeShareLinks} />
        <StatCard icon={Globe} label="Public portfolio" value={stats.publicProjects} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* Upcoming schedule */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-bold flex items-center gap-2 text-sm">
              <CalendarClock className="h-4.5 w-4.5 text-primary" /> Upcoming schedule
            </h3>
            {upcoming.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                No visit, install, or due date scheduled in the next 45 days
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
                          Visit: {formatFaDate(u.visitAt)}
                        </Badge>
                      )}
                      {u.installAt && (
                        <Badge className="bg-emerald-100 text-emerald-900 border-emerald-200 h-5 px-2">
                          Install: {formatFaDate(u.installAt)}
                        </Badge>
                      )}
                      {u.dueAt && (
                        <Badge className="bg-muted text-muted-foreground border-border h-5 px-2">
                          Due: {formatFaDate(u.dueAt)}
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent guests */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-bold flex items-center gap-2 text-sm">
              <Users className="h-4.5 w-4.5 text-primary" /> Recent guests
            </h3>
            {recentGuests.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No visitors yet</p>
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

        {/* Change admin password */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-bold flex items-center gap-2 text-sm">
              <KeyRound className="h-4.5 w-4.5 text-primary" /> Change admin password
            </h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Current password</Label>
                <Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">New password</Label>
                <Input type="password" value={nw} onChange={(e) => setNw(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Confirm new password</Label>
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
              Save new password
            </Button>
          </CardContent>
        </Card>

        {/* Room types */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-bold flex items-center gap-2 text-sm">
              <Box className="h-4.5 w-4.5 text-primary" /> Room types
            </h3>
            {Object.keys(roomTypes).length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No projects yet</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(roomTypes).map(([t, n]) => (
                  <Badge key={t} variant="outline" className="gap-1.5 h-7 px-3 text-xs">
                    {ROOM_TYPE_LABEL[t] ?? t}
                    <span className="tabular-nums text-primary font-bold">{n.toLocaleString('en-US')}</span>
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
// Reconstruction progress overlay (live stream)
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
              <p className="font-semibold">3D reconstruction in progress</p>
              <p className="text-xs text-muted-foreground">Your real space is being rebuilt with its fixtures</p>
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
              {Math.round(percent).toLocaleString('en-US')}%
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Upload card (multiple photos + video + optional floor plan) with live progress
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
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [stage, setStage] = useState<ProjectStage>('visit');
  const [crmOpen, setCrmOpen] = useState(false);
  const [recSteps, setRecSteps] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ step: number; percent: number; message: string } | null>(null);
  const stepsRef = useRef<string[]>([]);

  /** Finds or creates the customer folder by name; falls back to the selected folder when no client name is given */
  const resolveCustomer = async (): Promise<{
    folderId: string | null;
    folder: { name: string; created: boolean } | null;
  }> => {
    if (!clientName.trim()) return { folderId, folder: null };
    try {
      const r = await resolveCustomerFolder(clientName, clientPhone);
      if (!r.id) return { folderId, folder: null };
      return { folderId: r.id, folder: { name: clientName.trim(), created: !r.existed } };
    } catch {
      // Folder errors must not block project creation
      toast({ title: 'Could not resolve the customer folder', variant: 'destructive' });
      return { folderId, folder: null };
    }
  };

  const folderToast = (folder: { name: string; created: boolean } | null) => {
    if (!folder) return;
    if (folder.created) {
      toast({ title: 'New customer folder created', description: `Folder “${folder.name}”` });
    } else {
      toast({ title: `Project saved in customer folder “${folder.name}”` });
    }
  };

  const buildSteps = (hasPlan: boolean) => {
    const steps = ['Sending images to the AI engine...'];
    if (hasPlan) steps.push('Reading the floor plan for accurate dimensions...');
    steps.push('Analyzing photos and detecting the space and fixtures...');
    steps.push('Merging multi-angle results...');
    steps.push('Building the editable 3D mesh...');
    return steps;
  };

  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) {
      toast({ title: 'Only images are allowed', variant: 'destructive' });
      return;
    }
    try {
      const remaining = MAX_SHOTS - shots.length;
      if (remaining <= 0) {
        toast({ title: `A maximum of ${MAX_SHOTS.toLocaleString('en-US')} photos is allowed`, variant: 'destructive' });
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
      toast({ title: 'Failed to read the image', variant: 'destructive' });
    }
  };

  const addVideo = async (f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('video/')) {
      toast({ title: 'Not a valid video file', variant: 'destructive' });
      return;
    }
    try {
      toast({ title: 'Extracting video frames...' });
      const frames = await videoToFrames(f, 3);
      const vk = `vid-${Date.now()}`;
      setVideoKey(vk);
      setShots((prev) =>
        [...prev.filter((s) => !s.key.startsWith('vid-')), ...frames.map((src, i) => ({ key: `${vk}-${i}`, src }))].slice(0, MAX_SHOTS)
      );
    } catch (e) {
      toast({
        title: 'Frame extraction failed',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const addFloorPlan = async (f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast({ title: 'The floor plan must be an image', variant: 'destructive' });
      return;
    }
    try {
      setFloorPlan(await fileToResizedDataUrl(f, 1600));
    } catch {
      toast({ title: 'Failed to read the floor plan', variant: 'destructive' });
    }
  };

  const reconstruct = useMutation({
    mutationFn: async () => {
      if (!shots.length) throw new Error('Select at least one photo or video');
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
      // The last step completes only on full success — it never gets stuck before that
      setProgress({ step: stepsRef.current.length - 1, percent: 100, message: '' });
      const { folderId: resolvedFolderId, folder } = await resolveCustomer();
      const created = await api.createProject({
        name: name.trim() || 'Reconstructed project',
        roomType: res.roomType,
        roomSpec: res.roomSpec,
        sceneState: { objects: res.objects },
        folderId: resolvedFolderId,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        stage,
      });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['folders'] });
      toast({
        title: '3D model created ✓',
        description: res.objects.length
          ? `${res.objects.length.toLocaleString('en-US')} existing fixtures/cabinets detected`
          : res.description || undefined,
      });
      folderToast(folder);
      window.location.hash = `/editor/${created.project.id}`;
    },
    onError: (e: Error) => {
      setProgress(null);
      setRecSteps([]);
      toast({
        title: 'Reconstruction failed',
        description: `${e.message} — you can start with the sample space`,
        variant: 'destructive',
      });
    },
  });

  const startSample = useMutation({
    mutationFn: async () => {
      const { folderId: resolvedFolderId, folder } = await resolveCustomer();
      const res = await api.createProject({
        name: name.trim() || 'Sample kitchen',
        roomType: 'kitchen',
        roomSpec: SAMPLE_ROOM_SPEC,
        sceneState: SAMPLE_SCENE,
        folderId: resolvedFolderId,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        stage,
      });
      return { res, folder };
    },
    onSuccess: ({ res, folder }) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['folders'] });
      folderToast(folder);
      window.location.hash = `/editor/${res.project.id}`;
    },
    onError: (e: Error) =>
      toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <Card className="w-full">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          <h2 className="font-bold">Accurate space reconstruction from photos or video</h2>
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
          aria-label="Select space photos"
        >
          {shots.length === 0 ? (
            <>
              <UploadCloud className="h-9 w-9 text-muted-foreground/50 group-hover:text-primary transition-colors" />
              <p className="text-sm font-medium">Drop or select a few photos from different angles</p>
              <p className="text-xs text-muted-foreground">
                Front, left, and right — full 360° coverage is not required
              </p>
            </>
          ) : (
            <div className="grid grid-cols-4 gap-2 w-full">
              {shots.map((s) => (
                <div key={s.key} className="relative group/th rounded-lg overflow-hidden border">
                  <img src={s.src} alt="Uploaded space view" className="w-full h-16 object-cover" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShots((prev) => prev.filter((x) => x.key !== s.key));
                    }}
                    className="absolute top-1 end-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover/th:opacity-100 transition-opacity"
                    aria-label="Remove image"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {shots.length < MAX_SHOTS && (
                <div className="h-16 rounded-lg border border-dashed flex flex-col items-center justify-center text-[10px] text-muted-foreground gap-0.5">
                  <ImageIcon className="h-4 w-4" />
                  Add (up to {(MAX_SHOTS - shots.length).toLocaleString('en-US')})
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
            <ImageIcon className="h-3.5 w-3.5" /> More photos
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={() => vidRef.current?.click()}
            disabled={shots.length >= MAX_SHOTS - 1}
          >
            <Video className="h-3.5 w-3.5" /> Upload video
          </Button>
        </div>

        {/* Floor plan — optional */}
        {floorPlan ? (
          <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-2">
            <img src={floorPlan} alt="Floor plan" className="h-14 w-20 object-cover rounded-lg border shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium flex items-center gap-1.5">
                <Ruler className="h-3.5 w-3.5 text-primary" /> Floor plan added
              </p>
              <p className="text-[10px] text-muted-foreground">Dimensions will be read from the plan</p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              onClick={() => setFloorPlan(null)}
              aria-label="Remove floor plan"
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
            aria-label="Add floor plan (optional)"
          >
            <Ruler className="h-6 w-6 text-primary/60 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium">Floor plan (optional — for better accuracy)</p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Not always needed — add it only when you have a plan photo, to get more accurate dimensions
              </p>
            </div>
          </div>
        )}

        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name (optional)"
          maxLength={80}
        />

        {/* Client & stage — optional; for automatic customer folders */}
        <Collapsible
          open={crmOpen}
          onOpenChange={setCrmOpen}
          className="rounded-xl border bg-muted/20"
        >
          <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-medium rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
            <Contact className="h-4 w-4 text-primary" />
            Client info & stage (optional)
            <ChevronDown
              className={`h-4 w-4 ms-auto text-muted-foreground transition-transform ${crmOpen ? 'rotate-180' : ''}`}
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-3 px-3 pb-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Client name (for folder)</Label>
                  <Input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Mr. Mohammadi"
                    maxLength={80}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone number</Label>
                  <Input
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    dir="ltr"
                    className="text-start h-9 text-xs"
                    placeholder="0912…"
                    maxLength={60}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Progress stage</Label>
                <Select value={stage} onValueChange={(v) => setStage(v as ProjectStage)} dir="ltr">
                  <SelectTrigger className="w-full h-9 text-xs" aria-label="Project progress stage">
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
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                If a folder with this client name exists, the project is added to it; otherwise a new folder is created.
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            className="flex-1 gap-2 h-11"
            onClick={() => reconstruct.mutate()}
            disabled={!shots.length || reconstruct.isPending}
          >
            <Sparkles className="h-4 w-4" />
            {reconstruct.isPending ? 'Reconstructing...' : 'Reconstruct 3D with AI'}
          </Button>
          <Button
            variant="outline"
            className="sm:w-auto gap-2 h-11"
            onClick={() => startSample.mutate()}
            disabled={startSample.isPending}
          >
            <Boxes className="h-4 w-4" />
            Sample space
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          AI detects walls, openings, and existing fixtures (cabinets, fridge, stove, hood, furniture)
          and builds an approximate but fully editable 3D model.
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
// Folder dialog
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
  initial?: { id?: string; name?: string; phone?: string | null };
  onSave: (name: string, phone: string) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="ltr" className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial?.id ? 'Rename folder' : 'New folder'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Folder name (customer)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mr. Rezaei house"
              maxLength={60}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) onSave(name.trim(), phone.trim());
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Customer phone (optional)</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
              className="text-start"
              placeholder="0912…"
              maxLength={60}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => name.trim() && onSave(name.trim(), phone.trim())}
            disabled={!name.trim() || saving}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Folder bar
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
  const [editing, setEditing] = useState<{ id?: string; name?: string; phone?: string | null } | undefined>();
  const [newOpen, setNewOpen] = useState(false);

  const createFolder = useMutation({
    mutationFn: ({ name, phone }: { name: string; phone?: string }) =>
      api.createFolder(name, phone || undefined),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['folders'] });
      setDlgOpen(false);
      onSelect({ kind: 'folder', id: res.folder.id });
      toast({ title: `Folder “${res.folder.name}” created` });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const renameFolder = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.renameFolder(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      setDlgOpen(false);
      toast({ title: 'Folder renamed' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteFolder = useMutation({
    mutationFn: (id: string) => api.deleteFolder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      onSelect({ kind: 'all' });
      toast({ title: 'Folder deleted', description: 'Its projects are now folderless' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const chip = (active: boolean) =>
    `h-9 px-3 rounded-full border text-xs font-medium flex items-center gap-1.5 transition-colors touch-manipulation ${
      active
        ? 'bg-primary text-primary-foreground border-primary'
        : 'bg-card hover:bg-accent/60 border-border'
    }`;

  const newProject = useMutation({
    mutationFn: async (crm: ProjectFormSave) => {
      // Auto-match the customer folder — reuse an existing folder with the same name,
      // otherwise the server creates one (createFolder returns the same-named folder)
      let folderId = currentFolderId;
      let folder: { name: string; created: boolean } | null = null;
      const customerName = crm.clientName?.trim() ?? '';
      if (customerName) {
        try {
          const r = await resolveCustomerFolder(customerName, crm.clientPhone ?? '');
          if (r.id) {
            folderId = r.id;
            folder = { name: customerName, created: !r.existed };
          }
        } catch {
          // Folder errors must not block project creation
          toast({
            title: 'Could not resolve the customer folder',
            description: 'The project will be saved in the current folder',
            variant: 'destructive',
          });
        }
      }
      const res = await api.createProject({
        name: crm.name?.trim() || 'New project',
        roomSpec: {
          widthM: 4, depthM: 3.4, heightM: 2.8,
          wallColor: '#ece7dd', floorColor: '#a97c50', ceilingColor: '#fafafa',
          windows: [], doorways: [],
        },
        folderId,
        clientName: crm.clientName ?? '',
        clientPhone: crm.clientPhone ?? '',
        address: crm.address ?? '',
        stage: crm.stage,
        dealAt: crm.dealAt ?? null,
        contractAmount: crm.contractAmount ?? null,
        contractPhoto: crm.contractPhoto ?? '',
        invoicePhoto: crm.invoicePhoto ?? '',
        visitAt: crm.visitAt ?? null,
        installAt: crm.installAt ?? null,
        dueAt: crm.dueAt ?? null,
      });
      return { project: res.project, folder };
    },
    onSuccess: ({ project, folder }) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['folders'] });
      if (folder) {
        if (folder.created) {
          toast({
            title: 'New customer folder created',
            description: `Project saved in folder “${folder.name}”`,
          });
        } else {
          toast({ title: `Project saved in customer folder “${folder.name}”` });
        }
      }
      window.location.hash = `/editor/${project.id}`;
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={chip(selected.kind === 'all')} onClick={() => onSelect({ kind: 'all' })}>
        <Boxes className="h-3.5 w-3.5" /> All
      </button>
      <button type="button" className={chip(selected.kind === 'none')} onClick={() => onSelect({ kind: 'none' })}>
        <FolderIcon className="h-3.5 w-3.5 opacity-50" /> No folder
      </button>
      {folders.map((f) => (
        <div key={f.id} className="flex items-center">
          <button
            type="button"
            className={`${chip(selected.kind === 'folder' && selected.id === f.id)} rounded-s-full`}
            title={`${f.name}${f.phone ? ` — ${f.phone}` : ''}`}
            onClick={() => onSelect({ kind: 'folder', id: f.id })}
          >
            <FolderIcon className="h-3.5 w-3.5" />
            {f.name}
            {typeof f.projectCount === 'number' && (
              <span className="opacity-70">({f.projectCount.toLocaleString('en-US')})</span>
            )}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`${chip(false)} rounded-e-full !px-1.5 !-ms-px`}
                aria-label={`Folder options for ${f.name}`}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => {
                  setEditing({ id: f.id, name: f.name, phone: f.phone ?? '' });
                  setDlgOpen(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => deleteFolder.mutate(f.id)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete folder
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
        <FolderPlus className="h-3.5 w-3.5" /> New folder
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-9 rounded-full gap-1.5 text-xs"
        onClick={() => setNewOpen(true)}
        disabled={newProject.isPending}
      >
        <FilePlus2 className="h-3.5 w-3.5" /> New project
      </Button>

      {dlgOpen && (
        <FolderDialog
          open
          onOpenChange={setDlgOpen}
          initial={editing}
          saving={createFolder.isPending || renameFolder.isPending}
          onSave={(name, phone) =>
            editing?.id
              ? renameFolder.mutate({ id: editing.id, name })
              : createFolder.mutate({ name, phone })
          }
        />
      )}

      {newOpen && (
        <ProjectFormDialog
          title="New project"
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
// Project card — with CRM badges and client/scheduling dialog
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
  const [photoPreview, setPhotoPreview] = useState<{ url: string; title: string } | null>(null);

  // Contract/finance fields — local copy for badge display
  const contractAmount = project.contractAmount ?? null;
  const dealAt = project.dealAt ?? null;
  const contractPhoto = project.contractPhoto ?? '';
  const invoicePhoto = project.invoicePhoto ?? '';
  const st = stageInfo(project.stage);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['projects'] });
    qc.invalidateQueries({ queryKey: ['folders'] });
  };

  const del = useMutation({
    mutationFn: () => api.deleteProject(project.id),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Project deleted' });
    },
    onError: (e: Error) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  });

  const togglePublic = useMutation({
    mutationFn: () => api.patchProject(project.id, { isPublic: !project.isPublic }),
    onSuccess: () => {
      invalidate();
      toast({ title: project.isPublic ? 'Project is now private' : 'Project is now public (portfolio)' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const moveToFolder = useMutation({
    mutationFn: (folderId: string | null) => api.patchProject(project.id, { folderId }),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Project moved' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const saveCrm = useMutation({
    mutationFn: (crm: ProjectFormSave) =>
      api.patchProject(project.id, {
        clientName: crm.clientName ?? '',
        clientPhone: crm.clientPhone ?? '',
        address: crm.address ?? '',
        stage: crm.stage,
        dealAt: crm.dealAt ?? null,
        contractAmount: crm.contractAmount ?? null,
        contractPhoto: crm.contractPhoto ?? '',
        invoicePhoto: crm.invoicePhoto ?? '',
        visitAt: crm.visitAt ?? null,
        installAt: crm.installAt ?? null,
        dueAt: crm.dueAt ?? null,
      }),
    onSuccess: () => {
      invalidate();
      setCrmOpen(false);
      toast({ title: 'Project details saved ✓' });
    },
    onError: (e: Error) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  const patchStage = useMutation({
    mutationFn: (stage: ProjectStage) => api.patchProject(project.id, { stage }),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Progress stage updated' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <Card className="overflow-hidden group hover:shadow-lg transition-shadow">
      <button
        type="button"
        className="block w-full text-start"
        onClick={() => (window.location.hash = `/editor/${project.id}`)}
        aria-label={`Open ${project.name}`}
      >
        <div className="h-36 bg-muted relative overflow-hidden">
          {project.thumbnail ? (
            <img
              src={project.thumbnail}
              alt={`Project image ${project.name}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
            </div>
          )}
          <div className="absolute top-2 start-2 flex gap-1">
            <Badge className="text-[10px]">
              {project.roomType === 'kitchen' ? 'Kitchen' : project.roomType === 'bedroom' ? 'Bedroom' : 'Space'}
            </Badge>
            {project.isPublic ? (
              <Badge variant="secondary" className="text-[10px] gap-1 bg-emerald-600/90 text-white border-0">
                <Globe className="h-2.5 w-2.5" /> Public
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] gap-1 bg-black/45 text-white border-0 backdrop-blur">
                <Lock className="h-2.5 w-2.5" /> Private
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
              {new Date(project.updatedAt).toLocaleDateString('en-US')}
              {typeof project.shareCount === 'number' && project.shareCount > 0 && ` • ${project.shareCount.toLocaleString('en-US')} links`}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                aria-label={`Options for ${project.name}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => setCrmOpen(true)}>
                <Contact className="h-3.5 w-3.5" /> Project details…
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2">
                  <CalendarClock className="h-3.5 w-3.5" /> Progress stage
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                  {PROJECT_STAGES.map((s) => (
                    <DropdownMenuItem key={s.id} onClick={() => patchStage.mutate(s.id)}>
                      {s.id === (project.stage ?? 'visit') ? (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <span className="inline-flex h-3.5 w-3.5 items-center justify-center">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: s.dot }}
                            aria-hidden
                          />
                        </span>
                      )}
                      {s.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={() => togglePublic.mutate()}>
                {project.isPublic ? (
                  <>
                    <Lock className="h-3.5 w-3.5" /> Make private
                  </>
                ) : (
                  <>
                    <Globe className="h-3.5 w-3.5" /> Make public (portfolio)
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2">
                  <FolderInput className="h-3.5 w-3.5" /> Move to folder
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-60 overflow-y-auto">
                  <DropdownMenuItem onClick={() => moveToFolder.mutate(null)}>
                    <FolderIcon className="h-3.5 w-3.5 opacity-50" /> No folder
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
                <Trash2 className="h-3.5 w-3.5" /> Delete project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* CRM badges — stage + client */}
        <div className="flex flex-wrap gap-1">
          <Badge
            asChild
            className={`${st.badge} text-[10px] h-5 px-1.5 gap-1.5 font-normal cursor-pointer`}
          >
            <button
              type="button"
              onClick={() => setCrmOpen(true)}
              aria-label={`Edit details and stage of ${project.name}`}
              title="Edit project details"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: st.dot }}
                aria-hidden
              />
              {st.label}
            </button>
          </Badge>
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

        {/* Contract & finance */}
        {(contractAmount !== null || dealAt || contractPhoto || invoicePhoto) && (
          <div className="flex flex-wrap gap-1">
            {contractAmount !== null && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1 font-normal tabular-nums">
                Amount: {formatToman(contractAmount)}
              </Badge>
            )}
            {dealAt && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1 font-normal">
                Contract: {formatFaDate(dealAt)}
              </Badge>
            )}
            {contractPhoto && (
              <Badge
                asChild
                variant="outline"
                className="text-[10px] h-5 px-1.5 gap-1 font-normal cursor-pointer"
              >
                <button
                  type="button"
                  onClick={() =>
                    setPhotoPreview({ url: contractPhoto, title: `Contract photo — ${project.name}` })
                  }
                  aria-label="View contract photo"
                >
                  <Paperclip className="h-2.5 w-2.5" /> Contract 📎
                </button>
              </Badge>
            )}
            {invoicePhoto && (
              <Badge
                asChild
                variant="outline"
                className="text-[10px] h-5 px-1.5 gap-1 font-normal cursor-pointer"
              >
                <button
                  type="button"
                  onClick={() =>
                    setPhotoPreview({ url: invoicePhoto, title: `Invoice — ${project.name}` })
                  }
                  aria-label="View invoice"
                >
                  <FileText className="h-2.5 w-2.5" /> Invoice
                </button>
              </Badge>
            )}
          </div>
        )}

        {/* Schedule */}
        {(project.visitAt || project.installAt || project.dueAt) && (
          <div className="flex flex-wrap gap-1">
            {project.visitAt && (
              <Badge className="bg-amber-100 text-amber-900 border-amber-200 text-[10px] h-5 px-1.5 font-normal">
                Visit: {formatFaDate(project.visitAt)}
              </Badge>
            )}
            {project.installAt && (
              <Badge className="bg-emerald-100 text-emerald-900 border-emerald-200 text-[10px] h-5 px-1.5 font-normal">
                Install: {formatFaDate(project.installAt)}
              </Badge>
            )}
            {project.dueAt && (
              <Badge className="bg-muted text-muted-foreground border-border text-[10px] h-5 px-1.5 font-normal">
                Due: {formatFaDate(project.dueAt)}
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
            <SquarePen className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setShareOpen(true)}>
            <Share2 className="h-3.5 w-3.5" /> Share
          </Button>
        </div>
      </CardContent>

      <ShareDialog projectId={project.id} open={shareOpen} onOpenChange={setShareOpen} />

      {crmOpen && (
        <ProjectFormDialog
          title={`Project details — ${project.name}`}
          initial={project}
          saving={saveCrm.isPending}
          onSave={(crm) => saveCrm.mutate(crm)}
          onCancel={() => setCrmOpen(false)}
        />
      )}

      {photoPreview && (
        <ImagePreviewDialog
          url={photoPreview.url}
          title={photoPreview.title}
          onClose={() => setPhotoPreview(null)}
        />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent dir="ltr">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              “{project.name}” and all of its share links will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => del.mutate()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ============================================================
// Home view — public landing (default) + admin dashboard with tabs
// ============================================================
export default function HomeView() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const sessionQ = useQuery({ queryKey: ['session'], queryFn: api.session, staleTime: 60_000 });

  // View: site (public landing) | dashboard (admin panel) — persisted in sessionStorage
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

  // Debounced search (350ms)
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
      toast({ title: 'Sign out failed', description: e.message, variant: 'destructive' }),
  });

  // --- Public landing: default home state; dashboard only for a signed-in admin ---
  if (sessionQ.isLoading && view === 'dashboard') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authed || view === 'site') {
    return (
      <SiteLanding
        authed={authed}
        onEnterDashboard={() => {
          // After login (or clicking "Admin panel"), go straight to the admin tab
          setTab('admin');
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
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-2"
            onClick={() => setView('site')}
            aria-label="Back to site home"
          >
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
              <Box className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-black leading-tight">3D HomeForge</h1>
              <p className="text-[10px] text-muted-foreground">From photos to 3D spaces</p>
            </div>
          </button>
          <Badge variant="secondary" className="mr-auto text-[10px] gap-1 hidden sm:flex">
            <ShieldCheck className="h-3 w-3" /> Admin panel
          </Badge>
          <div className="ml-auto sm:ml-3 flex items-center gap-1.5">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => setView('site')}
              aria-label="View site home"
            >
              <Globe className="h-4 w-4" /> View site
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              aria-label="Sign out of admin account"
            >
              {logout.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} dir="ltr" className="flex-1 flex flex-col">
        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 w-full pt-4">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="projects" className="gap-1.5">
              <Boxes className="h-4 w-4" /> Projects
            </TabsTrigger>
            <TabsTrigger value="portfolio" className="gap-1.5">
              <Images className="h-4 w-4" /> Portfolio
            </TabsTrigger>
            <TabsTrigger value="admin" className="gap-1.5">
              <ShieldCheck className="h-4 w-4" /> Admin
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ---------- Projects tab ---------- */}
        <TabsContent value="projects" className="flex-1 mt-0">
          <main className="flex-1">
            {/* Search + folders */}
            <section className="max-w-6xl mx-auto px-4 pb-2 space-y-2">
              <div className="relative">
                <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search: client name, phone, address, or date..."
                  className="ps-9 h-10 bg-card"
                  aria-label="Search projects"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => setSearchInput('')}
                    className="absolute top-1/2 -translate-y-1/2 end-2 h-6 w-6 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
                    aria-label="Clear search"
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

            {/* Upload + projects */}
            <section className="max-w-6xl mx-auto px-4 py-6 grid lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-1 lg:sticky lg:top-24">
                <UploadCard folderId={currentFolderId} />
              </div>

              <div className="lg:col-span-2 space-y-3">
                <h3 className="font-bold flex items-center gap-2 flex-wrap">
                  <Boxes className="h-5 w-5 text-primary" />
                  {searching
                    ? 'Search results'
                    : folderFilter.kind === 'folder'
                      ? `Projects in folder “${folders.find((f) => f.id === folderFilter.id)?.name ?? ''}”`
                      : folderFilter.kind === 'none'
                        ? 'Projects without a folder'
                        : 'Your projects'}
                  {!projectsQ.isLoading && (
                    <Badge variant="secondary" className="text-[10px] tabular-nums">
                      {projects.length.toLocaleString('en-US')} projects
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
                        ? 'No results for this search'
                        : folderFilter.kind === 'all'
                          ? 'No projects yet'
                          : 'This folder is empty'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {searching
                        ? 'Try a client name, phone, address, or date (e.g. 2025-01-12)'
                        : 'Upload space photos from the card beside, or start with the sample space'}
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Public portfolio */}
            {publicProjects.length > 0 && (
              <section className="max-w-6xl mx-auto px-4 pb-8 space-y-3">
                <h3 className="font-bold flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" /> Public portfolio
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {publicProjects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => (window.location.hash = `/editor/${p.id}`)}
                      className="rounded-xl border bg-card overflow-hidden text-start hover:shadow-md transition-shadow group"
                      aria-label={`Portfolio item ${p.name}`}
                    >
                      <div className="h-24 bg-muted relative">
                        {p.thumbnail ? (
                          <img
                            src={p.thumbnail}
                            alt={`Portfolio item ${p.name}`}
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

        {/* ---------- Portfolio tab ---------- */}
        <TabsContent value="portfolio" className="flex-1 mt-0">
          <main className="max-w-6xl mx-auto px-4 py-6">
            <PortfolioManager />
          </main>
        </TabsContent>

        {/* ---------- Admin tab ---------- */}
        <TabsContent value="admin" className="flex-1 mt-0">
          <main className="max-w-6xl mx-auto px-4 py-6">
            <AdminPanel />
          </main>
        </TabsContent>
      </Tabs>

      {/* Footer shared with the public site */}
      <SiteFooter />
    </div>
  );
}
