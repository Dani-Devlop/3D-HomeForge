import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import ZAI from 'z-ai-web-dev-sdk';
import type {
  ChatMessage,
  CreateChatCompletionVisionBody,
  VisionMessage,
} from 'z-ai-web-dev-sdk';
import type { RoomSpec, WallName } from '@/lib/scene-types';
import { readJsonBody } from '@/app/api/_lib/serialize';

// ============================================================
// /api/reconstruct — بازسازی سه‌بعدی فضا از روی عکس با هوش مصنوعی
// ============================================================

const RECONSTRUCT_PROMPT = `You are an expert interior-space analyzer for a 3D room reconstruction pipeline.
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

Respond with ONLY a JSON object — no markdown fences, no commentary — shaped exactly like:
{
  "roomType": "kitchen"|"bedroom"|"living"|"dining"|"bathroom"|"office"|"other",
  "room": { "widthM": number, "depthM": number, "heightM": number, "wallColor": "#hex", "floorColor": "#hex", "ceilingColor": "#hex" },
  "windows": [ { "wall": "back"|"left"|"right"|"front", "offsetX": number, "sillY": number, "width": number, "height": number } ],
  "doorways": [ { "wall": "back"|"left"|"right"|"front", "offsetX": number, "width": number, "height": number } ],
  "description": "کوتاه به فارسی"
}`;

const MAX_IMAGE_LENGTH = 7 * 1024 * 1024; // حداکثر ~7MB رشته base64
const DATA_URL_RE = /^data:image\/[a-zA-Z0-9.+-]+;base64,/;
const RAW_BASE64_RE = /^[A-Za-z0-9+/=\r\n]+$/;

const bodySchema = z.object({ image: z.string().min(1) });

// ---------------- ابزارهای نرمال‌سازی ----------------

const WALLS: readonly string[] = ['back', 'left', 'right', 'front'];
const ROOM_TYPES: readonly string[] = [
  'kitchen', 'bedroom', 'living', 'dining', 'bathroom', 'office', 'other',
];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const toFinite = (v: unknown, fallback: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number.parseFloat(v) : Number.NaN;
  return Number.isFinite(n) ? n : fallback;
};

const toWall = (v: unknown): WallName =>
  typeof v === 'string' && WALLS.includes(v) ? (v as WallName) : 'back';

const toColor = (v: unknown, fallback: string): string =>
  typeof v === 'string' && HEX_RE.test(v) ? v.toLowerCase() : fallback;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

interface ReconstructResult {
  roomSpec: RoomSpec;
  roomType: string;
  description: string;
}

/** خروجی مدل را به RoomSpec امن تبدیل می‌کند؛ ورودی غیرآبجکت → null */
function normalizeResult(data: unknown): ReconstructResult | null {
  if (!isRecord(data)) return null;
  const room = isRecord(data.room) ? data.room : {};

  const windows = (Array.isArray(data.windows) ? data.windows : [])
    .slice(0, 4)
    .filter(isRecord)
    .map((w) => ({
      wall: toWall(w.wall),
      offsetX: clamp(toFinite(w.offsetX, 0), -3, 3),
      sillY: clamp(toFinite(w.sillY, 1), 0.3, 1.8),
      width: clamp(toFinite(w.width, 1.2), 0.6, 2.6),
      height: clamp(toFinite(w.height, 1.2), 0.6, 2.2),
    }));

  const doorways = (Array.isArray(data.doorways) ? data.doorways : [])
    .slice(0, 3)
    .filter(isRecord)
    .map((d) => ({
      wall: toWall(d.wall),
      offsetX: clamp(toFinite(d.offsetX, 0), -3, 3),
      width: clamp(toFinite(d.width, 0.95), 0.8, 1.4),
      height: clamp(toFinite(d.height, 2.1), 1.9, 2.5),
    }));

  const roomSpec: RoomSpec = {
    widthM: clamp(toFinite(room.widthM, 4), 2, 10),
    depthM: clamp(toFinite(room.depthM, 3.5), 2, 10),
    heightM: clamp(toFinite(room.heightM, 2.8), 2.2, 4),
    wallColor: toColor(room.wallColor, '#ece7dd'),
    floorColor: toColor(room.floorColor, '#a97c50'),
    ceilingColor: toColor(room.ceilingColor, '#fafafa'),
    windows,
    doorways,
  };

  return {
    roomSpec,
    roomType:
      typeof data.roomType === 'string' && ROOM_TYPES.includes(data.roomType)
        ? data.roomType
        : 'other',
    description: typeof data.description === 'string' ? data.description : '',
  };
}

