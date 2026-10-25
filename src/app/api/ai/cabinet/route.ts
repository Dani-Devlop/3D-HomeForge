import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import ZAI from 'z-ai-web-dev-sdk';
import type { ChatMessage } from 'z-ai-web-dev-sdk';
import { requireOwner } from '@/lib/auth';
import { readJsonBody } from '@/app/api/_lib/serialize';
import {
  extractJsonObject,
  isRecord,
  KIND_LABELS,
  normalizeFullParams,
  toFurnitureKind,
} from '@/app/api/_lib/normalize';

// ============================================================
// /api/ai/cabinet — تولید یک آیتم مبلمان پارامتریک از توصیف متنی (text-to-3D)
// ============================================================

const CABINET_PROMPT = `You are a parametric furniture generator for a 3D home-design app (kitchen + whole home).
Convert the user's description (Persian or English) into exactly ONE parametric furniture item.

Allowed types — use exactly one of these strings:
"base" (floor cabinet / کابینت زمینی), "wall" (wall-mounted upper cabinet / کابینت دیواری),
"tall" (full-height unit / کابینت بلند), "island" (kitchen island / جزیره),
"shelf" (open shelf / قفسه باز), "fridge" (refrigerator / یخچال),
"stove" (stove or oven / اجاق گاز), "hood" (range hood / هود),
"tv" (flat-screen television / تلویزیون), "sofa" (couch / مبل یا کاناپه),
"bed" (bed / تخت), "table" (dining or coffee table / میز), "chair" (chair / صندلی),
"washing machine" → "washer" (ماشین لباسشویی), "dishwasher" (ماشین ظرفشویی),
"microwave" (مایکروویو یا ریزموج).

Param constraints:
- w: width in meters, 0.3..3.0  (Persian "سانت"/"سانتی‌متر" means centimeters → divide by 100; «۸۰ سانت» = 0.8)
- h: height in meters, 0.3..2.4 (hood: 0.1..0.5, tv: 0.3..1.2 for big screens)
- d: depth in meters, 0.25..1.2 (bed: up to 2.3, tv: 0.04..0.3)
- bodyColor / doorColor / countertopColor: hex colors like "#a1b2c3" (lowercase #rrggbb).
  Common Persian colors: سفید=#f5f5f0, مشکی=#26262a, خاکستری=#8a8a8a, کرم=#e8dfc8, قهوه‌ای=#6b4f3a,
  گردویی=#7d5f45, بلوط=#9a7c5c, سبز=#4f6b52, آبی نفتی=#3f4a5a, قرمز=#a03a2e, استیل=#b9bec6.
  «مات» (matte) → just a normal solid color.
- glass: boolean — true ONLY when the user explicitly asks for glass doors (درب شیشه‌ای / شیشه).
  When glass=true choose doorColor a light neutral like #cfd8dc — glass NEVER renders dark/black.
  Otherwise omit the glass key entirely.
- doors: integer 0..2, drawers: integer 0..3
- handles: "bar" | "knob" | "none"
- mountY: ONLY include for wall (0.8..2.3) and hood (1.3..2.0) — height above the floor in meters.

Persian number words: یک=1, دو=2, سه=3, چهار=4, پنج=5, شش=6, هفت=7, هشت=8, نه=9, ده=10.

Examples:
Input: «یک کابینت زمینی با درب‌های شیشه‌ای، عرض ۸۰ سانت، رنگ سفید مات»
Output: {"type":"base","label":"کابینت زمینی شیشه‌ای","params":{"w":0.8,"h":0.85,"d":0.6,"bodyColor":"#f5f5f0","doorColor":"#cfd8dc","countertopColor":"#d8d3c8","doors":2,"drawers":0,"handles":"bar","glass":true}}
Input: «یخچال استیل بزرگ دو متری»
Output: {"type":"fridge","label":"یخچال استیل","params":{"w":0.9,"h":1.9,"d":0.7,"bodyColor":"#b9bec6","doorColor":"#cdd2d9","countertopColor":"#b9bec6","doors":1,"drawers":0,"handles":"bar"}}
Input: «کابینت دیواری گردویی عرض یک متر»
Output: {"type":"wall","label":"کابینت دیواری گردویی","params":{"w":1.0,"h":0.7,"d":0.35,"bodyColor":"#7d5f45","doorColor":"#9a7c5c","countertopColor":"#d8d3c8","doors":2,"drawers":0,"handles":"knob","mountY":1.5}}
Input: «هود سفید نامرئی»
Output: {"type":"hood","label":"هود سفید","params":{"w":0.6,"h":0.14,"d":0.5,"bodyColor":"#f2f2f2","doorColor":"#f2f2f2","countertopColor":"#f2f2f2","doors":0,"drawers":0,"handles":"none","mountY":1.62}}
Input: «یک مبل سه‌نفره خاکستری»
Output: {"type":"sofa","label":"مبل سه‌نفره","params":{"w":2.0,"h":0.85,"d":0.95,"bodyColor":"#8a8a8a","doorColor":"#7d7d7d","countertopColor":"#8a8a8a","doors":0,"drawers":0,"handles":"none"}}

Choose sensible defaults for anything not specified. The "label" must be a SHORT Persian phrase (max 40 chars).
Respond with ONLY a JSON object — no markdown fences, no commentary — shaped exactly like:
{ "type": "base"|"wall"|"tall"|"island"|"shelf"|"fridge"|"stove"|"hood"|"tv"|"sofa"|"bed"|"table"|"chair"|"washer"|"dishwasher"|"microwave", "label": "فارسی کوتاه", "params": { "w": number, "h": number, "d": number, "bodyColor": "#hex", "doorColor": "#hex", "countertopColor": "#hex", "doors": number, "drawers": number, "handles": "bar"|"knob"|"none", "glass": boolean, "mountY": number } }`;

