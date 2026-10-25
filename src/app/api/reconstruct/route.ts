import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import ZAI from 'z-ai-web-dev-sdk';
import type {
  ChatMessage,
  CreateChatCompletionVisionBody,
  VisionMessage,
} from 'z-ai-web-dev-sdk';
import type { ObjectType, RoomSpec, SceneObject, WallName } from '@/lib/scene-types';
import { placeAtEdge, placeAtWall, type OutlinePoint } from '@/lib/scene-types';
import { edgeFrame, normalizeOutline } from '@/lib/polygon';
import { requireOwner } from '@/lib/auth';
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
// /api/reconstruct — بازسازی سه‌بعدی «کل خانه» از چند عکس (+ نقشه اختیاری)
// v3:
//  - تحلیل «همه‌چیز»: تلویزیون، مبل، تخت، میز، صندلی، ماشین لباسشویی و...
//  - تحلیل موازی تصاویر (Promise.allSettled) به‌جای ترتیبی
//  - ورودی نقشه ساختمان اختیاری (ground truth برای ابعاد)
//  - حالت استریم NDJSON با پیشرفت زنده (پیش‌فرض) — با Accept: application/json همان پاسخ JSON قبلی
//  - درب‌های شیشه‌ای با glass:true و رنگ روشن (هرگز تیره/سیاه)
// ============================================================

