import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import ZAI from 'z-ai-web-dev-sdk';
import type { ChatMessage } from 'z-ai-web-dev-sdk';
import type { ObjectPatch } from '@/lib/scene-types';
import { requireOwner } from '@/lib/auth';
import { readJsonBody } from '@/app/api/_lib/serialize';
import { clamp, extractJsonObject, isRecord, normalizePartialParams, toFinite } from '@/app/api/_lib/normalize';

// ============================================================
// /api/ai/edit — translate a text edit instruction into a relative patch for the selected object
// ============================================================

const EDIT_PROMPT = `You translate a natural-language edit instruction (Persian or English) about ONE furniture object into a RELATIVE patch JSON.
The object's current state (type, params, position, rotationY) is given to you. Respond with a patch describing ONLY what changes.

Patch shape (all keys optional, include only what the instruction implies):
{
  "positionDelta": [dx, dy, dz],   // meters, each -3..3; "higher/up" = +y, "lower/down" = -y, "forward" = +z, "back" = -z
  "rotationYDelta": number,        // radians, -6.283..6.283; "90 degrees" = 1.5708, "45 degrees" = 0.7854, "180 degrees" = 3.1416
  "params": {                      // partial params, same constraints as the generator:
    "w": 0.3..3, "h": 0.3..2.4, "d": 0.25..1.2,
    "bodyColor"/"doorColor"/"countertopColor"/"color": "#rrggbb",
    "doors": 0..2, "drawers": 0..3, "handles": "bar"|"knob"|"none",
    "glass": true,                 // ONLY when the user explicitly asks for glass doors — glass is always LIGHT colored
    "mountY": 0.8..2.3 (wall) | 1.3..2.0 (hood),
    "intensity": 0..5 (lights)
  },
  "label": "new label, max 40 chars",
  "open": true|false,              // "open the door" → true, "close it" → false
  "on": true|false                 // "turn on" → true, "turn off" → false (lights/hood/stove)
}

Rules:
- Sizes are ABSOLUTE when the user gives a dimension: "make it 120 centimeters wide" → {"params":{"w":1.2}}.
- Colors are absolute hex values: "make it gray" → {"params":{"doorColor":"#808080","bodyColor":"#8a8a8a"}}.
  When changing colors, set both bodyColor and doorColor (slightly different shades) unless the user is specific.
- Combined instructions produce combined patches: "rotate it a bit and bring it down 20 centimeters" → {"rotationYDelta":0.35,"positionDelta":[0,-0.2,0]}.
- Centimeters: "20 centimeters" = 0.2 meters.
- If the instruction cannot be mapped to any change, respond with {}.

Examples:
"Move this cabinet up 20 centimeters" → {"positionDelta":[0,0.2,0]}
"Make it gray" → {"params":{"doorColor":"#808080","bodyColor":"#8a8a8a"}}
"Rotate it 90 degrees" → {"rotationYDelta":1.5708}
"Open the door" → {"open":true}
"Make it 120 centimeters wide" → {"params":{"w":1.2}}
"Turn off its light" → {"on":false}

Respond with ONLY a JSON object — no markdown fences, no commentary.
All values you output (labels, names, descriptions) MUST be in English.`;

const objectSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  label: z.string().optional(),
  params: z.record(z.string(), z.unknown()),
  position: z.tuple([z.number(), z.number(), z.number()]),
  rotationY: z.number(),
  open: z.boolean().optional(),
  on: z.boolean().optional(),
});

const bodySchema = z.object({
  object: objectSchema,
  text: z.string().trim().min(1).max(300),
});

/** Converts the raw model patch into a safe ObjectPatch (empty object = no change) */
function normalizePatch(data: unknown, objType: string): ObjectPatch {
  if (!isRecord(data)) return {};
  const patch: ObjectPatch = {};

  if (Array.isArray(data.positionDelta)) {
    const nums = data.positionDelta.map((v) => toFinite(v, Number.NaN));
    if (nums.length === 3 && nums.every((n) => Number.isFinite(n))) {
      patch.positionDelta = [
        clamp(nums[0], -3, 3),
        clamp(nums[1], -3, 3),
        clamp(nums[2], -3, 3),
      ];
    }
  }

  if (data.rotationYDelta !== undefined) {
    const n = toFinite(data.rotationYDelta, Number.NaN);
    if (Number.isFinite(n)) patch.rotationYDelta = clamp(n, -6.283, 6.283);
  }

  if (isRecord(data.params)) {
    const params = normalizePartialParams(data.params, objType);
    if (Object.keys(params).length > 0) patch.params = params;
  }

  if (typeof data.label === 'string' && data.label.trim()) {
    patch.label = data.label.trim().slice(0, 40);
  }
  if (typeof data.open === 'boolean') patch.open = data.open;
  if (typeof data.on === 'boolean') patch.on = data.on;

  return patch;
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
        { error: 'Invalid object or edit instruction (instruction must be 1 to 300 characters)' },
        { status: 400 },
      );
    }
    const { object, text } = parsed.data;

    const zai = await ZAI.create();

    const messages: ChatMessage[] = [
      { role: 'system', content: EDIT_PROMPT },
      {
        role: 'user',
        content: `Current object JSON:\n${JSON.stringify({
          type: object.type,
          label: object.label,
          params: object.params,
          position: object.position,
          rotationY: object.rotationY,
        })}\n\nEdit instruction:\n${text}`,
      },
    ];

    let patch: ObjectPatch = {};
    let lastError: unknown = null;
    let ok = false;
    for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
      try {
        const completion = await zai.chat.completions.create({
          messages,
          thinking: { type: 'disabled' },
        });
        const content = completion?.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || !content.trim()) {
          throw new Error('Empty response from model');
        }
        patch = normalizePatch(extractJsonObject(content), object.type);
        ok = true;
      } catch (err) {
        lastError = err;
        console.error(`[ai/edit] attempt ${attempt} failed:`, err);
      }
    }
    if (!ok) {
      console.error('[ai/edit] all attempts failed:', lastError);
      return NextResponse.json(
        { error: 'AI edit failed' },
        { status: 502 },
      );
    }

    return NextResponse.json({ patch });
  } catch (err) {
    console.error('POST /api/ai/edit failed:', err);
    return NextResponse.json({ error: 'AI edit failed' }, { status: 502 });
  }
}
