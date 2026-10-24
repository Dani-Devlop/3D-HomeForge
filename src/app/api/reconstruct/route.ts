import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import ZAI from 'z-ai-web-dev-sdk';
import type {
  ChatMessage,
  CreateChatCompletionVisionBody,
  VisionMessage,
} from 'z-ai-web-dev-sdk';
import type { ObjectType, RoomSpec, SceneObject, WallName } from '@/lib/scene-types';
import { placeAtWall } from '@/lib/scene-types';
import { readJsonBody } from '@/app/api/_lib/serialize';
import {
  clamp,
  extractJsonObject,
  isRecord,
  KIND_DEFAULT_D,
  normalizePartialParams,
  ROOM_TYPES,
  shadeColor,
  toColor,
  toFurnitureKind,
  toFinite,
  toWall,
  type FurnitureKind,
} from '@/app/api/_lib/normalize';

// ============================================================
// /api/reconstruct — بازسازی سه‌بعدی فضا از یک تا پنج عکس (یا فریم ویدیو)
// v2: تحلیل چندعکسی + تشخیص کابینت‌ها و لوازم موجود + ادغام نتایج
// ============================================================

const RECONSTRUCT_PROMPT = `You are an expert interior-space analyzer for a 3D room reconstruction pipeline (v2).
Analyze the attached room photo and produce a structured metric reconstruction.

Guidelines:
1. Identify the room type: one of "kitchen", "bedroom", "living", "dining", "bathroom", "office", "other".
2. Estimate realistic METRIC dimensions of the space using visual cues in the photo:
   - an interior door is about 2.1 m tall,
   - a kitchen countertop is about 0.9 m high,
   - a ceiling is typically 2.7 m to 3.0 m high.
   Use these references to estimate room width (m), depth (m) and height (m).
3. Identify the dominant color of walls, floor and ceiling as hex codes (#rrggbb).
4. Locate windows and doorways. Wall naming: "back" = the main wall you are facing in the photo,
   "front" = the wall behind the camera, "left"/"right" = the side walls.
   For each window report: wall, offsetX (horizontal distance in meters from the wall center, -3..3),
   sillY (height of the window sill above the floor in meters, 0.3..1.8), width (0.6..2.6 m), height (0.6..2.2 m).
   For each doorway report: wall, offsetX (-3..3), width (0.8..1.4 m), height (1.9..2.5 m).
5. Detect EXISTING furniture/equipment visible in the photo and report each as an "item":
   - kind must be exactly one of: "base" (floor cabinet), "wall" (upper wall cabinet), "tall" (full-height unit),
     "island" (kitchen island), "shelf" (open shelves), "fridge" (refrigerator), "stove" (stove/oven), "hood" (range hood).
   - For each item report: the wall it stands against ("back"|"left"|"right"|"front" — for an island pick the wall it is
     closest and parallel to), offsetX (distance in meters of the item center from that wall's center, -5..5),
     widthM (0.3..3), heightM (0.3..2.4), depthM (0.25..1.2, optional), colorHex (dominant color, #rrggbb),
     description (short, English or Persian).
   - IMPORTANT: a long run of base cabinets along one wall must be reported as SEPARATE segments of 0.6..1.2 m each,
     so every segment can be edited individually. Report fridge / stove / hood each as their own item.
   - Do not report items you cannot see.

Respond with ONLY a JSON object — no markdown fences, no commentary — shaped exactly like:
{
  "roomType": "kitchen"|"bedroom"|"living"|"dining"|"bathroom"|"office"|"other",
  "room": { "widthM": number, "depthM": number, "heightM": number, "wallColor": "#hex", "floorColor": "#hex", "ceilingColor": "#hex" },
  "windows": [ { "wall": "back"|"left"|"right"|"front", "offsetX": number, "sillY": number, "width": number, "height": number } ],
  "doorways": [ { "wall": "back"|"left"|"right"|"front", "offsetX": number, "width": number, "height": number } ],
  "items": [ { "kind": "base"|"wall"|"tall"|"island"|"shelf"|"fridge"|"stove"|"hood", "wall": "back"|"left"|"right"|"front", "offsetX": number, "widthM": number, "heightM": number, "depthM": number, "colorHex": "#hex", "description": "short" } ],
  "description": "کوتاه به فارسی"
}`;