const RECONSTRUCT_PROMPT = `You are an expert interior analyzer for a 3D WHOLE-HOME reconstruction pipeline (v3.2).
Analyze the attached room photo and produce a structured metric reconstruction.

Guidelines:
1. Identify the room type: one of "kitchen", "bedroom", "living", "dining", "bathroom", "office", "other".
2. WHOLE-HOUSE: The photos may capture different angles or different zones of ONE open home
   (living + kitchen + dining). Reconstruct the whole connected open space as a single room:
   report the LARGEST plausible dimensions (widthM/depthM up to 15 m) and include EVERY visible item
   across the photo — TV, sofa, bed, tables, chairs, washing machine, dishwasher, microwave —
   not only kitchen items.
3. Estimate realistic METRIC dimensions of the space using visual cues:
   - an interior door is about 2.1 m tall,
   - a kitchen countertop is about 0.9 m high,
   - a ceiling is typically 2.7 m to 3.0 m high.
4. Identify the dominant color of walls, floor and ceiling as hex codes (#rrggbb).
5. WINDOWS / LIGHT: Be very careful about WHICH wall each window is on relative to the camera
   (back = the wall you face, left/right = side walls, front = behind the camera).
   Report sillY and size accurately — daylight direction matters for rendering.
   Windows: wall, offsetX (-7..7), sillY (0.3..1.8), width (0.6..2.6), height (0.6..2.2). Max 8 windows.
   Doorways: wall, offsetX (-7..7), width (0.8..1.4), height (1.9..2.5).
6. NON-RECTANGULAR ROOMS: Most rooms are simple rectangles, but some are NOT — a corner may be
   CUT DIAGONALLY (a slanted wall at 30°-60°), a wall may be angled, or the room may be a trapezoid
   or have 5, 6 corners. If the floor plan of the space is NOT a rectangle, add a room field
   "outline": the floor polygon corners as [x, z] points in METERS, ordered by walking around the
   room (3..10 points). Coordinates are room-centered: x ∈ [-widthM/2, widthM/2] (right positive),
   z ∈ [-depthM/2, depthM/2] (toward the camera positive). widthM/depthM must be the bounding box
   of the outline. For a window/doorway/item that sits on a SLANTED edge, use "wallIndex"
   (0-based index of the outline edge: edge i connects outline[i] to outline[i+1]) instead of "wall".
   For a normal rectangular room OMIT outline and use wall names as usual.
7. Detect EXISTING furniture/equipment visible in the photo and report each as an "item":
   - kind must be exactly one of: "base" (floor cabinet), "wall" (upper wall cabinet),
     "tall" (full-height unit), "island" (kitchen island), "shelf" (open shelves),
     "fridge" (refrigerator), "stove" (stove/oven), "hood" (range hood/extractor),
     "tv" (flat-screen television), "sofa" (couch), "bed" (bed),
     "table" (dining/coffee table), "chair" (chair),
     "washer" (washing machine), "dishwasher" (dishwasher), "microwave" (microwave oven).
   - For each item report: the wall it stands against ("back"|"left"|"right"|"front" — for an island
     pick the wall it is closest and parallel to) — or "wallIndex" (outline edge) when it stands
     against a slanted/diagonal wall of a non-rectangular room — plus offsetX (horizontal distance of
     the item center from that wall's center, -7..7), widthM (0.3..3), heightM (0.3..2.4), depthM
     (optional, meters), colorHex (dominant color, #rrggbb), description (short, English or Persian).
   - mountY (optional, meters above floor): for anything NOT standing on the floor report the height
     of its BOTTOM — wall cabinets ≈ 1.4..1.6, range hood ≈ 1.5..1.7, TV ≈ 1.0..1.6,
     microwave on counter ≈ 0.9, microwave built into upper cabinet ≈ 1.4..1.7.
   - glassDoors (boolean): true ONLY when the item's doors are made of GLASS (transparent panes visible).
     Glass must be reported as glassDoors:true with a LIGHT frame colorHex — never report dark/black
     color for glass objects.
   - IMPORTANT: a long run of base cabinets along one wall must be reported as SEPARATE segments of
     0.6..1.2 m each, so every segment can be edited individually.
     Report fridge / stove / hood / tv / washer / dishwasher / microwave each as their own item —
     NEVER merge an appliance into a cabinet item.
   - Report at most 40 items (most important first). Do not report items you cannot see.
8. APPLIANCE & FURNITURE CHECKLIST — scan the photo SYSTEMATICALLY, area by area (countertop,
   walls above the counter, floor line, corners, ceiling) and check EVERY one of these:
   a) Microwave: a small box roughly 0.45–0.6 m wide and 0.25–0.35 m tall. It may sit ON the
      countertop, be BUILT INTO an upper cabinet stack (often stainless or black, with a front door
      and small window), or be combined with the range hood. If you see it ANYWHERE — even partly
      cut off at the image edge, even in a reflection — report it as kind "microwave" with mountY.
   b) Range hood: metal funnel/box above the cooktop, kind "hood" with mountY.
   c) Refrigerator ("fridge"), stove/oven ("stove"), dishwasher ("dishwasher"), washing machine
      ("washer").
   d) TV on wall or on a stand ("tv" with mountY), sofa ("sofa"), bed ("bed"), tables ("table"),
      chairs ("chair"), open shelves ("shelf").
   Report an item for EVERY appliance you find — a missing appliance is a serious error.
   Appliances visible in only ONE photo are still important; they will be merged later.

Respond with ONLY a JSON object — no markdown fences, no commentary — shaped exactly like:
{
  "roomType": "kitchen"|"bedroom"|"living"|"dining"|"bathroom"|"office"|"other",
  "room": { "widthM": number, "depthM": number, "heightM": number, "outline": [[x,z], ...] | omitted, "wallColor": "#hex", "floorColor": "#hex", "ceilingColor": "#hex" },
  "windows": [ { "wall": "back"|"left"|"right"|"front", "wallIndex": number | omitted, "offsetX": number, "sillY": number, "width": number, "height": number } ],
  "doorways": [ { "wall": "back"|"left"|"right"|"front", "wallIndex": number | omitted, "offsetX": number, "width": number, "height": number } ],
  "items": [ { "kind": "base"|"wall"|"tall"|"island"|"shelf"|"fridge"|"stove"|"hood"|"tv"|"sofa"|"bed"|"table"|"chair"|"washer"|"dishwasher"|"microwave", "wall": "back"|"left"|"right"|"front", "wallIndex": number | omitted, "offsetX": number, "widthM": number, "heightM": number, "depthM": number, "mountY": number | omitted, "glassDoors": boolean, "colorHex": "#hex", "description": "short" } ],
  "description": "کوتاه به فارسی"
}`;

