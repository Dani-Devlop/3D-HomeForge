import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import ZAI from 'z-ai-web-dev-sdk';
import type { ChatMessage } from 'z-ai-web-dev-sdk';
import { getOwner } from '@/lib/auth';
import { readJsonBody } from '@/app/api/_lib/serialize';
import {
  clamp,
  extractJsonObject,
  isRecord,
  KIND_DEFAULT_D,
  KIND_LABELS,
  normalizePartialParams,
  ROOM_TYPES,
  shadeColor,
  toColor,
  toFurnitureKind,
  toFinite,
  toWall,
  type FurnitureKind,
} from '@/app/api/_lib/normalize';
import { placeAtWall } from '@/lib/scene-types';
import type { ObjectType, RoomSpec, SceneObject, WallName } from '@/lib/scene-types';

// ============================================================
// /api/ai/room — طراحی کامل فضا از یک توصیف متنی (text-to-room)
// «آشپزخانه ۴ متری مدرن با کابینت سفید و جزیره» → roomSpec + آبجکت‌ها
// ============================================================

const ROOM_PROMPT = `You are a professional interior designer for a 3D home/cabinet design app.
Convert the user's description (Persian or English) into a COMPLETE, sensible room design:
dimensions, color palette, windows/doorways, and a realistic furniture/cabinet layout.

Return ONLY a JSON object (no markdown fences, no commentary) shaped exactly like:
{
  "roomType": "kitchen"|"bedroom"|"living"|"dining"|"bathroom"|"office"|"other",
  "room": {
    "widthM": number,   // 2..8 (x axis)
    "depthM": number,   // 2..8 (z axis)
    "heightM": number,  // 2.4..3.5
    "wallColor": "#hex", "floorColor": "#hex", "ceilingColor": "#hex",
    "windows": [ { "wall": "back"|"front"|"left"|"right", "offsetX": number, "sillY": number, "width": number, "height": number } ],
    "doorways": [ { "wall": "back"|"front"|"left"|"right", "offsetX": number, "width": number, "height": number } ]
  },
  "items": [
    { "kind": "base"|"wall"|"tall"|"island"|"shelf"|"fridge"|"stove"|"hood"|"tv"|"sofa"|"bed"|"table"|"chair"|"washer"|"dishwasher"|"microwave",
      "wall": "back"|"front"|"left"|"right", "offsetX": number,
      "widthM": number, "heightM": number, "depthM": number,
      "glassDoors": boolean, "colorHex": "#hex", "description": "برچسب فارسی کوتاه" }
  ]
}

DESIGN RULES:
- All coordinates in meters. offsetX = horizontal distance from the CENTER of the chosen wall (negative = left when facing the wall from inside).
- Wall "back" = z=-depth/2 (its items face +z), "front" = z=+depth/2 (face -z), "left" = x=-width/2 (face +x), "right" = x=+width/2 (face -x).
- Keep items INSIDE their wall length: offsetX must satisfy |offsetX| <= wallLength/2 - itemWidth/2 - 0.1.
- Realistic kitchens: line the base cabinets along the back wall, appliances (stove between cabinets, hood above stove with same offsetX, fridge at a corner), wall cabinets above base cabinets (skip where window/hood is), optionally an island in the middle if widthM*depthM >= 12.
- max 14 items total. Do NOT duplicate the same appliance. Cabinet rows: align offsets so adjacent items touch (e.g. -1.2, -0.4, 0.4).
- Colors harmonious hex (#rrggbb lowercase). floorColor is wood/ceramic tone; wallColor light neutral; ceiling near-white.
- Persian number words: یک=1 دو=2 سه=3 چهار=4 پنج=5 شش=6 هفت=7 هشت=8 نه=9 ده=10. «۴ متری» = 4 meters.
- Windows: sillY 0.8..1.4, width 0.9..2.2, height 1.0..1.6, at most 3, NOT behind wall cabinets (leave gap in wall cabinets where window sits).
- Doorways: width 0.85..1.2, height 2.0..2.3, at most 2.
- Glass doors ONLY when explicitly requested (درب شیشه‌ای).
- description for each item = SHORT Persian label (max 30 chars).`;

