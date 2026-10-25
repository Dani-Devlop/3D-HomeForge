'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Copy,
  Eye,
  Link2,
  Link2Off,
  Pencil,
  Plus,
  Users,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { api, type GuestDTO, type ShareLinkDTO } from '@/lib/api';
import type { ShareRole } from '@/lib/scene-types';

const ROLE_LABEL: Record<ShareRole, string> = {
  viewer: 'نمایشگر (فقط تعامل با درب/چراغ)',
  modifier: 'ویرایشگر (جابه‌جایی کابینت)',
};

const ROLE_SHORT: Record<ShareRole, string> = {
  viewer: 'نمایشگر',
  modifier: 'ویرایشگر',
};

/** مقداری که بعد از #/s/ می‌آید — کد کوتاه اگر هست، وگرنه توکن کامل */
export function shareSlug(link: Pick<ShareLinkDTO, 'shortCode' | 'token'>): string {
  return link.shortCode || link.token;
}

export function shareUrl(link: Pick<ShareLinkDTO, 'shortCode' | 'token'>): string {
  if (typeof window === 'undefined') return `#/s/${shareSlug(link)}`;
  return `${window.location.origin}${window.location.pathname}#/s/${shareSlug(link)}`;
}

function LinkRow({ link }: { link: ShareLinkDTO }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const patch = useMutation({
    mutationFn: (p: { active?: boolean; role?: ShareRole }) =>
      api.patchShareLink({ id: link.id, ...p }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['share-links'] });
      toast({ title: 'لینک به‌روزرسانی شد و بلافاصله برای مشتری اعمال می‌شود' });
    },
    onError: (e: Error) => toast({ title: 'خطا', description: e.message, variant: 'destructive' }),
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(link));
      toast({ title: 'لینک کپی شد ✓' });
    } catch {
      toast({ title: 'کپی نشد', description: shareUrl(link), variant: 'destructive' });
    }
  };

  const expired = new Date(link.expiresAt).getTime() < Date.now();
  const slug = shareSlug(link);

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={link.active && !expired ? 'default' : 'secondary'}>
          {expired ? 'منقضی' : link.active ? 'فعال' : 'غیرفعال'}
        </Badge>
        <Badge variant="outline" className="gap-1">
          {link.role === 'viewer' ? <Eye className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
          {ROLE_SHORT[link.role]}
        </Badge>
        <span className="text-xs text-muted-foreground">
          تا {new Date(link.expiresAt).toLocaleDateString('fa-IR')}
          {typeof link.guestCount === 'number' && ` • ${link.guestCount} بازدیدکننده`}
        </span>
        <div className="ms-auto flex items-center gap-1">
          <Switch
            checked={link.active && !expired}
            disabled={expired}
            onCheckedChange={(v) => patch.mutate({ active: v })}
            aria-label="فعال/غیرفعال کردن لینک"
          />
          <Button size="icon" variant="ghost" onClick={copy} title="کپی لینک" aria-label="کپی لینک">
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {/* لینک کوتاه — همیشه یک خط کوتاه و قابل کپی */}
      <button
        type="button"
        dir="ltr"
        onClick={copy}
        title={shareUrl(link)}
        className="block w-full text-start text-xs text-foreground/80 bg-muted rounded px-2.5 py-1.5 font-mono truncate hover:bg-muted/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        {shareUrl(link)}
      </button>
      <p className="text-[10px] text-muted-foreground">کد لینک: <span dir="ltr" className="font-mono">{slug}</span> — با کلیک روی نوار بالا یا دکمه کپی، لینک کامل کپی می‌شود</p>
    </div>
  );
}