const FLOORPLAN_PROMPT = `You are a floor-plan (blueprint) reader for a 3D home-design app.
Analyze the attached architectural floor plan image and extract layout facts.

Extract:
- "summary": concise ENGLISH facts about the layout (room adjacency, orientation, notable features).
- "widthM" / "depthM": approximate overall dimensions in meters — use the drawn scale bar,
  door widths (~0.9 m) or dimension labels if present.
- "rooms": every room with its "name" and approximate "widthM"/"depthM" if estimable.
- "outline": ONLY if the overall footprint of the home/room is NOT a rectangle (cut corner,
  slanted wall, trapezoid): the footprint polygon corners as [x, z] meters, walking around,
  room-centered (x right+, z toward the bottom of the plan+). Otherwise omit it.
- "windows": windows with wall/side relative to the plan (assume "back" = bottom of the plan),
  offsetX, width, height in meters when estimable.
- "notes": short facts useful for reconstruction (compass direction, entrance position, stairs, columns...).

Respond with ONLY a JSON object — no markdown fences, no commentary — shaped exactly like:
{
  "summary": "english facts",
  "widthM": number,
  "depthM": number,
  "outline": [[x,z], ...] | omitted,
  "rooms": [ { "name": "...", "widthM": number, "depthM": number } ],
  "windows": [ { "wall": "back"|"left"|"right"|"front", "offsetX": number, "width": number, "height": number } ],
  "notes": ["..."]
}`;

const MERGE_PROMPT = `You merge several partial photo analyses of the SAME space into ONE final reconstruction spec.
You receive a JSON payload; if a "floorPlan" key is present it is a summary extracted from the architectural
floor plan of the same home, and "parts" is the array of per-photo partial analyses.
Produce the UNION/CONSENSUS:
- If a floorPlan summary is provided it is GROUND TRUTH for dimensions/room layout — prefer it over photo estimates.
- "room": take the LARGEST plausible widthM and depthM across the parts and a sensible heightM (they describe the
  same room); pick the most consistent wallColor / floorColor / ceilingColor.
- "room.outline" (floor polygon for non-rectangular rooms): if the floorPlan provides an "outline" it is
  GROUND TRUTH — use it verbatim. Otherwise if ANY part provides "room.outline", keep the most complete /
  most consistent variant. If none does, omit it. widthM/depthM must equal the bounding box of the outline.
- "windows": union of all windows, deduplicated — windows on the same wall whose offsetX differs by less than
  ~0.5 m and whose size is similar are the SAME window (keep the more complete variant). Map walls between
  photos taken from different angles as best you can using the room description.
- "doorways": same dedup rule as windows.
- "items": union of all furniture items, deduplicated by kind + wall + approximate offsetX (within ~0.6 m);
  for duplicates keep the largest / most complete variant (including glassDoors and mountY). Do NOT invent
  items that no part reported.
  APPLIANCES ARE CRITICAL: an appliance kind reported in ANY part (fridge, stove, hood, tv, washer,
  dishwasher, microwave) must survive into the final output — even if it appears in only ONE part and
  even if it overlaps a cabinet position. Only merge two items when their kind is IDENTICAL; never drop
  a microwave/hood/tv because a cabinet occupies a similar position — keep both, they are at different
  heights (use mountY). When the same appliance is reported in several parts from different angles,
  keep one instance at the most plausible wall/offset.
- "roomType": the most frequent value; "description": keep the richest Persian description (or merge them into
  one short paragraph).
Respond with ONLY a JSON object of exactly the same shape as the inputs (roomType, room, windows, doorways,
items, description) — no markdown fences, no commentary.`;