const bodySchema = z.object({
  text: z.string().trim().min(3).max(600),
});

interface RoomAnalysis {
  roomType: string;
  room: {
    widthM: number;
    depthM: number;
    heightM: number;
    wallColor: string;
    floorColor: string;
    ceilingColor: string;
    windows: { wall: WallName; offsetX: number; sillY: number; width: number; height: number }[];
    doorways: { wall: WallName; offsetX: number; width: number; height: number }[];
  };
  items: {
    kind: FurnitureKind;
    wall: WallName;
    offsetX: number;
    widthM: number;
    heightM: number;
    depthM: number;
    glassDoors: boolean;
    colorHex: string;
    description: string;
  }[];
}

const ITEM_LABELS: Record<string, string> = {
  base: 'کابینت زمینی (طراحی‌شده)', wall: 'کابینت دیواری (طراحی‌شده)',
  tall: 'کابینت بلند (طراحی‌شده)', island: 'جزیره (طراحی‌شده)',
  shelf: 'قفسه باز (طراحی‌شده)', fridge: 'یخچال (طراحی‌شده)',
  stove: 'اجاق گاز (طراحی‌شده)', hood: 'هود (طراحی‌شده)',
  tv: 'تلویزیون (طراحی‌شده)', sofa: 'مبل (طراحی‌شده)',
  bed: 'تخت (طراحی‌شده)', table: 'میز (طراحی‌شده)',
  chair: 'صندلی (طراحی‌شده)', washer: 'ماشین لباسشویی (طراحی‌شده)',
  dishwasher: 'ماشین ظرفشویی (طراحی‌شده)', microwave: 'مایکروویو (طراحی‌شده)',
};

/** انواعی که درب شیشه‌ای می‌پذیرند */
const GLASS_KINDS: ReadonlySet<string> = new Set([
  'base', 'wall', 'tall', 'island', 'shelf', 'dishwasher',
]);

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

const lightenIfDark = (hex: string): string =>
  luminance(hex) < 0.35 ? shadeColor(hex, 0.65) : hex;

function normalizeAnalysis(data: unknown): RoomAnalysis | null {
  if (!isRecord(data)) return null;
  const roomRaw = isRecord(data.room) ? data.room : null;
  if (!roomRaw) return null;

  const roomType =
    typeof data.roomType === 'string' && (ROOM_TYPES as readonly string[]).includes(data.roomType)
      ? data.roomType
      : 'other';

  const windowsRaw = Array.isArray(roomRaw.windows) ? roomRaw.windows : [];
  const doorwaysRaw = Array.isArray(roomRaw.doorways) ? roomRaw.doorways : [];
  const itemsRaw = Array.isArray(data.items) ? data.items : [];

  const room: RoomAnalysis['room'] = {
    widthM: clamp(toFinite(roomRaw.widthM, 4), 2, 8),
    depthM: clamp(toFinite(roomRaw.depthM, 3.4), 2, 8),
    heightM: clamp(toFinite(roomRaw.heightM, 2.8), 2.4, 3.5),
    wallColor: toColor(roomRaw.wallColor, '#ece7dd'),
    floorColor: toColor(roomRaw.floorColor, '#a97c50'),
    ceilingColor: toColor(roomRaw.ceilingColor, '#fafafa'),
    windows: windowsRaw.slice(0, 3).map((w) => {
      const r = isRecord(w) ? w : {};
      return {
        wall: toWall(r.wall),
        offsetX: clamp(toFinite(r.offsetX, 0), -7, 7),
        sillY: clamp(toFinite(r.sillY, 0.9), 0.3, 1.8),
        width: clamp(toFinite(r.width, 1.2), 0.6, 2.6),
        height: clamp(toFinite(r.height, 1.2), 0.6, 2.2),
      };
    }),
    doorways: doorwaysRaw.slice(0, 2).map((d) => {
      const r = isRecord(d) ? d : {};
      return {
        wall: toWall(r.wall),
        offsetX: clamp(toFinite(r.offsetX, 0), -7, 7),
        width: clamp(toFinite(r.width, 0.95), 0.8, 1.4),
        height: clamp(toFinite(r.height, 2.05), 1.9, 2.5),
      };
    }),
  };

  const items: RoomAnalysis['items'] = itemsRaw.slice(0, 14).map((it) => {
    const r = isRecord(it) ? it : {};
    const kind = toFurnitureKind(r.kind);
    return {
      kind,
      wall: toWall(r.wall),
      offsetX: clamp(toFinite(r.offsetX, 0), -7, 7),
      widthM: clamp(toFinite(r.widthM, 0.8), 0.3, 3),
      heightM: clamp(toFinite(r.heightM, kind === 'fridge' ? 1.8 : 0.85), 0.1, 2.4),
      depthM: clamp(toFinite(r.depthM, KIND_DEFAULT_D[kind]), 0.05, 2.3),
      glassDoors: r.glassDoors === true,
      colorHex: toColor(r.colorHex, '#7d5f45'),
      description:
        typeof r.description === 'string' && r.description.trim()
          ? r.description.trim().slice(0, 30)
          : ITEM_LABELS[kind] ?? KIND_LABELS[kind],
    };
  });

  return { roomType, room, items };
}

