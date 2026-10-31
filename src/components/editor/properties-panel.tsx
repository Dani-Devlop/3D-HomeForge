'use client';

import { useState } from 'react';
import { Loader2, RotateCw, Copy, Send, Sparkles, Trash2 } from 'lucide-react';
import type { SceneObject } from '@/lib/scene-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

const isCabinet = (t: SceneObject['type']) =>
  ['base', 'wall', 'tall', 'island', 'shelf'].includes(t);
const isLight = (t: SceneObject['type']) => t === 'pendant' || t === 'floor-lamp';
const isAppliance = (t: SceneObject['type']) =>
  ['fridge', 'stove', 'hood'].includes(t);
// Types with a glass door option (clear glass — never tinted)
const GLASS_TYPES: readonly SceneObject['type'][] = ['base', 'wall', 'tall', 'island', 'shelf', 'dishwasher'];

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs">{label}</Label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-14 rounded-md border cursor-pointer bg-transparent"
        aria-label={label}
      />
    </div>
  );
}

function DimSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit = 'm',
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {value.toFixed(2)} {unit}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        aria-label={label}
      />
    </div>
  );
}

export function PropertiesPanel({
  obj,
  aiEditing,
  onUpdate,
  onUpdateParams,
  onAiEdit,
  onRotate,
  onDuplicate,
  onDelete,
}: {
  obj: SceneObject;
  aiEditing: boolean;
  onUpdate: (patch: Partial<SceneObject>) => void;
  onUpdateParams: (params: SceneObject['params']) => void;
  onAiEdit: (text: string) => void;
  onRotate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const p = obj.params;
  const [aiText, setAiText] = useState('');

  const submitAi = () => {
    const text = aiText.trim();
    if (!text || aiEditing) return;
    onAiEdit(text);
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{obj.label ?? 'Object'}</p>
            <p className="text-[11px] text-muted-foreground">ID: {obj.id}</p>
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={onRotate} title="Rotate 90°" aria-label="Rotate">
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onDuplicate} title="Duplicate" aria-label="Duplicate">
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onDelete} title="Delete" aria-label="Delete" className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ---- AI text editing ---- */}
        <div className="rounded-xl border bg-accent/30 p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-xs font-bold">Change with one sentence</p>
          </div>
          <div className="flex gap-1.5">
            <Input
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitAi();
                }
              }}
              placeholder="e.g. move it 20 cm up / make it gray"
              className="h-9 text-xs bg-card"
              aria-label="Text command to edit the object"
              maxLength={300}
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={submitAi}
              disabled={!aiText.trim() || aiEditing}
              aria-label="Apply text change"
            >
              {aiEditing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <Separator />

        {isCabinet(obj.type) && (
          <div className="space-y-4">
            <p className="text-xs font-medium text-primary">Parametric dimensions</p>
            <DimSlider label="Width" value={p.w ?? 0.8} min={0.3} max={3} step={0.05} onChange={(v) => onUpdateParams({ w: v })} />
            <DimSlider label="Height" value={p.h ?? 0.85} min={0.3} max={2.4} step={0.05} onChange={(v) => onUpdateParams({ h: v })} />
            <DimSlider label="Depth" value={p.d ?? 0.6} min={0.25} max={1.2} step={0.05} onChange={(v) => onUpdateParams({ d: v })} />
            {obj.type === 'wall' && (
              <DimSlider label="Mount height" value={p.mountY ?? 1.5} min={0.8} max={2.3} step={0.05} onChange={(v) => onUpdateParams({ mountY: v })} />
            )}

            <Separator />

            <p className="text-xs font-medium text-primary">Doors & drawers</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Doors</Label>
                <Select
                  value={String(p.doors ?? 0)}
                  onValueChange={(v) => onUpdateParams({ doors: parseInt(v, 10) })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">No doors</SelectItem>
                    <SelectItem value="1">1 door</SelectItem>
                    <SelectItem value="2">2 doors</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Drawers</Label>
                <Select
                  value={String(p.drawers ?? 0)}
                  onValueChange={(v) => onUpdateParams({ drawers: parseInt(v, 10) })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">No drawers</SelectItem>
                    <SelectItem value="1">1 drawer</SelectItem>
                    <SelectItem value="2">2 drawers</SelectItem>
                    <SelectItem value="3">3 drawers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Handle type</Label>
                <Select
                  value={p.handles ?? 'bar'}
                  onValueChange={(v) => onUpdateParams({ handles: v as 'bar' | 'knob' | 'none' })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bar">Bar</SelectItem>
                    <SelectItem value="knob">Knob</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <p className="text-xs font-medium text-primary">Colors</p>
            <ColorField label="Body" value={p.bodyColor ?? '#6b4f3a'} onChange={(v) => onUpdateParams({ bodyColor: v })} />
            <ColorField label="Door/drawer" value={p.doorColor ?? '#7d5f45'} onChange={(v) => onUpdateParams({ doorColor: v })} />
            {(obj.type === 'base' || obj.type === 'island') && (
              <ColorField label="Countertop" value={p.countertopColor ?? '#d8d3c8'} onChange={(v) => onUpdateParams({ countertopColor: v })} />
            )}
          </div>
        )}

        {/* ---- Glass door (cabinets + dishwasher, only when it has doors) ---- */}
        {GLASS_TYPES.includes(obj.type) && (p.doors ?? 0) > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Glass door</Label>
              <Switch
                checked={!!p.glass}
                onCheckedChange={(v) => onUpdateParams({ glass: v })}
                aria-label="Glass door"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">Clear transparent glass — great for display cabinets</p>
          </div>
        )}

        {/* ---- Appliances: fridge / stove / hood ---- */}
        {isAppliance(obj.type) && (
          <div className="space-y-4">
            <p className="text-xs font-medium text-primary">Appliance specs</p>
            <DimSlider
              label="Width"
              value={p.w ?? 0.7}
              min={0.3}
              max={1.2}
              step={0.05}
              onChange={(v) => onUpdateParams({ w: v })}
            />
            {obj.type === 'hood' ? (
              <DimSlider
                label="Mount height"
                value={p.mountY ?? 1.62}
                min={1.3}
                max={2.1}
                step={0.05}
                onChange={(v) => onUpdateParams({ mountY: v })}
              />
            ) : (
              <DimSlider
                label="Height"
                value={p.h ?? (obj.type === 'fridge' ? 1.8 : 0.9)}
                min={0.5}
                max={2.1}
                step={0.05}
                onChange={(v) => onUpdateParams({ h: v })}
              />
            )}
            <DimSlider
              label="Depth"
              value={p.d ?? 0.6}
              min={0.3}
              max={0.9}
              step={0.05}
              onChange={(v) => onUpdateParams({ d: v })}
            />
            <div className="flex items-center justify-between">
              <Label className="text-xs">{obj.type === 'stove' ? 'Flames on?' : 'Light on?'}</Label>
              <Switch checked={!!obj.on} onCheckedChange={(v) => onUpdate({ on: v })} aria-label="Appliance on/off" />
            </div>
            {obj.type === 'hood' && (
              <DimSlider
                label="Light intensity"
                value={p.intensity ?? 0.9}
                min={0.1}
                max={2.5}
                step={0.1}
                unit=""
                onChange={(v) => onUpdateParams({ intensity: v })}
              />
            )}
            <Separator />
            <p className="text-xs font-medium text-primary">Colors</p>
            <ColorField label="Body" value={p.bodyColor ?? '#b9bec6'} onChange={(v) => onUpdateParams({ bodyColor: v })} />
            {obj.type !== 'hood' && (
              <ColorField label="Door" value={p.doorColor ?? p.bodyColor ?? '#cdd2d9'} onChange={(v) => onUpdateParams({ doorColor: v })} />
            )}
          </div>
        )}

        {isLight(obj.type) && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs">On / Off</Label>
              <Switch checked={!!obj.on} onCheckedChange={(v) => onUpdate({ on: v })} aria-label="Light on/off" />
            </div>
            <DimSlider
              label="Light intensity"
              value={p.intensity ?? 1.4}
              min={0.1}
              max={3}
              step={0.1}
              unit=""
              onChange={(v) => onUpdateParams({ intensity: v })}
            />
            <ColorField label="Light color" value={p.color ?? '#f59e0b'} onChange={(v) => onUpdateParams({ color: v })} />
          </div>
        )}

        {/* ---- TV: mount height + screen on/off ---- */}
        {obj.type === 'tv' && (
          <div className="space-y-4">
            <p className="text-xs font-medium text-primary">Wall mount</p>
            <DimSlider
              label="Mount height"
              value={p.mountY ?? 1.4}
              min={0.4}
              max={2.2}
              step={0.05}
              onChange={(v) => onUpdateParams({ mountY: v })}
            />
            <div className="flex items-center justify-between">
              <Label className="text-xs">Screen on?</Label>
              <Switch checked={!!obj.on} onCheckedChange={(v) => onUpdate({ on: v })} aria-label="TV screen on/off" />
            </div>
          </div>
        )}

        {/* ---- Microwave: height from floor ---- */}
        {obj.type === 'microwave' && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-primary">Placement</p>
            <DimSlider
              label="Height from floor"
              value={p.mountY ?? 0.9}
              min={0.5}
              max={1.4}
              step={0.05}
              onChange={(v) => onUpdateParams({ mountY: v })}
            />
          </div>
        )}

        {(obj.type === 'plant' || obj.type === 'rug') && (
          <div className="space-y-4">
            <ColorField label="Color" value={p.color ?? '#2e7d32'} onChange={(v) => onUpdateParams({ color: v })} />
            <DimSlider
              label="Scale"
              value={p.scale ?? 1}
              min={0.5}
              max={2.5}
              step={0.1}
              unit="×"
              onChange={(v) => onUpdateParams({ scale: v })}
            />
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