const MAX_IMAGE_LENGTH = 7 * 1024 * 1024; // حداکثر ~7MB رشته base64
const MAX_IMAGES = 8;
const MAX_OBJECTS = 40;
const DATA_URL_RE = /^data:image\/[a-zA-Z0-9.+-]+;base64,/;
const RAW_BASE64_RE = /^[A-Za-z0-9+/=\r\n]+$/;

const bodySchema = z.object({
  images: z.array(z.string().min(1)).min(1).max(MAX_IMAGES).optional(),
  image: z.string().min(1).optional(), // سازگاری با نسخه ۱
  floorPlan: z.string().min(1).optional(), // عکس نقشه ساختمان (اختیاری)
});

// ---------------- انواع داخلی ----------------

interface ReconstructItem {
  kind: FurnitureKind;
  wall: WallName;
  /** اندیس لبه outline (دیوار کج) — اگر بود بر wall اولویت دارد */
  wallIndex?: number;
  offsetX: number;
  widthM: number;
  heightM: number;
  depthM?: number;
  /** ارتفاع نصب از کف (متر) — هود/مایکروویو/تلویزیون/کابینت دیواری */
  mountY?: number;
  glassDoors: boolean;
  colorHex: string;
  description: string;
}

interface Analysis {
  roomType: string;
  room: {
    widthM: number;
    depthM: number;
    heightM: number;
    /** پلان چندضلعی اتاق (فقط برای فضاهای غیرمستطیلی) */
    outline?: OutlinePoint[];
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

/** خلاصه نرمال‌شده نقشه ساختمان — هرگز کل درخواست را نمی‌شکند */
interface FloorPlanSummary {
  summary: string;
  widthM?: number;
  depthM?: number;
  /** پلان کلی فضای غیرمستطیلی از روی نقشه */
  outline?: OutlinePoint[];
  rooms: { name: string; widthM?: number; depthM?: number }[];
  windows: Record<string, unknown>[];
  notes: string[];
}

interface ProgressPayload {
  type: 'progress';
  stage: 'floorplan' | 'analyze' | 'merge';
  index?: number;
  total?: number;
  message: string;
}

type SendFn = (obj: Record<string, unknown>) => void;

/** خطای دارای پیام فارسی برای کاربر (در استریم هم همین متن می‌رود) */
class ReconstructFailure extends Error {}

const faDigits = (n: number): string =>
  String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

const optFinite = (v: unknown, min: number, max: number): number | undefined => {
  const n = toFinite(v, Number.NaN);
  return Number.isFinite(n) ? clamp(n, min, max) : undefined;
};

/** عدد صحیح اختیاری در بازه — نامعتبر/غایب → undefined */
function optInt(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number.parseFloat(v) : Number.NaN;
  if (!Number.isFinite(n)) return undefined;
  return Math.round(clamp(n, min, max));
}

// ---------------- نرمال‌سازی خروجی هر تحلیل ----------------

/** خروجی مدل را به تحلیل امن تبدیل می‌کند؛ ورودی غیرآبجکت → null */
function normalizeAnalysis(data: unknown): Analysis | null {
  if (!isRecord(data)) return null;
  const room = isRecord(data.room) ? data.room : {};

  // پلان چندضلعی (دیوار کج) — نامعتبر → undefined (مستطیل)
  const parsedOutline = normalizeOutline(room.outline);

  // با outline معتبر، widthM/depthM باید دقیقاً bbox چندضلع باشند
  let widthM = clamp(toFinite(room.widthM, 4), 2, 15);
  let depthM = clamp(toFinite(room.depthM, 3.5), 2, 15);
  if (parsedOutline) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of parsedOutline) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    widthM = clamp(Math.round((maxX - minX) * 100) / 100, 2, 15);
    depthM = clamp(Math.round((maxZ - minZ) * 100) / 100, 2, 15);
  }