const MERGE_PROMPT = `You merge several partial photo analyses of the SAME room into ONE final reconstruction spec.
You receive an array of partial JSON analyses, each produced from one photo of the same space (possibly from different angles).
Produce the UNION/CONSENSUS of them:
- "room": take the LARGEST plausible widthM and depthM across the parts and a sensible heightM (they describe the same room);
  pick the most consistent wallColor / floorColor / ceilingColor.
- "windows": union of all windows, deduplicated — windows on the same wall whose offsetX differs by less than ~0.5 m and
  whose size is similar are the SAME window (keep the more complete variant). Map walls between photos taken from
  different angles as best you can using the room description.
- "doorways": same dedup rule as windows.
- "items": union of all furniture items, deduplicated by kind + wall + approximate offsetX (within ~0.6 m);
  for duplicates keep the largest / most complete variant. Do NOT invent items that no part reported.
- "roomType": the most frequent value; "description": keep the richest Persian description (or merge them into one short paragraph).
Respond with ONLY a JSON object of exactly the same shape as the inputs (roomType, room, windows, doorways, items, description) —
no markdown fences, no commentary.`;

const MAX_IMAGE_LENGTH = 7 * 1024 * 1024; // حداکثر ~7MB رشته base64
const MAX_IMAGES = 5;
const DATA_URL_RE = /^data:image\/[a-zA-Z0-9.+-]+;base64,/;
const RAW_BASE64_RE = /^[A-Za-z0-9+/=\r\n]+$/;

const bodySchema = z.object({
  images: z.array(z.string().min(1)).min(1).max(MAX_IMAGES).optional(),
  image: z.string().min(1).optional(), // سازگاری با نسخه ۱
});

// ---------------- انواع داخلی ----------------

interface ReconstructItem {
  kind: FurnitureKind;
  wall: WallName;
  offsetX: number;
  widthM: number;
  heightM: number;
  depthM?: number;
  colorHex: string;
  description: string;
}

interface Analysis {
  roomType: string;
  room: {
    widthM: number;
    depthM: number;
    heightM: number;
    wallColor: string;
    floorColor: string;
    ceilingColor: string;
  };
  windows: {
    wall: WallName;
    offsetX: number;
    sillY: number;
    width: number;
    height: number;
  }[];
  doorways: {
    wall: WallName;
    offsetX: number;
    width: number;
    height: number;
  }[];
  items: ReconstructItem[];
  description: string;
}

// ---------------- نرمال‌سازی خروجی هر تحلیل ----------------

/** خروجی مدل را به تحلیل امن تبدیل می‌کند؛ ورودی غیرآبجکت → null */
function normalizeAnalysis(data: unknown): Analysis | null {
  if (!isRecord(data)) return null;
  const room = isRecord(data.room) ? data.room : {};

  const windows = (Array.isArray(data.windows) ? data.windows : [])
    .slice(0, 6)
    .filter(isRecord)
    .map((w) => ({
      wall: toWall(w.wall),
      offsetX: clamp(toFinite(w.offsetX, 0), -3, 3),
      sillY: clamp(toFinite(w.sillY, 1), 0.3, 1.8),
      width: clamp(toFinite(w.width, 1.2), 0.6, 2.6),
      height: clamp(toFinite(w.height, 1.2), 0.6, 2.2),
    }));

  const doorways = (Array.isArray(data.doorways) ? data.doorways : [])
    .slice(0, 4)
    .filter(isRecord)
    .map((d) => ({
      wall: toWall(d.wall),
      offsetX: clamp(toFinite(d.offsetX, 0), -3, 3),
      width: clamp(toFinite(d.width, 0.95), 0.8, 1.4),
      height: clamp(toFinite(d.height, 2.1), 1.9, 2.5),
    }));

  const items = (Array.isArray(data.items) ? data.items : [])
    .slice(0, 24)
    .filter(isRecord)
    .map((it): ReconstructItem => {
      const dRaw = toFinite(it.depthM, Number.NaN);
      return {
        kind: toFurnitureKind(it.kind),
        wall: toWall(it.wall),
        offsetX: clamp(toFinite(it.offsetX, 0), -5, 5),
        widthM: clamp(toFinite(it.widthM, 0.8), 0.3, 3),
        heightM: clamp(toFinite(it.heightM, 0.85), 0.3, 2.4),
        depthM: Number.isFinite(dRaw) ? clamp(dRaw, 0.25, 1.2) : undefined,
        colorHex: toColor(it.colorHex, '#6b4f3a'),
        description: typeof it.description === 'string' ? it.description.slice(0, 120) : '',
      };
    });

  return {
    roomType:
      typeof data.roomType === 'string' && ROOM_TYPES.includes(data.roomType)
        ? data.roomType
        : 'other',
    room: {
      widthM: clamp(toFinite(room.widthM, 4), 2, 10),
      depthM: clamp(toFinite(room.depthM, 3.5), 2, 10),
      heightM: clamp(toFinite(room.heightM, 2.8), 2.2, 4),
      wallColor: toColor(room.wallColor, '#ece7dd'),
      floorColor: toColor(room.floorColor, '#a97c50'),
      ceilingColor: toColor(room.ceilingColor, '#fafafa'),
    },
    windows,
    doorways,
    items,
    description: typeof data.description === 'string' ? data.description.slice(0, 600) : '',
  };
}

