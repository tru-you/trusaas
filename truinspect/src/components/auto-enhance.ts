/**
 * Auto-enhance — subtle, natural photo polish for dealer lot and inspection photos.
 *
 * Uses canvas CSS filters for hardware-accelerated processing:
 * - Brightness +5% (lift shadows without blowing highlights)
 * - Contrast +8% (make the car pop against the background)
 * - Saturate +10% (vivid paint, natural skin tones)
 *
 * Intentionally conservative — the result should look like a good phone camera
 * on a sunny day, not an Instagram filter.
 *
 * Input/output: base64 data URL (JPEG).
 * Returns the original unchanged if canvas is unavailable or processing fails.
 */

export const autoEnhance = (base64Image: string, quality = 0.92): Promise<string> => {
  return new Promise((resolve) => {
    // Bail gracefully — never block a photo save
    if (!base64Image || typeof document === 'undefined') {
      resolve(base64Image);
      return;
    }

    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(base64Image); return; }

        // Hardware-accelerated CSS filters — one composite pass
        ctx.filter = 'brightness(1.05) contrast(1.08) saturate(1.10)';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const enhanced = canvas.toDataURL('image/jpeg', quality);
        resolve(enhanced || base64Image);
      } catch {
        resolve(base64Image);
      }
    };
    img.onerror = () => resolve(base64Image);
    img.src = base64Image;
  });
};