  const windows = (Array.isArray(data.windows) ? data.windows : [])
    .slice(0, 8)
    .filter(isRecord)
    .map((w) => ({
      wall: toWall(w.wall),
      ...(optInt(w.wallIndex, 0, 11) !== undefined ? { wallIndex: optInt(w.wallIndex, 0, 11) } : {}),
      offsetX: clamp(toFinite(w.offsetX, 0), -7, 7),
      sillY: clamp(toFinite(w.sillY, 1), 0.3, 1.8),
      width: clamp(toFinite(w.width, 1.2), 0.6, 2.6),
      height: clamp(toFinite(w.height, 1.2), 0.6, 2.2),
    }));

  const doorways = (Array.isArray(data.doorways) ? data.doorways : [])
    .slice(0, 4)
    .filter(isRecord)
    .map((d) => ({
      wall: toWall(d.wall),
      ...(optInt(d.wallIndex, 0, 11) !== undefined ? { wallIndex: optInt(d.wallIndex, 0, 11) } : {}),
      offsetX: clamp(toFinite(d.offsetX, 0), -7, 7),
      width: clamp(toFinite(d.width, 0.95), 0.8, 1.4),
      height: clamp(toFinite(d.height, 2.1), 1.9, 2.5),
    }));

  const items = (Array.isArray(data.items) ? data.items : [])
    .slice(0, MAX_OBJECTS)
    .filter(isRecord)
    .map((it): ReconstructItem => {
      const dRaw = toFinite(it.depthM, Number.NaN);
      const wIdx = optInt(it.wallIndex, 0, 11);
      return {
        kind: toFurnitureKind(it.kind),
        wall: toWall(it.wall),
        ...(wIdx !== undefined ? { wallIndex: wIdx } : {}),
        offsetX: clamp(toFinite(it.offsetX, 0), -7, 7),
        widthM: clamp(toFinite(it.widthM, 0.8), 0.3, 3),
        heightM: clamp(toFinite(it.heightM, 0.85), 0.3, 2.4),
        depthM: Number.isFinite(dRaw) ? clamp(dRaw, 0.25, 1.2) : undefined,
        ...(optFinite(it.mountY, 0.3, 2.2) !== undefined
          ? { mountY: optFinite(it.mountY, 0.3, 2.2) }
          : {}),
        glassDoors: it.glassDoors === true,
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
      widthM,
      depthM,
      heightM: clamp(toFinite(room.heightM, 2.8), 2.2, 4.2),
      ...(parsedOutline ? { outline: parsedOutline } : {}),
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

/** نرمال‌سازی تدافعی خروجی نقشه — خطای نقشه هرگز کل درخواست را نمی‌شکند */
function normalizeFloorPlan(data: unknown): FloorPlanSummary | null {
  if (!isRecord(data)) return null;
  return {
    summary: typeof data.summary === 'string' ? data.summary.slice(0, 1200) : '',
    widthM: optFinite(data.widthM, 2, 30),
    depthM: optFinite(data.depthM, 2, 30),
    ...(normalizeOutline(data.outline, { bound: 30 })
      ? { outline: normalizeOutline(data.outline, { bound: 30 })! }
      : {}),
    rooms: (Array.isArray(data.rooms) ? data.rooms : [])
      .slice(0, 20)
      .filter(isRecord)
      .map((r) => ({
        name: typeof r.name === 'string' ? r.name.slice(0, 60) : '',
        widthM: optFinite(r.widthM, 0.5, 30),
        depthM: optFinite(r.depthM, 0.5, 30),
      })),
    windows: (Array.isArray(data.windows) ? data.windows : [])
      .slice(0, 12)
      .filter(isRecord),
    notes: (Array.isArray(data.notes) ? data.notes : [])
      .slice(0, 12)
      .filter((n): n is string => typeof n === 'string')
      .map((n) => n.slice(0, 200)),
  };
}

// ---------------- فراخوانی مدل‌ها ----------------

/** بدنه فراخوانی VLM (مسیر مستقیم createVision — /chat/completions تصویر را 400 می‌کند) */
function visionBody(prompt: string, image: string): CreateChatCompletionVisionBody {
  const message: VisionMessage = {
    role: 'user',
    content: [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: image } },
    ],
  };
  // بک‌اند در صورت عدم ارسال model، مدل پیش‌فرض را خودش انتخاب می‌کند
  return {
    model: undefined as unknown as string,
    messages: [message],
    thinking: { type: 'disabled' },
  };
}

/** تحلیل VLM یک تصویر با حداکثر ۲ تلاش */
async function analyzeImage(zai: ZAI, image: string, index: number): Promise<Analysis | null> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const visionResult = await zai.chat.completions.createVision(
        visionBody(RECONSTRUCT_PROMPT, image),
      );
      const content = visionResult?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error('پاسخ خالی از مدل');
      }
      const analysis = normalizeAnalysis(extractJsonObject(content));
      if (!analysis) throw new Error('خروجی مدل آبجکت JSON معتبر نبود');
      return analysis;
    } catch (err) {
      lastError = err;
      console.error(`[reconstruct] vision attempt ${attempt} (image ${index}) failed:`, err);
    }
  }
  console.error(`[reconstruct] all vision attempts failed for image ${index}:`, lastError);
  return null;
}

