// Client-side image utilities

/** Convert an image file to a dataURL with a maximum dimension (for sending to AI) */
export async function fileToResizedDataUrl(
  file: File,
  maxDim = 1280,
  quality = 0.82
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files are allowed');
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Browser not supported');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', quality);
}

/** Extract sparse frames from a video for AI analysis (no full 360° coverage needed) */
export async function videoToFrames(file: File, count = 3, maxDim = 1280, quality = 0.8): Promise<string[]> {
  if (!file.type.startsWith('video/')) {
    throw new Error('Only video files are allowed');
  }
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Reading the video took too long')), 15000);
      video.onloadeddata = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error('Video cannot be played'));
      };
    });

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Browser not supported');

    const scale = Math.min(1, maxDim / Math.max(video.videoWidth || maxDim, video.videoHeight || maxDim));
    canvas.width = Math.round((video.videoWidth || 1280) * scale);
    canvas.height = Math.round((video.videoHeight || 720) * scale);

    const frames: string[] = [];
    for (let i = 0; i < count; i++) {
      // Frames from the start, middle and end of the video
      const t = duration * ((i + 0.5) / count);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Video seek failed')), 8000);
        const onSeeked = () => {
          clearTimeout(timer);
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
        video.currentTime = Math.min(t, Math.max(0, duration - 0.05));
      });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL('image/jpeg', quality));
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute('src');
    video.load();
  }
}
