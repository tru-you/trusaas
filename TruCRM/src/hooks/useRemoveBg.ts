import { useEffect, useState } from 'react';

/**
 * Strips near-white (light) or near-black (dark) backgrounds from an image
 * using a canvas pixel pass. Returns a data URL with transparent bg.
 * mode 'light' → removes pixels where R,G,B all > (255 - threshold)
 * mode 'dark'  → removes pixels where R,G,B all < threshold
 */
export function useRemoveBg(
  src: string,
  mode: 'light' | 'dark',
  threshold = 15,
): string {
  const [out, setOut] = useState<string>(src);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = imageData.data;
      const limit = 255 - threshold;
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i], g = px[i + 1], b = px[i + 2];
        if (mode === 'light') {
          if (r >= limit && g >= limit && b >= limit) px[i + 3] = 0;
        } else {
          if (r <= threshold && g <= threshold && b <= threshold) px[i + 3] = 0;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      setOut(canvas.toDataURL('image/png'));
    };
    img.src = src;
  }, [src, mode, threshold]);

  return out;
}