/** تحلیل نقشه ساختمان — یک تلاش، خطا نادیده گرفته می‌شود */
async function analyzeFloorPlan(zai: ZAI, image: string): Promise<FloorPlanSummary | null> {
  try {
    const visionResult = await zai.chat.completions.createVision(
      visionBody(FLOORPLAN_PROMPT, image),
    );
    const content = visionResult?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) return null;
    return normalizeFloorPlan(extractJsonObject(content));
  } catch (err) {
    console.error('[reconstruct] floor-plan analysis failed (ignored):', err);
    return null;
  }
}

/** ادغام تحلیل‌های جزئی (+ نقشه) با یک فراخوانی متنی؛ در صورت خطا اولین تحلیل برگردانده می‌شود */
async function mergeAnalyses(
  zai: ZAI,
  partials: Analysis[],
  floorPlan: FloorPlanSummary | null,
): Promise<Analysis> {
  if (partials.length === 1 && !floorPlan) return partials[0];
  try {
    // نقشه به‌عنوان ground truth همراه پارتیال‌ها داده می‌شود
    const userContent = floorPlan
      ? JSON.stringify({ floorPlan, parts: partials })
      : JSON.stringify(partials);
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: MERGE_PROMPT },
        { role: 'user', content: userContent },
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
  tv: 'تلویزیون (بازسازی‌شده)',
  sofa: 'مبل (بازسازی‌شده)',
  bed: 'تخت (بازسازی‌شده)',
  table: 'میز (بازسازی‌شده)',
  chair: 'صندلی (بازسازی‌شده)',
  washer: 'ماشین لباسشویی (بازسازی‌شده)',
  dishwasher: 'ماشین ظرفشویی (بازسازی‌شده)',
  microwave: 'مایکروویو (بازسازی‌شده)',
};

/** انواعی که درب شیشه‌ای می‌پذیرند */
const GLASS_KINDS: ReadonlySet<string> = new Set([
  'base', 'wall', 'tall', 'island', 'shelf', 'dishwasher',
]);