function clampOffsetOnWall(wall: WallName, offsetX: number, itemWidth: number, room: RoomAnalysis['room']) {
  const wallLength = wall === 'back' || wall === 'front' ? room.widthM : room.depthM;
  const maxAbs = wallLength / 2 - 0.05 - itemWidth / 2;
  return maxAbs <= 0 ? 0 : clamp(offsetX, -maxAbs, maxAbs);
}

function buildObject(item: RoomAnalysis['items'][number], room: RoomAnalysis['room']): SceneObject {
  const kind = item.kind;
  const w = item.widthM;
  const h = item.heightM;
  const d = item.depthM;
  const color = item.colorHex;

  let rawParams: Record<string, unknown>;
  if (kind === 'fridge') {
    rawParams = { w, h, d, color, bodyColor: color, doorColor: shadeColor(color, 0.2), doors: 1, drawers: 0, handles: 'bar' };
  } else if (kind === 'stove') {
    rawParams = { w, h, d, color, bodyColor: color, doorColor: shadeColor(color, 0.15), countertopColor: '#1e2024', doors: 1, drawers: 0, handles: 'bar' };
  } else if (kind === 'hood') {
    rawParams = { w, h: 0.14, d, color, bodyColor: color, doors: 0, drawers: 0, handles: 'none', mountY: 1.62 };
  } else if (kind === 'wall') {
    rawParams = { w, h, d, bodyColor: color, doorColor: shadeColor(color, 0.2), countertopColor: '#d8d3c8', doors: w > 0.7 ? 2 : 1, drawers: 0, handles: 'bar', mountY: 1.5 };
  } else if (kind === 'tv') {
    rawParams = { w, h, d: 0.06, color: '#101318', bodyColor: '#1b1f26', mountY: 1.4 };
  } else if (kind === 'sofa') {
    rawParams = { w, h: clamp(h, 0.7, 1.0), d: clamp(d, 0.8, 1.2), color, bodyColor: shadeColor(color, -0.15) };
  } else if (kind === 'bed') {
    rawParams = { w, h: 0.55, d: clamp(d, 1.8, 2.2), color, bodyColor: shadeColor(color, -0.2) };
  } else if (kind === 'table') {
    rawParams = { w, h: 0.75, d: clamp(d, 0.7, 1.2), color, bodyColor: shadeColor(color, -0.1) };
  } else if (kind === 'chair') {
    rawParams = { w: 0.45, h: 0.9, d: 0.5, color, bodyColor: color };
  } else if (kind === 'washer') {
    rawParams = { w: 0.6, h: 0.85, d: 0.6, color, bodyColor: color };
  } else if (kind === 'dishwasher') {
    rawParams = { w: 0.6, h: 0.85, d: 0.6, color, bodyColor: color, doors: 1, handles: 'bar' };
  } else if (kind === 'microwave') {
    rawParams = { w: clamp(w, 0.4, 0.7), h: 0.3, d: 0.38, color, bodyColor: color, mountY: 0.9 };
  } else {
    rawParams = { w, h, d, bodyColor: color, doorColor: shadeColor(color, 0.2), countertopColor: '#d8d3c8', doors: w > 0.7 ? 2 : 1, drawers: 0, handles: 'bar' };
  }

  if (GLASS_KINDS.has(kind)) {
    rawParams.glass = item.glassDoors === true;
    if (item.glassDoors) {
      if (typeof rawParams.bodyColor === 'string') rawParams.bodyColor = lightenIfDark(rawParams.bodyColor);
      if (typeof rawParams.doorColor === 'string') rawParams.doorColor = lightenIfDark(rawParams.doorColor);
    }
  }

  const params = normalizePartialParams(rawParams, kind);
  const y = kind === 'wall' || kind === 'hood' || kind === 'tv' || kind === 'microwave'
    ? params.mountY ?? 0
    : 0;

  const offsetX = clampOffsetOnWall(item.wall, item.offsetX, w, room);
  const { position, rotationY } = placeAtWall(
    item.wall,
    offsetX,
    d,
    { widthM: room.widthM, depthM: room.depthM },
    y,
  );

  return {
    id: crypto.randomUUID().slice(0, 8),
    type: kind as ObjectType,
    label: item.description || ITEM_LABELS[kind],
    params,
    position,
    rotationY,
    ...(kind === 'tv' ? { on: false } : {}),
  };
}

