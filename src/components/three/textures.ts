import * as THREE from 'three';

// ============================================================
// بافت‌های پروسیجرال — بدون هیچ فایل تصویری، همه با Canvas 2D تولید می‌شوند
// فقط سمت کلاینت: اگر document نبود (SSR) null برمی‌گردد و فراخواننده متریال رنگی ساده دارد
// کش در سطح ماژول: هر ترکیب (نوع بافت + رنگ) فقط یک بار تولید می‌شود
// کلید کش شامل رنگ است → تغییر رنگ = بافت تازه، بدون رنگ کهنه
// ============================================================

const cache = new Map<string, THREE.CanvasTexture>();

/* ---------------- ابزار رنگ ---------------- */

function hexToRgb(hex: string): [number, number, number] {
  const n = hex.replace('#', '');
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/** h: ۰..۳۶۰ — s/l: ۰..۱۰۰ */
function hexToHsl(hex: string): [number, number, number] {
  let [r, g, b] = hexToRgb(hex);
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

const clamp100 = (v: number) => Math.min(100, Math.max(0, v));
const clamp255 = (v: number) => Math.min(255, Math.max(0, Math.round(v)));

/** رشته hsl برای fillStyle/strokeStyle بوم */
function hslCss(h: number, s: number, l: number): string {
  return `hsl(${h.toFixed(1)}, ${clamp100(s).toFixed(1)}%, ${clamp100(l).toFixed(1)}%)`;
}

/** روشن/تیره کردن هگز (amount مثبت = مخلوط با سفید، منفی = با مشکی) */
export function shadeHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c: number) => clamp255(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  return `#${((mix(r) << 16) | (mix(g) << 8) | mix(b)).toString(16).padStart(6, '0')}`;
}

/* ---------------- زیرساخت بوم/بافت ---------------- */

function makeCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null; // گارد SSR — فراخواننده fallback رنگی دارد
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return { canvas, ctx };
}