const bodySchema = z.object({
  text: z.string().trim().min(1).max(500),
});

interface GeneratedItem {
  type: string;
  label: string;
  params: ReturnType<typeof normalizeFullParams>;
}

/** تولید آیتم با حداکثر ۲ تلاش؛ خروجی نرمال‌شده یا null */
async function generateItem(zai: ZAI, text: string): Promise<GeneratedItem | null> {
  const messages: ChatMessage[] = [
    { role: 'system', content: CABINET_PROMPT },
    { role: 'user', content: text },
  ];

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const completion = await zai.chat.completions.create({
        messages,
        thinking: { type: 'disabled' },
      });
      const content = completion?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error('پاسخ خالی از مدل');
      }
      const data = extractJsonObject(content);
      if (!isRecord(data)) throw new Error('خروجی مدل آبجکت JSON نبود');

      const type = toFurnitureKind(data.type);
      const label =
        typeof data.label === 'string' && data.label.trim()
          ? data.label.trim().slice(0, 40)
          : KIND_LABELS[type];
      const params = normalizeFullParams(data.params, type);

      return { type, label, params };
    } catch (err) {
      lastError = err;
      console.error(`[ai/cabinet] attempt ${attempt} failed:`, err);
    }
  }
  console.error('[ai/cabinet] all attempts failed:', lastError);
  return null;
}

export async function POST(req: NextRequest) {
  // گارد مالک — فراخوانی AI گران است و فقط برای مدیر مجاز است
  const denied = await requireOwner(req);
  if (denied) return denied;

  const body = await readJsonBody(req);
  if (!body.ok) {
    return NextResponse.json({ error: 'داده ارسالی نامعتبر است' }, { status: 400 });
  }

  try {
    const parsed = bodySchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'توصیف را بین ۱ تا ۵۰۰ کاراکتر وارد کنید' },
        { status: 400 },
      );
    }

    const zai = await ZAI.create();
    const item = await generateItem(zai, parsed.data.text);
    if (!item) {
      return NextResponse.json(
        { error: 'تولید مدل با هوش مصنوعی ناموفق بود' },
        { status: 502 },
      );
    }
    return NextResponse.json({ item });
  } catch (err) {
    console.error('POST /api/ai/cabinet failed:', err);
    return NextResponse.json(
      { error: 'تولید مدل با هوش مصنوعی ناموفق بود' },
      { status: 502 },
    );
  }
}