/** روشنایی نسبی رنگ hex (۰ تا ۱) — برای جلوگیری از شیشه تیره */
function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** رنگ تیره را برای قاب شیشه به‌قدر کافی روشن می‌کند */
const lightenIfDark = (hex: string): string =>
  luminance(hex) < 0.35 ? shadeColor(hex, 0.65) : hex;

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
      doors: 0, drawers: 0, handles: 'none',
      mountY: item.mountY ?? 1.62,
    };
  } else if (kind === 'wall') {
    rawParams = {
      w, h, d, bodyColor: color, doorColor: shadeColor(color, 0.2),
      countertopColor: '#d8d3c8', doors: w > 0.7 ? 2 : 1, drawers: 0,
      handles: 'bar', mountY: item.mountY ?? 1.5,
    };
  } else if (kind === 'tv') {
    // تلویزیون نازک — نصب روی دیوار
    rawParams = { w, h, d: 0.06, color: '#101318', bodyColor: '#1b1f26', mountY: item.mountY ?? 1.4 };
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
    // مایکروویو — روی کانتر (۰٫۹) یا توکار کابینت دیواری (mountY از مدل)
    rawParams = {
      w: clamp(w, 0.4, 0.7), h: 0.3, d: 0.38, color, bodyColor: color,
      mountY: item.mountY ?? 0.9,
    };
  } else {
    // base / tall / island / shelf
    rawParams = {
      w, h, d, bodyColor: color, doorColor: shadeColor(color, 0.2),
      countertopColor: '#d8d3c8', doors: w > 0.7 ? 2 : 1, drawers: 0, handles: 'bar',
    };
  }

  // درب شیشه‌ای — فقط انواع کابینتی؛ قاب شیشه هرگز تیره نمی‌ماند
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

  // جانمایی: لبه کج outline (wallIndex) در اولویت، وگرنه دیوار نامی مستطیل
  let position: [number, number, number];
  let rotationY: number;
  if (room.outline && room.outline.length >= 3 && item.wallIndex !== undefined) {
    const edge = edgeFrame(room.outline, item.wallIndex);
    const maxAbs = Math.max(0, edge.len / 2 - 0.05 - w / 2);
    const off = maxAbs <= 0 ? 0 : clamp(item.offsetX, -maxAbs, maxAbs);
    ({ position, rotationY } = placeAtEdge(room.outline, item.wallIndex, off, d, y));
  } else {
    const offsetX = clampOffsetOnWall(item.wall, item.offsetX, w, room);
    ({ position, rotationY } = placeAtWall(
      item.wall,
      offsetX,
      d,
      { widthM: room.widthM, depthM: room.depthM },
      y,
    ));
  }

  return {
    id: crypto.randomUUID().slice(0, 8),
    type: kind as ObjectType,
    label: RECONSTRUCT_LABELS[kind],
    params,
    position,
    rotationY,
    ...(kind === 'tv' ? { on: false } : {}),
  };
}

// ---------------- خط لوله مشترک (JSON و استریم) ----------------

interface ReconstructResult {
  roomType: string;
  roomSpec: RoomSpec;
  objects: SceneObject[];
  description: string;
}

/**
 * خط لوله کامل: تحلیل موازی همه عکس‌ها + نقشه → ادغام → ساخت آبجکت‌ها.
 * send در حالت استریم رویدادهای progress را می‌نویسد؛ در حالت JSON undefined است.
 */
async function runPipeline(
  zai: ZAI,
  images: string[],
  floorPlanImage: string | undefined,
  send?: SendFn,
): Promise<ReconstructResult> {
  // نقشه در همان دسته موازی اجرا می‌شود؛ خطایش نادیده گرفته می‌شود
  const floorPlanPromise: Promise<FloorPlanSummary | null> | null = floorPlanImage
    ? (async () => {
        send?.({ type: 'progress', stage: 'floorplan', message: 'در حال بررسی نقشه ساختمان...' });
        const fp = await analyzeFloorPlan(zai, floorPlanImage);
        if (fp) {
          send?.({ type: 'progress', stage: 'floorplan', message: 'نقشه ساختمان بررسی شد' });
        }
        return fp;
      })()
    : null;

  // تحلیل موازی تصاویر — بعد از اتمام هر عکس یک رویداد progress می‌آید
  const total = images.length;
  const imagePromises = images.map((img, i) =>
    analyzeImage(zai, img, i).then((analysis) => {
      send?.({
        type: 'progress',
        stage: 'analyze',
        index: i + 1,
        total,
        message: `تحلیل عکس ${faDigits(i + 1)} از ${faDigits(total)} انجام شد`,
      });
      return analysis;
    }),
  );

  // همه در یک Promise.allSettled — نقشه اول صف است (اگر بوده باشد)
  const tasks: Promise<unknown>[] = [
    ...(floorPlanPromise ? [floorPlanPromise] : []),
    ...imagePromises,
  ];
  const settled = await Promise.allSettled(tasks);
  const offset = floorPlanPromise ? 1 : 0;

  const floorPlanSummary = floorPlanPromise
    ? settled[0].status === 'fulfilled'
      ? (settled[0].value as FloorPlanSummary | null)
      : null
    : null;

  const partials = settled
    .slice(offset)
    .map((r) => (r.status === 'fulfilled' ? (r.value as Analysis | null) : null))
    .filter((a): a is Analysis => !!a);

  if (partials.length === 0) {
    throw new ReconstructFailure('تحلیل تصاویر با هوش مصنوعی ناموفق بود');
  }

  // مرحله ادغام (با نقشه به‌عنوان ground truth)
  if (partials.length > 1) {
    send?.({ type: 'progress', stage: 'merge', message: 'ادغام نتایج تحلیل‌ها...' });
  }
  const merged = await mergeAnalyses(zai, partials, floorPlanSummary);

  const roomSpec: RoomSpec = {
    ...merged.room,
    windows: merged.windows,
    doorways: merged.doorways,
  };
  const objects = merged.items.map((item) => buildObject(item, merged.room));

  return {
    roomType: merged.roomType,
    roomSpec,
    objects,
    description: merged.description,
  };
}