// ---------------- فراخوانی مدل‌ها ----------------

/** تحلیل VLM یک تصویر با حداکثر ۲ تلاش؛ به‌دلیل رد شدن محتوای multimodal در
 * /chat/completions مستقیماً از مسیر رسمی SDK برای تصویر (createVision) استفاده می‌شود */
async function analyzeImage(zai: ZAI, image: string): Promise<Analysis | null> {
  const visionMessage: VisionMessage = {
    role: 'user',
    content: [
      { type: 'text', text: RECONSTRUCT_PROMPT },
      { type: 'image_url', image_url: { url: image } },
    ],
  };
  // بک‌اند در صورت عدم ارسال model، مدل پیش‌فرض را خودش انتخاب می‌کند
  const visionBody: CreateChatCompletionVisionBody = {
    model: undefined as unknown as string,
    messages: [visionMessage],
    thinking: { type: 'disabled' },
  };

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const visionResult = await zai.chat.completions.createVision(visionBody);
      const content = visionResult?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error('پاسخ خالی از مدل');
      }
      const analysis = normalizeAnalysis(extractJsonObject(content));
      if (!analysis) throw new Error('خروجی مدل آبجکت JSON معتبر نبود');
      return analysis;
    } catch (err) {
      lastError = err;
      console.error(`[reconstruct] vision attempt ${attempt} failed:`, err);
    }
  }
  console.error('[reconstruct] all vision attempts failed:', lastError);
  return null;
}

/** ادغام تحلیل‌های جزئی با یک فراخوانی متنی؛ در صورت خطا اولین تحلیل برگردانده می‌شود */
async function mergeAnalyses(zai: ZAI, partials: Analysis[]): Promise<Analysis> {
  if (partials.length === 1) return partials[0];
  try {
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: MERGE_PROMPT },
        { role: 'user', content: JSON.stringify(partials) },
      ] satisfies ChatMessage[],
      thinking: { type: 'disabled' },
    });
    const content = completion?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim()) {
      const merged = normalizeAnalysis(extractJsonObject(content));
      if (merged) return merged;
    }
    throw new Error('خروجی ادغام نامعتبر بود');
  } catch (err) {
    console.error('[reconstruct] merge failed, using first partial:', err);
    return partials[0];
  }
}

// ---------------- تبدیل آیتم‌ها به آبجکت صحنه ----------------

const RECONSTRUCT_LABELS: Record<FurnitureKind, string> = {
  base: 'کابینت زمینی (بازسازی‌شده)',
  wall: 'کابینت دیواری (بازسازی‌شده)',
  tall: 'کابینت بلند (بازسازی‌شده)',
  island: 'جزیره (بازسازی‌شده)',
  shelf: 'قفسه (بازسازی‌شده)',
  fridge: 'یخچال (بازسازی‌شده)',
  stove: 'اجاق گاز (بازسازی‌شده)',
  hood: 'هود (بازسازی‌شده)',
};

/** آفست را طوری محدود می‌کند که آیتم داخل دیوار بماند */
function clampOffsetOnWall(wall: WallName, offsetX: number, itemWidth: number, room: Analysis['room']) {
  const wallLength = wall === 'back' || wall === 'front' ? room.widthM : room.depthM;
  const maxAbs = wallLength / 2 - 0.05 - itemWidth / 2;
  return maxAbs <= 0 ? 0 : clamp(offsetX, -maxAbs, maxAbs);
}

