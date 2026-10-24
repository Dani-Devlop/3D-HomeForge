'use client';

import {
  Box,
  Flower2,
  Lamp,
  LampCeiling,
  LayoutPanelTop,
  RectangleHorizontal,
  Refrigerator,
  Rows3,
  Table2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CATALOG, type CatalogCategory, type CatalogItem, type ObjectType } from '@/lib/scene-types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

const ICONS: Record<ObjectType, LucideIcon> = {
  base: Box,
  wall: LayoutPanelTop,
  tall: Refrigerator,
  island: Table2,
  shelf: Rows3,
  pendant: LampCeiling,
  'floor-lamp': Lamp,
  plant: Flower2,
  rug: RectangleHorizontal,
};

const CATEGORY_LABEL: Record<CatalogCategory, string> = {
  cabinet: 'کابینت‌ها',
  light: 'چراغ‌ها',
  decor: 'دکور',
};

export function LibraryPanel({
  onPick,
}: {
  onPick: (item: CatalogItem) => void;
}) {
  const groups: CatalogCategory[] = ['cabinet', 'light', 'decor'];

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          آیتم را بکشید و داخل صحنه رها کنید — یا برای افزودن سریع کلیک کنید.
        </p>
        {groups.map((cat) => (
          <div key={cat} className="space-y-2">
            <Badge variant="secondary" className="text-xs">
              {CATEGORY_LABEL[cat]}
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