// ---------------- اعتبارسنجی تصاویر ----------------

function validateImage(image: string): NextResponse | null {
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
  return null;
}

// ---------------- استریم NDJSON ----------------

function ndjsonResponse(run: (send: SendFn) => Promise<void>): NextResponse {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send: SendFn = (obj) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
        } catch {
          // کلاینت قطع شده — بی‌خطر
        }
      };
      try {
        await run(send);
      } catch (err) {
        const message =
          err instanceof ReconstructFailure
            ? err.message
            : 'بازسازی با هوش مصنوعی ناموفق بود';
        if (!(err instanceof ReconstructFailure)) {
          console.error('[reconstruct] stream failed:', err);
        }
        send({ type: 'error', error: message });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // قبلاً بسته شده
        }
      }
    },
  });
  return new NextResponse(stream, {
    headers: {
      'content-type': 'application/x-ndjson',
      'cache-control': 'no-cache, no-transform',
    },
  });
}

// ---------------- هندلر ----------------

export async function POST(req: NextRequest) {
  // گارد مالک — قبل از هر چیز (AI گران است)
  const denied = await requireOwner(req);
  if (denied) return denied;

  // حالت JSON (سازگار با نسخه ۲) در صورت Accept: application/json؛ پیش‌فرض استریم NDJSON
  const wantsJson = (req.headers.get('accept') ?? '').includes('application/json');

  const body = await readJsonBody(req);
  if (!body.ok) {
    return NextResponse.json({ error: 'داده ارسالی نامعتبر است' }, { status: 400 });
  }

  try {
    const parsed = bodySchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: `حداکثر ${MAX_IMAGES} تصویر و حداقل یک تصویر لازم است` },
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
      const invalid = validateImage(image);
      if (invalid) return invalid;
    }
    const floorPlan = parsed.data.floorPlan?.trim() || undefined;
    if (floorPlan) {
      const invalid = validateImage(floorPlan);
      if (invalid) return invalid;
    }

    const zai = await ZAI.create();

    if (wantsJson) {
      try {
        const result = await runPipeline(zai, images, floorPlan);
        return NextResponse.json(result);
      } catch (err) {
        if (err instanceof ReconstructFailure) {
          return NextResponse.json({ error: err.message }, { status: 502 });
        }
        throw err;
      }
    }

    // حالت استریم — رویدادهای progress و در پایان result یا error
    return ndjsonResponse(async (send) => {
      const result = await runPipeline(zai, images, floorPlan, send);
      send({ type: 'result', ...result });
    });
  } catch (err) {
    console.error('POST /api/reconstruct failed:', err);
    return NextResponse.json(
      { error: 'بازسازی با هوش مصنوعی ناموفق بود' },
      { status: 502 },
    );
  }
}