function toTexture(canvas: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function cachedTexture(
  key: string,
  srgb: boolean,
  gen: () => HTMLCanvasElement | null,
): THREE.CanvasTexture | null {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = gen();
  if (!canvas) return null;
  const tex = toTexture(canvas, srgb);
  cache.set(key, tex);
  return tex;
}

/**
 * کلون با تکرار مستقل — برای اینکه هر مش (مثلاً هر دیوار) repeat خودش را داشته باشد
 * بدون خراب کردن کش مشترک. کلون‌ها source مشترک دارند (آپلود GPU یک بار).
 */
export function cloneWithRepeat(
  tex: THREE.Texture | null,
  rx: number,
  ry: number,
): THREE.Texture | null {
  if (!tex) return null;
  const t = tex.clone();
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(Math.max(0.001, rx), Math.max(0.001, ry));
  t.needsUpdate = true;
  return t;
}

/* ---------------- کف چوبی (پارکت تخته‌ای) ---------------- */

/** کف پارکت — تخته‌های افقی ~۶۴px با لرزش hue/lightness، درز تیره و گره چوب */
export function woodFloorTexture(baseColor: string): THREE.CanvasTexture | null {
  return cachedTexture(`woodFloor:${baseColor}`, true, () => {
    const S = 512;
    const c = makeCanvas(S);
    if (!c) return null;
    const { canvas, ctx } = c;
    const [h0, s0, l0] = hexToHsl(baseColor);
    const plankH = 64;

    for (let py = 0; py < S; py += plankH) {
      // لرزش رنگ هر تخته (±۶ واحد hue/lightness)
      const jh = (Math.random() * 2 - 1) * 6;
      const jl = (Math.random() * 2 - 1) * 6;
      const js = (Math.random() * 2 - 1) * 4;
      ctx.fillStyle = hslCss(h0 + jh, s0 + js, l0 + jl);
      ctx.fillRect(0, py, S, plankH);

      // رگه‌های دراز کم‌رنگ در راستای تخته
      for (let i = 0; i < 7; i++) {
        const y0 = py + 3 + Math.random() * (plankH - 6);
        const dark = Math.random() > 0.4;
        ctx.strokeStyle = hslCss(
          h0 + jh + (Math.random() * 2 - 1) * 4,
          s0 + js,
          clamp100(l0 + jl + (dark ? -1 : 1) * (2 + Math.random() * 5)),
        );
        ctx.globalAlpha = 0.08 + Math.random() * 0.1;
        ctx.lineWidth = 0.6 + Math.random() * 1.4;
        ctx.beginPath();
        ctx.moveTo(0, y0);
        ctx.bezierCurveTo(S * 0.3, y0 + (Math.random() * 4 - 2), S * 0.7, y0 + (Math.random() * 4 - 2), S, y0 + (Math.random() * 3 - 1.5));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // گره چوب گاه‌به‌گاه (گرادیان شعاعی کوچک)
      if (Math.random() > 0.55) {
        const kx = Math.random() * S;
        const ky = py + plankH * (0.3 + Math.random() * 0.4);
        const kr = 3 + Math.random() * 4;
        const grad = ctx.createRadialGradient(kx, ky, 0.5, kx, ky, kr);
        grad.addColorStop(0, hslCss(h0 + jh, s0 + 10, clamp100(l0 + jl - 18)));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(kx, ky, kr, 0, Math.PI * 2);
        ctx.fill();
      }

      // درز افقی تیره ۲px بین تخته‌ها
      ctx.fillStyle = 'rgba(28, 18, 10, 0.85)';
      ctx.fillRect(0, py, S, 2);

      // درز عمودی انتهای تخته‌ها (آفست پلکانی مثل پارکت واقعی)
      const seams = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < seams; i++) {
        const sx = Math.floor(Math.random() * S);
        ctx.fillRect(sx, py, 2, plankH);
      }
    }
    return canvas;
  });
}

/* ---------------- دیوار گچی ---------------- */

function plasterCanvas(baseColor: string, gray: boolean): HTMLCanvasElement | null {
  const S = 256;
  const c = makeCanvas(S);
  if (!c) return null;
  const { canvas, ctx } = c;
  const [h0, s0, l0] = hexToHsl(baseColor);

  ctx.fillStyle = gray ? hslCss(0, 0, l0) : hslCss(h0, Math.min(28, s0), l0);
  ctx.fillRect(0, 0, S, S);

  // نویز تک‌پیکسلی ±۳٪ روشنایی
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const f = 1 + ((Math.random() * 2 - 1) * 3) / 100;
    d[i] = clamp255(d[i] * f);
    d[i + 1] = clamp255(d[i + 1] * f);
    d[i + 2] = clamp255(d[i + 2] * f);
  }
  ctx.putImageData(img, 0, 0);

  // چند کمانه ماله خیلی کم‌رنگ
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = gray ? '#000000' : '#ffffff';
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 30 + Math.random() * 60;
    const a0 = Math.random() * Math.PI * 2;
    ctx.lineWidth = 8 + Math.random() * 12;
    ctx.beginPath();
    ctx.arc(x, y, r, a0, a0 + 1 + Math.random() * 1.6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return canvas;
}

/** نقشه رنگی دیوار گچی (map) */
export function plasterWallTexture(baseColor: string): THREE.CanvasTexture | null {
  return cachedTexture(`plaster:${baseColor}`, true, () => plasterCanvas(baseColor, false));
}

/** نقشه برجستگی گچ (bumpMap خاکستری — بدون colorSpace) */
export function plasterWallBumpTexture(baseColor: string): THREE.CanvasTexture | null {
  return cachedTexture(`plasterBump:${baseColor}`, false, () => plasterCanvas(baseColor, true));
}

/* ---------------- سنگ رویه (گرانیت) ---------------- */

/** گرانیت تك‌پیکلی — ۴۵۰ نقطه روشن/تیره + ۳ رگه بزیه کم‌رنگ */
export function stoneCountertopTexture(baseColor: string): THREE.CanvasTexture | null {
  return cachedTexture(`stone:${baseColor}`, true, () => {
    const S = 256;
    const c = makeCanvas(S);
    if (!c) return null;
    const { canvas, ctx } = c;
    const [h0, s0, l0] = hexToHsl(baseColor);

    ctx.fillStyle = hslCss(h0, s0, l0);
    ctx.fillRect(0, 0, S, S);

    // نقطه‌های ریز گرانیت
    for (let i = 0; i < 450; i++) {
      const dark = Math.random() > 0.5;
      const ll = clamp100(l0 + (dark ? -1 : 1) * (6 + Math.random() * 14));
      ctx.fillStyle = hslCss(h0 + (Math.random() * 2 - 1) * 12, s0 * 0.5, ll);
      ctx.beginPath();
      ctx.arc(Math.random() * S, Math.random() * S, 0.6 + Math.random() * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // رگه‌های نرم
    ctx.strokeStyle = hslCss(h0, s0 * 0.4, clamp100(l0 - 22));
    for (let i = 0; i < 3; i++) {
      const y0 = Math.random() * S;
      ctx.globalAlpha = 0.08;
      ctx.lineWidth = 1.5 + Math.random() * 2.5;
      ctx.beginPath();
      ctx.moveTo(-10, y0);
      ctx.bezierCurveTo(
        S * 0.3,
        y0 + (Math.random() * 60 - 30),
        S * 0.65,
        y0 + (Math.random() * 80 - 40),
        S + 10,
        Math.random() * S,
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return canvas;
  });
}

/* ---------------- کاشی (پشت سینک) ---------------- */

/** کاشی ۴×۴ با بند ۲px و لرزش روشنایی — شطرنجی از دو رنگ */
export function tileTexture(colorA: string, colorB: string): THREE.CanvasTexture | null {
  return cachedTexture(`tile:${colorA}:${colorB}`, true, () => {
    const S = 256;
    const c = makeCanvas(S);
    if (!c) return null;
    const { canvas, ctx } = c;
    ctx.fillStyle = '#d9d4c8'; // بند کاشی
    ctx.fillRect(0, 0, S, S);
    const cell = S / 4;
    for (let gy = 0; gy < 4; gy++) {
      for (let gx = 0; gx < 4; gx++) {
        const [h0, s0, l0] = hexToHsl((gx + gy) % 2 === 0 ? colorA : colorB);
        ctx.fillStyle = hslCss(h0, s0, l0 + (Math.random() * 2 - 1) * 4);
        ctx.fillRect(gx * cell + 2, gy * cell + 2, cell - 4, cell - 4);
      }
    }
    return canvas;
  });
}

/* ---------------- رگه چوب مبل/کابینت ---------------- */

/** رگه عمودی باریک با موج سینوسی ملایم — برای درب کابینت/مبلمان */
export function woodGrainTexture(baseColor: string): THREE.CanvasTexture | null {
  return cachedTexture(`woodGrain:${baseColor}`, true, () => {
    const S = 256;
    const c = makeCanvas(S);
    if (!c) return null;
    const { canvas, ctx } = c;
    const [h0, s0, l0] = hexToHsl(baseColor);

    ctx.fillStyle = hslCss(h0, s0, l0);
    ctx.fillRect(0, 0, S, S);

    for (let i = 0; i < 46; i++) {
      const x0 = Math.random() * S;
      const amp = 1.5 + Math.random() * 3;
      const freq = 0.02 + Math.random() * 0.03;
      const phase = Math.random() * Math.PI * 2;
      const dark = Math.random() > 0.35;
      ctx.strokeStyle = hslCss(
        h0 + (Math.random() * 2 - 1) * 4,
        s0,
        clamp100(l0 + (dark ? -1 : 1) * (3 + Math.random() * 7)),
      );
      ctx.globalAlpha = 0.1 + Math.random() * 0.1;
      ctx.lineWidth = 0.6 + Math.random() * 1.2;
      ctx.beginPath();
      for (let y = 0; y <= S; y += 4) {
        const x = x0 + Math.sin(y * freq * Math.PI * 2 + phase) * amp;
        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return canvas;
  });
}