function GuestRow({ guest, projectId }: { guest: GuestDTO; projectId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const patch = useMutation({
    mutationFn: (role: ShareRole) => api.patchGuest(guest.id, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-guests', projectId] });
      toast({ title: `دسترسی ${guest.name} تغییر کرد` });
    },
    onError: (e: Error) => toast({ title: 'خطا', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3 min-w-0">
      <span
        className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
        style={{ backgroundColor: guest.color }}
        aria-hidden
      >
        {guest.name.slice(0, 1)}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{guest.name}</p>
        {guest.createdAt && (
          <p className="text-xs text-muted-foreground">
            {new Date(guest.createdAt).toLocaleString('fa-IR')}
          </p>
        )}
      </div>
      <Select value={guest.role} onValueChange={(v) => patch.mutate(v as ShareRole)}>
        <SelectTrigger className="w-32 sm:w-36 h-9 text-xs shrink-0" aria-label={`سطح دسترسی ${guest.name}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="viewer">نمایشگر</SelectItem>
          <SelectItem value="modifier">ویرایشگر</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function ShareDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newRole, setNewRole] = useState<ShareRole>('viewer');
  const [expiry, setExpiry] = useState('7');

  const linksQ = useQuery({
    queryKey: ['share-links', projectId],
    queryFn: () => api.listShareLinks(projectId),
    enabled: open,
    refetchInterval: 6000,
  });
  const guestsQ = useQuery({
    queryKey: ['project-guests', projectId],
    queryFn: () => api.projectGuests(projectId),
    enabled: open,
    refetchInterval: 5000,
  });

  const create = useMutation({
    mutationFn: () =>
      api.createShareLink({
        projectId,
        role: newRole,
        expiresInDays: parseInt(expiry, 10) || 7,
      }),
    onSuccess: async (res) => {
      qc.invalidateQueries({ queryKey: ['share-links'] });
      try {
        await navigator.clipboard.writeText(shareUrl(res.link));
        toast({ title: 'لینک کوتاه ساخته و کپی شد ✓', description: 'برای مشتری ارسال کنید' });
      } catch {
        toast({ title: 'لینک ساخته شد', description: shareUrl(res.link) });
      }
    },
    onError: (e: Error) =>
      toast({ title: 'خطا در ساخت لینک', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg max-h-[85dvh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            اشتراک‌گذاری پروژه
          </DialogTitle>
          <DialogDescription>
            لینک کوتاه بدون نیاز به ثبت‌نام — نقش دسترسی درون لینک ذخیره می‌شود.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="links" dir="rtl">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="links" className="gap-1.5">
              <Link2 className="h-4 w-4" /> لینک‌ها
            </TabsTrigger>
            <TabsTrigger value="guests" className="gap-1.5">
              <Users className="h-4 w-4" /> بازدیدکنندگان
              {guestsQ.data?.guests?.length ? (
                <Badge variant="secondary" className="ms-1 h-5 px-1.5">
                  {guestsQ.data.guests.length}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="links" className="space-y-4 pt-3">
            <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
              <Label className="text-sm font-medium">ساخت لینک جدید</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select value={newRole} onValueChange={(v) => setNewRole(v as ShareRole)}>
                  <SelectTrigger aria-label="نقش پیش‌فرض">
                    <SelectValue placeholder="نقش" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">نمایشگر</SelectItem>
                    <SelectItem value="modifier">ویرایشگر</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={expiry} onValueChange={setExpiry}>
                  <SelectTrigger aria-label="مدت اعتبار">
                    <SelectValue placeholder="اعتبار" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">۱ روز</SelectItem>
                    <SelectItem value="7">۷ روز</SelectItem>
                    <SelectItem value="30">۳۰ روز</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full gap-2"
                onClick={() => create.mutate()}
                disabled={create.isPending}
              >
                <Plus className="h-4 w-4" />
                {create.isPending ? 'در حال ساخت...' : 'ساخت لینک اشتراکی'}
              </Button>
            </div>

            <div className="space-y-2">
              {linksQ.isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-4">در حال بارگذاری...</p>
              ) : linksQ.data?.links?.length ? (
                linksQ.data.links.map((l) => <LinkRow key={l.id} link={l} />)
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  هنوز لینکی نساخته‌اید
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="guests" className="space-y-2 pt-3">
            {guestsQ.isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">در حال بارگذاری...</p>
            ) : guestsQ.data?.guests?.length ? (
              guestsQ.data.guests.map((g) => (
                <GuestRow key={g.id} guest={g} projectId={projectId} />
              ))
            ) : (
              <div className="text-center py-8 space-y-2">
                <Link2Off className="h-8 w-8 mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  هنوز کسی با لینک وارد نشده است
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
