// ابزارهای کار با تصویر در سمت کلاینت

/** فایل عکس را به dataURL با حداکثر بعد مشخص تبدیل می‌کند (برای ارسال به AI) */
export async function fileToResizedDataUrl(
  file: File,
  maxDim = 1280,
  quality = 0.82
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('فقط فایل تصویری مجاز است');
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('عدم پشتیبانی مرورگر');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', quality);
}
