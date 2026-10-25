'use client';

import { useState } from 'react';
import {
  AirVent,
  Armchair,
  BedDouble,
  Box,
  DoorClosed,
  Flame,
  Flower2,
  Lamp,
  LampCeiling,
  LayoutPanelTop,
  Loader2,
  Microwave,
  RectangleHorizontal,
  Refrigerator,
  Rows3,
  Sofa,
  Sparkles,
  Table,
  Table2,
  Tv,
  UtensilsCrossed,
  WashingMachine,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  CATALOG,
  CATALOG_CATEGORY_LABEL,
  type CatalogCategory,
  type CatalogItem,
  type ObjectType,
} from '@/lib/scene-types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const ICONS: Record<ObjectType, LucideIcon> = {
  base: Box,
  wall: LayoutPanelTop,
  tall: DoorClosed,
  island: Table2,
  shelf: Rows3,
  fridge: Refrigerator,
  stove: Flame,
  hood: AirVent,
  tv: Tv,
  sofa: Sofa,
  bed: BedDouble,
  table: Table,
  chair: Armchair,
  washer: WashingMachine,
  dishwasher: UtensilsCrossed,
  microwave: Microwave,
  pendant: LampCeiling,
  'floor-lamp': Lamp,
  plant: Flower2,
  rug: RectangleHorizontal,
};

const GROUPS: CatalogCategory[] = ['cabinet', 'appliance', 'furniture', 'light', 'decor'];

export function LibraryPanel({
  onPick,
  onGenerate,
  generating,
}: {
  onPick: (item: CatalogItem) => void;
  onGenerate: (text: string) => void;
  generating: boolean;
}) {
  const [prompt, setPrompt] = useState('');

  const submit = () => {
    const text = prompt.trim();
    if (!text || generating) return;
    onGenerate(text);
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        {/* ---- تولید مدل با توصیف متنی (text-to-3D) ---- */}
        <div className="rounded-xl border bg-accent/30 p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-xs font-bold">ساخت کابینت با یک جمله</p>
          </div>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="مثلاً: کابینت زمینی با درب شیشه‌ای، عرض ۸۰ سانت، رنگ سفید مات"
            rows={2}
            className="text-xs min-h-[60px] resize-none bg-card"
            aria-label="توصیف متنی کابینت"
            maxLength={500}
          />
          <Button
            size="sm"
            className="w-full gap-1.5 h-9"
            onClick={submit}
            disabled={!prompt.trim() || generating}
          >
            {generating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                در حال ساخت مدل...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                تولید مدل سه‌بعدی
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          آیتم را بکشید و داخل صحنه رها کنید — یا برای افزودن سریع کلیک کنید.
        </p>
        {GROUPS.map((cat) => (
          <div key={cat} className="space-y-2">
            <Badge variant="secondary" className="text-xs">
              {CATALOG_CATEGORY_LABEL[cat]}
            </Badge>
            <div className="grid grid-cols-2 gap-2">
              {CATALOG.filter((c) => c.category === cat).map((item, i) => {
                const Icon = ICONS[item.type];
                return (
                  <button
                    key={`${item.type}-${i}`}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        'application/x-c3d-item',
                        JSON.stringify({ type: item.type, label: item.label })
                      );
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => onPick(item)}
                    className="group flex flex-col items-center gap-1.5 rounded-lg border bg-card p-3 text-center transition-all hover:border-primary/60 hover:bg-accent/60 active:scale-95 cursor-grab active:cursor-grabbing min-h-[72px] touch-manipulation"
                    title={item.description}
                    aria-label={`افزودن ${item.label}`}
                  >
                    <Icon className="h-5 w-5 text-primary/80 group-hover:text-primary transition-colors" />
                    <span className="text-xs font-medium leading-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
