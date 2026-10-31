'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Trash2 } from 'lucide-react';
import type { SceneObject } from '@/lib/scene-types';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

export function PresetsPanel({
  selectedObjects,
  onInsert,
}: {
  selectedObjects: SceneObject[];
  onInsert: (objects: Partial<SceneObject>[]) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState('');

  const presetsQ = useQuery({ queryKey: ['presets'], queryFn: api.listPresets });

  const save = useMutation({
    mutationFn: () => {
      // Relative offsets from the first selected object
      const base = selectedObjects[0].position;
      const data = selectedObjects.map((o) => ({
        ...o,
        position: [
          +(o.position[0] - base[0]).toFixed(3),
          o.position[1],
          +(o.position[2] - base[2]).toFixed(3),
        ] as [number, number, number],
      }));
      return api.createPreset({ name: name.trim() || 'Untitled preset', data });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['presets'] });
      setName('');
      toast({ title: 'Preset saved ✓', description: 'Reusable in your future projects' });
    },
    onError: (e: Error) =>
      toast({ title: 'Failed to save preset', description: e.message, variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.deletePreset(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['presets'] }),
  });

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
          <p className="text-xs font-medium">Save the current selection as a preset</p>
          {selectedObjects.length > 0 ? (
            <>
              <p className="text-[11px] text-muted-foreground">
                {selectedObjects.length} objects selected — Shift+click to select multiple
              </p>
              <div className="flex gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Preset name (e.g. full unit)"
                  className="h-9 text-xs"
                  maxLength={50}
                />
                <Button size="sm" className="h-9 gap-1 shrink-0" onClick={() => save.mutate()} disabled={save.isPending}>
                  <Save className="h-3.5 w-3.5" />
                  Save
                </Button>
              </div>
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Select one or more cabinets in the scene first (click + Shift for multiple)
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Badge variant="secondary" className="text-xs">Saved presets</Badge>
          {presetsQ.isLoading ? (
            <p className="text-xs text-muted-foreground py-2">Loading...</p>
          ) : presetsQ.data?.presets?.length ? (
            presetsQ.data.presets.map((preset) => (
              <div key={preset.id} className="flex items-center gap-2 rounded-lg border bg-card p-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{preset.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {preset.data.length} objects • {new Date(preset.createdAt).toLocaleDateString('en-US')}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="h-8 gap-1 shrink-0" onClick={() => onInsert(preset.data)}>
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => del.mutate(preset.id)}
                  aria-label={`Delete preset ${preset.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">
              No presets saved yet
            </p>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
