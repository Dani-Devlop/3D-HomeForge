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
// /api/ai/cabinet — generate one parametric furniture item from a text description (text-to-3D)
// ============================================================

const CABINET_PROMPT = `You are a parametric furniture generator for a 3D home-design app (kitchen + whole home).
Convert the user's description (Persian or English) into exactly ONE parametric furniture item.

Allowed types — use exactly one of these strings:
"base" (floor cabinet), "wall" (wall-mounted upper cabinet),
"tall" (full-height unit), "island" (kitchen island),
"shelf" (open shelf), "fridge" (refrigerator),
"stove" (stove or oven), "hood" (range hood),
"tv" (flat-screen television), "sofa" (couch),
"bed" (bed), "table" (dining or coffee table), "chair" (chair),
"washing machine" → "washer", "dishwasher",
"microwave".

Param constraints:
- w: width in meters, 0.3..3.0  ("centimeters" means cm → divide by 100; "80 centimeters" = 0.8)
- h: height in meters, 0.3..2.4 (hood: 0.1..0.5, tv: 0.3..1.2 for big screens)
- d: depth in meters, 0.25..1.2 (bed: up to 2.3, tv: 0.04..0.3)
- bodyColor / doorColor / countertopColor: hex colors like "#a1b2c3" (lowercase #rrggbb).
  Common colors: white=#f5f5f0, black=#26262a, gray=#8a8a8a, cream=#e8dfc8, brown=#6b4f3a,
  walnut=#7d5f45, oak=#9a7c5c, green=#4f6b52, navy blue=#3f4a5a, red=#a03a2e, stainless steel=#b9bec6.
  "Matte" → just a normal solid color.
- glass: boolean — true ONLY when the user explicitly asks for glass doors.
  When glass=true choose doorColor a light neutral like #cfd8dc — glass NEVER renders dark/black.
  Otherwise omit the glass key entirely.
- doors: integer 0..2, drawers: integer 0..3
- handles: "bar" | "knob" | "none"
- mountY: ONLY include for wall (0.8..2.3) and hood (1.3..2.0) — height above the floor in meters.

Number words: one=1, two=2, three=3, four=4, five=5, six=6, seven=7, eight=8, nine=9, ten=10.

Examples:
Input: "A floor cabinet with glass doors, 80 centimeters wide, matte white"
Output: {"type":"base","label":"Glass floor cabinet","params":{"w":0.8,"h":0.85,"d":0.6,"bodyColor":"#f5f5f0","doorColor":"#cfd8dc","countertopColor":"#d8d3c8","doors":2,"drawers":0,"handles":"bar","glass":true}}
Input: "Large two-meter stainless steel refrigerator"
Output: {"type":"fridge","label":"Stainless steel fridge","params":{"w":0.9,"h":1.9,"d":0.7,"bodyColor":"#b9bec6","doorColor":"#cdd2d9","countertopColor":"#b9bec6","doors":1,"drawers":0,"handles":"bar"}}
Input: "Walnut wall cabinet one meter wide"
Output: {"type":"wall","label":"Walnut wall cabinet","params":{"w":1.0,"h":0.7,"d":0.35,"bodyColor":"#7d5f45","doorColor":"#9a7c5c","countertopColor":"#d8d3c8","doors":2,"drawers":0,"handles":"knob","mountY":1.5}}
Input: "Invisible white range hood"
Output: {"type":"hood","label":"White hood","params":{"w":0.6,"h":0.14,"d":0.5,"bodyColor":"#f2f2f2","doorColor":"#f2f2f2","countertopColor":"#f2f2f2","doors":0,"drawers":0,"handles":"none","mountY":1.62}}
Input: "A gray three-seater sofa"
Output: {"type":"sofa","label":"Three-seater sofa","params":{"w":2.0,"h":0.85,"d":0.95,"bodyColor":"#8a8a8a","doorColor":"#7d7d7d","countertopColor":"#8a8a8a","doors":0,"drawers":0,"handles":"none"}}

Choose sensible defaults for anything not specified. The "label" must be a SHORT English phrase (max 40 chars).
Respond with ONLY a JSON object — no markdown fences, no commentary — shaped exactly like:
{ "type": "base"|"wall"|"tall"|"island"|"shelf"|"fridge"|"stove"|"hood"|"tv"|"sofa"|"bed"|"table"|"chair"|"washer"|"dishwasher"|"microwave", "label": "short english label", "params": { "w": number, "h": number, "d": number, "bodyColor": "#hex", "doorColor": "#hex", "countertopColor": "#hex", "doors": number, "drawers": number, "handles": "bar"|"knob"|"none", "glass": boolean, "mountY": number } }
All values you output (labels, names, descriptions) MUST be in English.`;

const bodySchema = z.object({
  text: z.string().trim().min(1).max(500),
});

interface GeneratedItem {
  type: string;
  label: string;
  params: ReturnType<typeof normalizeFullParams>;
}

/** Generates an item with up to 2 attempts; normalized output or null */
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
        throw new Error('Empty response from model');
      }
      const data = extractJsonObject(content);
      if (!isRecord(data)) throw new Error('Model output was not a JSON object');

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
  // Owner guard — AI calls are expensive and allowed for the admin only
  const denied = await requireOwner(req);
  if (denied) return denied;

  const body = await readJsonBody(req);
  if (!body.ok) {
    return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
  }

  try {
    const parsed = bodySchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Enter a description between 1 and 500 characters' },
        { status: 400 },
      );
    }

    const zai = await ZAI.create();
    const item = await generateItem(zai, parsed.data.text);
    if (!item) {
      return NextResponse.json(
        { error: 'AI model generation failed' },
        { status: 502 },
      );
    }
    return NextResponse.json({ item });
  } catch (err) {
    console.error('POST /api/ai/cabinet failed:', err);
    return NextResponse.json(
      { error: 'AI model generation failed' },
      { status: 502 },
    );
  }
}