/** حذف فنس‌های markdown و استخراج اولین آبجکت JSON از متن پاسخ مدل */
function extractJsonObject(text: string): unknown {
  const stripped = text.replace(/```[a-zA-Z]*/g, '').trim();
  const first = stripped.indexOf('{');
  const last = stripped.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(stripped.slice(first, last + 1));
    } catch {
      // تلاش برای parse مستقیم در ادامه
    }
  }
  return JSON.parse(stripped);
}

/** فراخوانی مدل با حداکثر ۲ تلاش؛ خروجی نرمال‌شده یا null */
async function reconstructWithRetry(image: string): Promise<ReconstructResult | null> {
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
      const zai = await ZAI.create();

      // مسیر اصلی طبق قرارداد: /chat/completions
      let text = '';
      try {
        const completion = await zai.chat.completions.create({
          messages: [visionMessage as unknown as ChatMessage], // آرایه چندوجهی در تایپ SDK رشته است
          thinking: { type: 'disabled' },
        });
        const content = completion?.choices?.[0]?.message?.content;
        if (typeof content === 'string' && content.trim()) text = content;
      } catch (primaryErr) {
        console.error('[reconstruct] primary /chat/completions failed:', primaryErr);
      }

      // مسیر جایگزین رسمی SDK برای تصویر: /chat/completions/vision
      if (!text) {
        const visionResult = await zai.chat.completions.createVision(visionBody);
        const content = visionResult?.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || !content.trim()) {
          throw new Error('پاسخ خالی از مدل');
        }
        text = content;
      }

      const result = normalizeResult(extractJsonObject(text));
      if (!result) throw new Error('خروجی مدل آبجکت JSON معتبر نبود');
      return result;
    } catch (err) {
      lastError = err;
      console.error(`[reconstruct] attempt ${attempt} failed:`, err);
    }
  }
  console.error('[reconstruct] all attempts failed:', lastError);
  return null;
}

export async function POST(req: NextRequest) {
  const body = await readJsonBody(req);
  if (!body.ok) {
    return NextResponse.json({ error: 'داده ارسالی نامعتبر است' }, { status: 400 });
  }

  try {
    const parsed = bodySchema.safeParse(body.data);
    if (!parsed.success || !parsed.data.image.trim()) {
      return NextResponse.json({ error: 'تصویری ارسال نشده است' }, { status: 400 });
    }

    const image = parsed.data.image.trim();
    if (image.length > MAX_IMAGE_LENGTH) {
      return NextResponse.json(
        { error: 'حجم تصویر بیش از حد مجاز است (حداکثر ۷ مگابایت)' },
        { status: 400 },
      );
    }
    // فقط data URL تصویری یا رشته base64 خام پذیرفته می‌شود
    if (!DATA_URL_RE.test(image) && !RAW_BASE64_RE.test(image)) {
      return NextResponse.json(
        { error: 'فرمت ارسالی تصویر نیست' },
        { status: 400 },
      );
    }

    const result = await reconstructWithRetry(image);
    if (!result) {
      return NextResponse.json({ error: 'AI reconstruction failed' }, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('POST /api/reconstruct failed:', err);
    return NextResponse.json({ error: 'AI reconstruction failed' }, { status: 502 });
  }
}