function buildObject(item: ReconstructItem, room: Analysis['room']): SceneObject {
  const kind = item.kind;
  const w = item.widthM;
  const h = item.heightM;
  const d = item.depthM ?? KIND_DEFAULT_D[kind];
  const color = item.colorHex;

  let rawParams: Record<string, unknown>;
  if (kind === 'fridge') {
    rawParams = {
      w, h, d, color, bodyColor: color, doorColor: shadeColor(color, 0.2),
      doors: 1, drawers: 0, handles: 'bar',
    };
  } else if (kind === 'stove') {
    rawParams = {
      w, h, d, color, bodyColor: color, doorColor: shadeColor(color, 0.15),
      countertopColor: '#1e2024', doors: 1, drawers: 0, handles: 'bar',
    };
  } else if (kind === 'hood') {
    rawParams = {
      w, h, d, color, bodyColor: color,
      doors: 0, drawers: 0, handles: 'none', mountY: 1.62,
    };
  } else if (kind === 'wall') {
    rawParams = {
      w, h, d, bodyColor: color, doorColor: shadeColor(color, 0.2),
      countertopColor: '#d8d3c8', doors: w > 0.7 ? 2 : 1, drawers: 0,
      handles: 'bar', mountY: 1.5,
    };
  } else {
    // base / tall / island / shelf
    rawParams = {
      w, h, d, bodyColor: color, doorColor: shadeColor(color, 0.2),
      countertopColor: '#d8d3c8', doors: w > 0.7 ? 2 : 1, drawers: 0, handles: 'bar',
    };
  }

  const params = normalizePartialParams(rawParams, kind);
  const y = kind === 'wall' || kind === 'hood' ? params.mountY ?? 0 : 0;
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
    label: RECONSTRUCT_LABELS[kind],
    params,
    position,
    rotationY,
  };
}

// ---------------- هندلر ----------------

export async function POST(req: NextRequest) {
  const body = await readJsonBody(req);
  if (!body.ok) {
    return NextResponse.json({ error: 'داده ارسالی نامعتبر است' }, { status: 400 });
  }

  try {
    const parsed = bodySchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'حداکثر ۵ تصویر و حداقل یک تصویر لازم است' },
        { status: 400 },
      );
    }

    // سازگاری با نسخه ۱: { image } → { images: [image] }
    const images = (parsed.data.images ?? (parsed.data.image ? [parsed.data.image] : []))
      .map((s) => s.trim())
      .filter(Boolean);
    if (images.length === 0) {
      return NextResponse.json({ error: 'تصویری ارسال نشده است' }, { status: 400 });
    }

    // اعتبارسنجی همه تصاویر — هر تصویر نامعتبر کل درخواست را رد می‌کند
    for (const image of images) {
      if (image.length > MAX_IMAGE_LENGTH) {
        return NextResponse.json(
          { error: 'حجم یکی از تصاویر بیش از حد مجاز است (حداکثر ۷ مگابایت)' },
          { status: 400 },
        );
      }
      if (!DATA_URL_RE.test(image) && !RAW_BASE64_RE.test(image)) {
        return NextResponse.json(
          { error: 'فرمت یکی از ارسالی‌ها تصویر نیست' },
          { status: 400 },
        );
      }
    }

    const zai = await ZAI.create();

    // مرحله ۱: تحلیل ترتیبی هر تصویر (برای جلوگیری از محدودیت نرخ)
    const partials: Analysis[] = [];
    for (const image of images) {
      const analysis = await analyzeImage(zai, image);
      if (analysis) partials.push(analysis);
    }
    if (partials.length === 0) {
      return NextResponse.json(
        { error: 'تحلیل تصاویر با هوش مصنوعی ناموفق بود' },
        { status: 502 },
      );
    }

    // مرحله ۲: ادغام نتایج جزئی (در صورت خطا اولین تحلیل)
    const merged = await mergeAnalyses(zai, partials);

    // مرحله ۳: ساخت RoomSpec و آبجکت‌های صحنه
    const roomSpec: RoomSpec = {
      ...merged.room,
      windows: merged.windows,
      doorways: merged.doorways,
    };
    const objects = merged.items.map((item) => buildObject(item, merged.room));

    return NextResponse.json({
      roomType: merged.roomType,
      roomSpec,
      objects,
      description: merged.description,
    });
  } catch (err) {
    console.error('POST /api/reconstruct failed:', err);
    return NextResponse.json(
      { error: 'بازسازی با هوش مصنوعی ناموفق بود' },
      { status: 502 },
    );
  }
}