export async function POST(req: NextRequest) {
  // گارد مالک — تولید AI فقط برای مدیر
  if (!(await getOwner(req))) {
    return NextResponse.json(
      { error: 'برای این عملیات باید به‌عنوان مدیر وارد شوید' },
      { status: 401 },
    );
  }

  const body = await readJsonBody(req);
  if (!body.ok) {
    return NextResponse.json({ error: 'داده ارسالی نامعتبر است' }, { status: 400 });
  }

  try {
    const parsed = bodySchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'توصیف فضا را بین ۳ تا ۶۰۰ کاراکتر وارد کنید' },
        { status: 400 },
      );
    }

    const zai = await ZAI.create();
    const messages: ChatMessage[] = [
      { role: 'system', content: ROOM_PROMPT },
      { role: 'user', content: parsed.data.text },
    ];

    let analysis: RoomAnalysis | null = null;
    for (let attempt = 1; attempt <= 2 && !analysis; attempt++) {
      try {
        const completion = await zai.chat.completions.create({
          messages,
          thinking: { type: 'disabled' },
        });
        const content = completion?.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || !content.trim()) {
          throw new Error('پاسخ خالی از مدل');
        }
        analysis = normalizeAnalysis(extractJsonObject(content));
      } catch (err) {
        console.error(`[ai/room] attempt ${attempt} failed:`, err);
      }
    }

    if (!analysis) {
      return NextResponse.json(
        { error: 'طراحی فضا با هوش مصنوعی ناموفق بود — دوباره تلاش کنید' },
        { status: 502 },
      );
    }

    const roomSpec: RoomSpec = {
      widthM: analysis.room.widthM,
      depthM: analysis.room.depthM,
      heightM: analysis.room.heightM,
      wallColor: analysis.room.wallColor,
      floorColor: analysis.room.floorColor,
      ceilingColor: analysis.room.ceilingColor,
      windows: analysis.room.windows,
      doorways: analysis.room.doorways,
    };
    const objects = analysis.items.map((it) => buildObject(it, analysis!.room));

    return NextResponse.json({
      roomType: analysis.roomType,
      roomSpec,
      objects,
      description: `طراحی با ${objects.length.toLocaleString('fa-IR')} قطعه از توصیف متنی شما ساخته شد`,
    });
  } catch (err) {
    console.error('POST /api/ai/room failed:', err);
    return NextResponse.json(
      { error: 'طراحی فضا با هوش مصنوعی ناموفق بود' },
      { status: 502 },
    );
  }
}
