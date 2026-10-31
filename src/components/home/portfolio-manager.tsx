'use client';

import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Boxes,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ImageIcon,
  Images,
  Loader2,
  Pencil,
  Plus,
  Rotate3d,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { api, type PortfolioItemDTO, type ProjectDTO } from '@/lib/api';
import { fileToResizedDataUrl } from '@/lib/image-utils';
import { hasLiveScene } from '@/components/three/portfolio-scene';
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
// Portfolio management — image or live 3D model (from projects)
// ============================================================

const CATEGORIES = ['kitchen', 'bedroom', 'living', 'office', 'other'] as const;

// Live 3D scene — client-side only (three.js)
const PortfolioScene = dynamic(() => import('@/components/three/portfolio-scene'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-muted animate-pulse" aria-hidden />,
});

/** Live scene picked for the portfolio item */
interface PickedScene {
  roomSpec: unknown;
  sceneState: unknown;
  sourceName: string;
}

/** Save dialog output */
interface SavedItem {
  title: string;
  description: string;
  category: string;
  image: string;
  visible: boolean;
  roomSpec?: unknown;
  sceneState?: unknown;
}

// ---------- Add/edit dialog ----------
function ItemDialog({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial?: PortfolioItemDTO;
  saving: boolean;
  onSave: (v: SavedItem) => void;
  onCancel: () => void;
}) {
  const imgRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState(initial?.category ?? 'kitchen');
  const [image, setImage] = useState(initial?.image ?? '');
  const [visible, setVisible] = useState(initial?.visible ?? true);
  const [reading, setReading] = useState(false);
  const [scene, setScene] = useState<PickedScene | null>(() => {
    if (initial && hasLiveScene(initial.sceneState)) {
      return {
        roomSpec: initial.roomSpec,
        sceneState: initial.sceneState,
        sourceName: 'Saved scene',
      };
    }
    return null;
  });

  // Admin's projects — source of live 3D models
  const projectsQ = useQuery({
    queryKey: ['projects', 'portfolio-picker'],
    queryFn: () => api.listProjects(),
    staleTime: 10_000,
  });
  const projects = (projectsQ.data?.projects ?? []).filter(
    (p) => hasLiveScene(p.sceneState) || Object.keys(p.roomSpec ?? {}).length > 0,
  );

  const pickProject = (projectId: string) => {
    const p = projects.find((x) => x.id === projectId) as ProjectDTO | undefined;
    if (!p) return;
    setScene({
      roomSpec: p.roomSpec,
      sceneState: Object.keys(p.sceneState ?? {}).length > 0 ? p.sceneState : { objects: [] },
      sourceName: p.name,
    });
  };

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

  const canSave =
    title.trim().length > 0 && (image.length >= 8 || hasLiveScene(scene?.sceneState));

  return (
    <Dialog open onOpenChange={(v) => !v && onCancel()}>
      <DialogContent dir="ltr" className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit portfolio item' : 'New portfolio item'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Live 3D model from projects */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <Rotate3d className="h-3.5 w-3.5 text-primary" /> Live 3D model
            </Label>
            <Select value="" onValueChange={pickProject} dir="ltr">
              <SelectTrigger className="w-full" aria-label="Pick a project for the 3D model">
                <SelectValue placeholder={projects.length > 0 ? 'Pick from my projects…' : 'No projects with a scene'} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.clientName ? ` — ${p.clientName}` : ''}
                  </SelectItem>
                ))}
                {projects.length === 0 && (
                  <SelectItem value="__none" disabled>
                    Create a project in the Projects tab first
                  </SelectItem>
                )}
              </SelectContent>
            </Select>

            {scene ? (
              <div className="relative rounded-xl overflow-hidden border">
                <div className="aspect-video bg-muted relative">
                  <PortfolioScene
                    roomSpec={scene.roomSpec as never}
                    sceneState={scene.sceneState as never}
                  />
                </div>
                <div className="absolute top-2 start-2 flex gap-1.5 pointer-events-none">
                  <Badge className="text-[10px] gap-1 bg-primary/90 text-primary-foreground border-0">
                    <Rotate3d className="h-2.5 w-2.5" /> Live 3D
                  </Badge>
                  <Badge className="text-[10px] bg-black/50 text-white border-0 backdrop-blur">
                    {scene.sourceName}
                  </Badge>
                </div>
                <div className="absolute top-2 end-2 flex gap-1.5">
                  {initial && hasLiveScene(initial.sceneState) && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7 text-[11px] gap-1"
                      onClick={() => (window.location.hash = `/editor/pf/${initial.id}`)}
                      title="Edit the 3D model in the editor"
                    >
                      <Rotate3d className="h-3 w-3" /> Edit this model
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 text-[11px] gap-1"
                    onClick={() => setScene(null)}
                    aria-label="Remove 3D model"
                  >
                    <X className="h-3 w-3" /> Remove model
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Pick one of your projects and the portfolio card becomes a live, rotatable 3D model
                instead of a photo.
              </p>
            )}
          </div>

          {/* Image (optional when a live model exists) */}
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
              <img src={image} alt="Portfolio image preview" className="w-full aspect-video object-cover" />
              <div className="absolute top-2 end-2 flex gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7 text-[11px] gap-1"
                  onClick={() => imgRef.current?.click()}
                >
                  <UploadCloud className="h-3 w-3" /> Change image
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="h-7 w-7"
                  onClick={() => setImage('')}
                  aria-label="Remove image"
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
              aria-label="Choose portfolio image"
            >
              {reading ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : (
                <>
                  <UploadCloud className="h-8 w-8 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                  <p className="text-xs font-medium">
                    Image (optional{scene ? ' — a live model is enough' : ''})
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {scene ? 'Shown as a fallback' : 'An image is required if you have no 3D model'}
                  </p>
                </>
              )}
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Modern wooden kitchen"
              maxLength={80}
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={setCategory} dir="ltr">
              <SelectTrigger className="w-full" aria-label="Portfolio category">
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
            <Label className="text-xs">Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One or two sentences about this item..."
              rows={3}
              maxLength={400}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border px-3 py-2.5">
            <div className="space-y-0.5">
              <Label className="text-xs">Show on landing page</Label>
              <p className="text-[10px] text-muted-foreground">
                Hidden items are only visible here
              </p>
            </div>
            <Switch
              checked={visible}
              onCheckedChange={setVisible}
              aria-label="Show on landing page"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSave({
                title: title.trim(),
                description: description.trim(),
                category,
                image,
                visible,
                ...(scene
                  ? { roomSpec: scene.roomSpec, sceneState: scene.sceneState }
                  : { roomSpec: {}, sceneState: { objects: [] } }),
              })
            }
            disabled={!canSave || saving}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Manager card ----------
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

  const live = hasLiveScene(item.sceneState);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['portfolio'] });
  };

  const toggle = useMutation({
    mutationFn: () => api.updatePortfolioItem(item.id, { visible: !item.visible }),
    onSuccess: () => {
      invalidate();
      toast({ title: item.visible ? 'Hidden from the landing page' : 'Shown on the landing page' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: () => api.deletePortfolioItem(item.id),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Portfolio item deleted' });
    },
    onError: (e: Error) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
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
    onError: (e: Error) => toast({ title: 'Reorder failed', description: e.message, variant: 'destructive' }),
  });

  const iconBtn =
    'h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent';

  return (
    <Card className="overflow-hidden">
      <div className="aspect-video bg-muted relative">
        {live ? (
          <PortfolioScene roomSpec={item.roomSpec as never} sceneState={item.sceneState as never} />
        ) : item.image ? (
          <img src={item.image} alt={`Portfolio item ${item.title}`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute top-2 start-2 flex gap-1">
          <Badge className="text-[10px] bg-black/50 text-white border-0 backdrop-blur pointer-events-none">
            {CATEGORY_LABEL[item.category] ?? 'Space'}
          </Badge>
          {live && (
            <Badge className="text-[10px] gap-1 bg-primary/90 text-primary-foreground border-0 backdrop-blur pointer-events-none">
              <Rotate3d className="h-2.5 w-2.5" /> Live 3D
            </Badge>
          )}
          {item.visible ? (
            <Badge variant="secondary" className="text-[10px] gap-1 bg-emerald-600/90 text-white border-0">
              <Eye className="h-2.5 w-2.5" /> Visible
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] gap-1 bg-black/50 text-white border-0 backdrop-blur">
              <EyeOff className="h-2.5 w-2.5" /> Hidden
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
              aria-label={`Move ${item.title} back in order`}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={iconBtn}
              onClick={() => move.mutate(1)}
              disabled={index === total - 1 || move.isPending}
              aria-label={`Move ${item.title} forward in order`}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={iconBtn}
              onClick={() => toggle.mutate()}
              disabled={toggle.isPending}
              aria-label={item.visible ? `Hide ${item.title}` : `Show ${item.title}`}
            >
              {item.visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              size="icon"
              variant="ghost"
              className={iconBtn}
              onClick={() => (window.location.hash = `/editor/pf/${item.id}`)}
              disabled={!live}
              title="Edit the 3D model in the editor"
              aria-label={`Edit the 3D model of ${item.title}`}
            >
              <Rotate3d className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className={iconBtn} onClick={() => onEdit(item)} aria-label={`Edit ${item.title}`}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={`${iconBtn} hover:text-destructive hover:bg-destructive/10`}
              onClick={() => setDelOpen(true)}
              aria-label={`Delete ${item.title}`}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>

      <AlertDialog open={delOpen} onOpenChange={setDelOpen}>
        <AlertDialogContent dir="ltr">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete portfolio item?</AlertDialogTitle>
            <AlertDialogDescription>
              “{item.title}” will be permanently removed from the portfolio. This action cannot be undone.
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

// ---------- Full panel ----------
export function PortfolioManager() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dlg, setDlg] = useState<{ open: boolean; item?: PortfolioItemDTO }>({ open: false });

  const itemsQ = useQuery({
    queryKey: ['portfolio', 'all'],
    queryFn: () => api.listPortfolio(true),
  });

  const create = useMutation({
    mutationFn: (v: SavedItem) => api.createPortfolioItem(v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio'] });
      setDlg({ open: false });
      toast({ title: 'Portfolio item added ✓' });
    },
    onError: (e: Error) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  const update = useMutation({
    mutationFn: ({ id, ...v }: { id: string } & SavedItem) => api.updatePortfolioItem(id, v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio'] });
      setDlg({ open: false });
      toast({ title: 'Portfolio item updated ✓' });
    },
    onError: (e: Error) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  const items = itemsQ.data?.items ?? [];
  const visibleCount = items.filter((i) => i.visible).length;
  const liveCount = items.filter((i) => hasLiveScene(i.sceneState)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-bold flex items-center gap-2">
            <Images className="h-5 w-5 text-primary" /> Portfolio management
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            These items appear on the public landing page (client-facing site) —{' '}
            <span className="tabular-nums">{visibleCount.toLocaleString('en-US')} shown</span> of{' '}
            <span className="tabular-nums">{items.length.toLocaleString('en-US')} items</span>
            {liveCount > 0 && (
              <>
                {' '}• <Boxes className="inline h-3 w-3 text-primary" />{' '}
                <span className="tabular-nums">{liveCount.toLocaleString('en-US')} live 3D models</span>
              </>
            )}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setDlg({ open: true })}>
          <Plus className="h-4 w-4" /> New portfolio item
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
          <p className="text-sm font-medium">No portfolio items yet</p>
          <p className="text-xs text-muted-foreground">
            Use “New portfolio item” to add a live 3D project or a photo of your work to the landing page
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
