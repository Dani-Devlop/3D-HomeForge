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
  viewer: 'Viewer (can only interact with doors/lights)',
  modifier: 'Editor (can move cabinets)',
};

const ROLE_SHORT: Record<ShareRole, string> = {
  viewer: 'Viewer',
  modifier: 'Editor',
};

/** The value that follows #/s/ — the short code if present, otherwise the full token */
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
      toast({ title: 'Link updated — viewers see the change immediately' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(link));
      toast({ title: 'Link copied ✓' });
    } catch {
      toast({ title: 'Copy failed', description: shareUrl(link), variant: 'destructive' });
    }
  };

  const expired = new Date(link.expiresAt).getTime() < Date.now();
  const slug = shareSlug(link);

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={link.active && !expired ? 'default' : 'secondary'}>
          {expired ? 'Expired' : link.active ? 'Active' : 'Inactive'}
        </Badge>
        <Badge variant="outline" className="gap-1">
          {link.role === 'viewer' ? <Eye className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
          {ROLE_SHORT[link.role]}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Expires {new Date(link.expiresAt).toLocaleDateString('en-US')}
          {typeof link.guestCount === 'number' && ` • ${link.guestCount} viewers`}
        </span>
        <div className="ms-auto flex items-center gap-1">
          <Switch
            checked={link.active && !expired}
            disabled={expired}
            onCheckedChange={(v) => patch.mutate({ active: v })}
            aria-label="Enable/disable link"
          />
          <Button size="icon" variant="ghost" onClick={copy} title="Copy link" aria-label="Copy link">
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {/* Short link — always a short, copyable single line */}
      <button
        type="button"
        dir="ltr"
        onClick={copy}
        title={shareUrl(link)}
        className="block w-full text-start text-xs text-foreground/80 bg-muted rounded px-2.5 py-1.5 font-mono truncate hover:bg-muted/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        {shareUrl(link)}
      </button>
      <p className="text-[10px] text-muted-foreground">Link code: <span dir="ltr" className="font-mono">{slug}</span> — click the bar above or the copy button to copy the full link</p>
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
      toast({ title: `Access for ${guest.name} updated` });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
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
            {new Date(guest.createdAt).toLocaleString('en-US')}
          </p>
        )}
      </div>
      <Select value={guest.role} onValueChange={(v) => patch.mutate(v as ShareRole)}>
        <SelectTrigger className="w-32 sm:w-36 h-9 text-xs shrink-0" aria-label={`Access level for ${guest.name}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="viewer">Viewer</SelectItem>
          <SelectItem value="modifier">Editor</SelectItem>
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
        toast({ title: 'Share link created and copied ✓', description: 'Send it to your client' });
      } catch {
        toast({ title: 'Link created', description: shareUrl(res.link) });
      }
    },
    onError: (e: Error) =>
      toast({ title: 'Failed to create link', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg max-h-[85dvh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Share project
          </DialogTitle>
          <DialogDescription>
            Short links, no sign-up required — the access role is embedded in the link.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="links" dir="ltr">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="links" className="gap-1.5">
              <Link2 className="h-4 w-4" /> Links
            </TabsTrigger>
            <TabsTrigger value="guests" className="gap-1.5">
              <Users className="h-4 w-4" /> Visitors
              {guestsQ.data?.guests?.length ? (
                <Badge variant="secondary" className="ms-1 h-5 px-1.5">
                  {guestsQ.data.guests.length}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="links" className="space-y-4 pt-3">
            <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
              <Label className="text-sm font-medium">Create a new link</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select value={newRole} onValueChange={(v) => setNewRole(v as ShareRole)}>
                  <SelectTrigger aria-label="Default role">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="modifier">Editor</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={expiry} onValueChange={setExpiry}>
                  <SelectTrigger aria-label="Expiration">
                    <SelectValue placeholder="Expiry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 day</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full gap-2"
                onClick={() => create.mutate()}
                disabled={create.isPending}
              >
                <Plus className="h-4 w-4" />
                {create.isPending ? 'Creating...' : 'Create share link'}
              </Button>
            </div>

            <div className="space-y-2">
              {linksQ.isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
              ) : linksQ.data?.links?.length ? (
                linksQ.data.links.map((l) => <LinkRow key={l.id} link={l} />)
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No links created yet
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="guests" className="space-y-2 pt-3">
            {guestsQ.isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
            ) : guestsQ.data?.guests?.length ? (
              guestsQ.data.guests.map((g) => (
                <GuestRow key={g.id} guest={g} projectId={projectId} />
              ))
            ) : (
              <div className="text-center py-8 space-y-2">
                <Link2Off className="h-8 w-8 mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No one has joined via a link yet
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
