import { PHOTO_SLOTS, Vehicle } from '../types';

export interface DamageTag {
  id: string;
  label: string;
  severity: 'info' | 'attention' | 'critical';
  /** 0–1 around the spin (0 = front 3/4) */
  azimuth: number;
  /** 0–1 vertical on frame */
  elevation: number;
  slotId: string;
  thumb?: string;
}

export interface SpinFrame {
  index: number;
  slotId: string;
  name: string;
  azimuth: number;
  /** PNG data URL preferred (transparent-ish studio cut) */
  image: string;
  background: 'original' | 'studio-cut' | 'transparent-approx';
}

export interface Web3DPackage {
  version: 1;
  stockNumber: string;
  vehicle: {
    year: number;
    make: string;
    model: string;
    trim: string;
    color: string;
    vin: string;
    price: number;
  };
  createdAt: string;
  mode: 'spin-frames' | 'video+tags';
  background: 'transparent-approx' | 'studio' | 'original';
  frames: SpinFrame[];
  video?: { src: string; mime: string } | null;
  damageTags: DamageTag[];
  web: {
    embedPath: string;
    publicApi: string;
  };
}

const ORBIT_SLOTS = [
  { id: 'front_3_4', azimuth: 0.05 },
  { id: 'front_straight', azimuth: 0.0 },
  { id: 'side_passenger', azimuth: 0.25 },
  { id: 'rear_3_4', azimuth: 0.45 },
  { id: 'rear_straight', azimuth: 0.5 },
  { id: 'side_driver', azimuth: 0.75 },
];

/**
 * Approximate “backgroundless” cut for studio / lot shots:
 * lightens near-white / sky-like edges to alpha-ish PNG.
 * Not ML matting — good enough for web demos + clean dark/light pages.
 */
export async function approxBackgroundless(dataUrl: string): Promise<{ image: string; mode: SpinFrame['background'] }> {
  if (!dataUrl?.startsWith('data:image')) {
    return { image: dataUrl, mode: 'original' };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = Math.min(img.width, 1280);
        const h = Math.round((img.height / img.width) * w);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ image: dataUrl, mode: 'original' });
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;
        // Sample corners for background colour
        const samples = [
          0,
          (w - 1) * 4,
          (h - 1) * w * 4,
          ((h - 1) * w + (w - 1)) * 4,
        ];
        let br = 0, bg = 0, bb = 0;
        for (const i of samples) {
          br += d[i]; bg += d[i + 1]; bb += d[i + 2];
        }
        br /= samples.length; bg /= samples.length; bb /= samples.length;

        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const dist = Math.sqrt((r - br) ** 2 + (g - bg) ** 2 + (b - bb) ** 2);
          // Also punch near-white / grey asphalt-light corners
          const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          if (dist < 48 || (luma > 225 && dist < 90)) {
            d[i + 3] = 0;
          } else if (dist < 72) {
            d[i + 3] = Math.round(255 * ((dist - 48) / 24));
          }
        }
        ctx.putImageData(imageData, 0, 0);
        resolve({ image: canvas.toDataURL('image/png'), mode: 'transparent-approx' });
      } catch {
        resolve({ image: dataUrl, mode: 'original' });
      }
    };
    img.onerror = () => resolve({ image: dataUrl, mode: 'original' });
    img.src = dataUrl;
  });
}

function collectDamageTags(vehicle: Vehicle): DamageTag[] {
  const tags: DamageTag[] = [];
  const photos = vehicle.photos || {};
  const quality = vehicle.quality || {};

  // Recon slot
  if (photos.recon_damage) {
    const issues = quality.recon_damage?.aiAnalysis?.detectedIssues;
    const list = Array.isArray(issues) ? issues : issues ? [String(issues)] : ['Documented damage / recon area'];
    list.forEach((label, i) => {
      tags.push({
        id: `recon-${i}`,
        label: String(label),
        severity: i === 0 ? 'attention' : 'info',
        azimuth: 0.55,
        elevation: 0.55,
        slotId: 'recon_damage',
        thumb: photos.recon_damage,
      });
    });
  }

  // Any slot with detected issues
  PHOTO_SLOTS.forEach((slot) => {
    if (slot.id === 'recon_damage') return;
    const issues = quality[slot.id]?.aiAnalysis?.detectedIssues;
    if (!issues) return;
    const list = Array.isArray(issues) ? issues : [String(issues)];
    const orbit = ORBIT_SLOTS.find((o) => o.id === slot.id);
    list.forEach((label, i) => {
      if (!String(label).trim()) return;
      tags.push({
        id: `${slot.id}-${i}`,
        label: String(label),
        severity: /crack|dent|rust|leak|broken/i.test(String(label)) ? 'critical' : 'attention',
        azimuth: orbit?.azimuth ?? 0.2,
        elevation: 0.45 + (i % 3) * 0.08,
        slotId: slot.id,
        thumb: photos[slot.id],
      });
    });
  });

  return tags;
}

export async function buildWeb3DPackage(vehicle: Vehicle): Promise<Web3DPackage> {
  const photos = vehicle.photos || {};
  const frames: SpinFrame[] = [];

  for (let i = 0; i < ORBIT_SLOTS.length; i++) {
    const o = ORBIT_SLOTS[i];
    const src = photos[o.id];
    if (!src) continue;
    const cut = await approxBackgroundless(src);
    const slot = PHOTO_SLOTS.find((s) => s.id === o.id);
    frames.push({
      index: frames.length,
      slotId: o.id,
      name: slot?.name || o.id,
      azimuth: o.azimuth,
      image: cut.image,
      background: cut.mode,
    });
  }

  // If few orbit frames, fill from any exterior
  if (frames.length < 3) {
    for (const slot of PHOTO_SLOTS.filter((s) => s.phase === 1)) {
      if (frames.some((f) => f.slotId === slot.id)) continue;
      const src = photos[slot.id];
      if (!src) continue;
      const cut = await approxBackgroundless(src);
      frames.push({
        index: frames.length,
        slotId: slot.id,
        name: slot.name,
        azimuth: frames.length / 8,
        image: cut.image,
        background: cut.mode,
      });
    }
  }

  const videoSrc = photos.video_360;
  const isVideo =
    typeof videoSrc === 'string' &&
    (videoSrc.startsWith('data:video') || videoSrc.includes('video'));

  return {
    version: 1,
    stockNumber: vehicle.stockNumber,
    vehicle: {
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.trim,
      color: vehicle.color,
      vin: vehicle.vin,
      price: vehicle.price,
    },
    createdAt: new Date().toISOString(),
    mode: isVideo ? 'video+tags' : 'spin-frames',
    background: frames.some((f) => f.background === 'transparent-approx')
      ? 'transparent-approx'
      : 'original',
    frames,
    video: isVideo && videoSrc ? { src: videoSrc, mime: 'video/mp4' } : null,
    damageTags: collectDamageTags(vehicle),
    web: {
      embedPath: `/embed/web3d-viewer.html?stock=${encodeURIComponent(vehicle.stockNumber)}`,
      publicApi: `/api/public/web3d/${encodeURIComponent(vehicle.stockNumber)}`,
    },
  };
}
