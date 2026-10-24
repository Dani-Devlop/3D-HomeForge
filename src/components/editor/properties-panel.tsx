'use client';

import { Copy, RotateCw, Trash2 } from 'lucide-react';
import type { SceneObject } from '@/lib/scene-types';
import { Button } from '@/components/ui/button';
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
  unit = 'متر',
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
  onUpdate,
  onUpdateParams,
  onRotate,
  onDuplicate,
  onDelete,
}: {
  obj: SceneObject;
  onUpdate: (patch: Partial<SceneObject>) => void;
  onUpdateParams: (params: SceneObject['params']) => void;
  onRotate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const p = obj.params;

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{obj.label ?? 'آبجکت'}</p>
            <p className="text-[11px] text-muted-foreground">شناسه: {obj.id}</p>
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={onRotate} title="چرخش ۹۰ درجه" aria-label="چرخش">
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onDuplicate} title="تکثیر" aria-label="تکثیر">
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onDelete} title="حذف" aria-label="حذف" className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Separator />

        {isCabinet(obj.type) && (
          <div className="space-y-4">
            <p className="text-xs font-medium text-primary">ابعاد پارامتریک</p>
            <DimSlider label="عرض" value={p.w ?? 0.8} min={0.3} max={3} step={0.05} onChange={(v) => onUpdateParams({ w: v })} />
            <DimSlider label="ارتفاع" value={p.h ?? 0.85} min={0.3} max={2.4} step={0.05} onChange={(v) => onUpdateParams({ h: v })} />
            <DimSlider label="عمق" value={p.d ?? 0.6} min={0.25} max={1.2} step={0.05} onChange={(v) => onUpdateParams({ d: v })} />
            {obj.type === 'wall' && (
              <DimSlider label="ارتفاع نصب" value={p.mountY ?? 1.5} min={0.8} max={2.3} step={0.05} onChange={(v) => onUpdateParams({ mountY: v })} />
            )}

            <Separator />

            <p className="text-xs font-medium text-primary">درب و کشو</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">تعداد درب</Label>
                <Select
                  value={String(p.doors ?? 0)}
                  onValueChange={(v) => onUpdateParams({ doors: parseInt(v, 10) })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">بدون درب</SelectItem>
                    <SelectItem value="1">۱ درب</SelectItem>
                    <SelectItem value="2">۲ درب</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">تعداد کشو</Label>
                <Select
                  value={String(p.drawers ?? 0)}
                  onValueChange={(v) => onUpdateParams({ drawers: parseInt(v, 10) })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">بدون کشو</SelectItem>
                    <SelectItem value="1">۱ کشو</SelectItem>
                    <SelectItem value="2">۲ کشو</SelectItem>
                    <SelectItem value="3">۳ کشو</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">نوع دستگیره</Label>
                <Select
                  value={p.handles ?? 'bar'}
                  onValueChange={(v) => onUpdateParams({ handles: v as 'bar' | 'knob' | 'none' })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bar">میله‌ای</SelectItem>
                    <SelectItem value="knob">دکمه‌ای</SelectItem>
                    <SelectItem value="none">بدون دستگیره</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <p className="text-xs font-medium text-primary">رنگ‌ها</p>
            <ColorField label="بدنه" value={p.bodyColor ?? '#6b4f3a'} onChange={(v) => onUpdateParams({ bodyColor: v })} />
            <ColorField label="درب/کشو" value={p.doorColor ?? '#7d5f45'} onChange={(v) => onUpdateParams({ doorColor: v })} />
            {(obj.type === 'base' || obj.type === 'island') && (
              <ColorField label="رویه" value={p.countertopColor ?? '#d8d3c8'} onChange={(v) => onUpdateParams({ countertopColor: v })} />
            )}
          </div>
        )}

        {isLight(obj.type) && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs">روشن / خاموش</Label>
              <Switch checked={!!obj.on} onCheckedChange={(v) => onUpdate({ on: v })} aria-label="روشنایی" />
            </div>
            <DimSlider
              label="شدت نور"
              value={p.intensity ?? 1.4}
              min={0.1}
              max={3}
              step={0.1}
              unit=""
              onChange={(v) => onUpdateParams({ intensity: v })}
            />
            <ColorField label="رنگ چراغ" value={p.color ?? '#f59e0b'} onChange={(v) => onUpdateParams({ color: v })} />
          </div>
        )}

        {(obj.type === 'plant' || obj.type === 'rug') && (
          <div className="space-y-4">
            <ColorField label="رنگ" value={p.color ?? '#2e7d32'} onChange={(v) => onUpdateParams({ color: v })} />
            <DimSlider
              label="مقیاس"
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
