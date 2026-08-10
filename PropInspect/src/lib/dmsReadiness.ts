/**
 * DMS-side gallery readiness (aligned with TruLens spirit).
 * Flow stores flat images[] from TruLens export — not full slot map —
 * so we score by count + status + sync, not full PHOTO_SLOTS.
 *
 * TruLens still enforces required slots + VIR ≥ 70 before publish.
 */

export type DmsReadinessLevel = "capture" | "partial" | "ready" | "listed";

export interface DmsGalleryReadiness {
  level: DmsReadinessLevel;
  label: string;
  color: string;
  photoCount: number;
  /** Good enough to push to website feed (still prefer TruLens publish rules) */
  webReady: boolean;
  reasons: string[];
}

/* Target gallery size when only DMS image arrays exist. Aligned to TruLens's
   retail "core" set — the 8 exterior-lap panels + interior + odometer = 10 — so a
   complete core capture reads as web-ready here instead of "almost ready". Was 12,
   which left a full 10-shot core stuck below target and showing "not ready". */
export const WEB_GALLERY_TARGET = 10;
export const MIN_USEFUL_GALLERY = 6;

export function computeDmsGalleryReadiness(v: {
  images?: string[] | null;
  extrasPhotos?: string[] | null;
  status?: string;
  lastPhotoSync?: string;
  showOnWebsite?: boolean;
}): DmsGalleryReadiness {
  /* The gallery is images + extrasPhotos, which is exactly what the public feed
     publishes (toPublicVehicle concatenates the two). This counted `images`
     alone — and mapAutoLensPhotos only files the eight exterior slots there,
     sending every interior, engine, detail and document shot to extrasPhotos.
     So a full 22-photo capture scored 8 against a target of 12 and could never
     reach web-ready no matter how much the dealer shot. */
  const count = (a?: string[] | null) => (Array.isArray(a) ? a.filter(Boolean).length : 0);
  const photoCount = count(v.images) + count(v.extrasPhotos);
  const reasons: string[] = [];

  if (photoCount === 0) {
    reasons.push("No photos — shoot in TruLens, then Export to DMS");
    return {
      level: "capture",
      label: "Needs TruLens shoot",
      color: "#F59E0B",
      photoCount: 0,
      webReady: false,
      reasons,
    };
  }

  if (photoCount < MIN_USEFUL_GALLERY) {
    reasons.push(`Only ${photoCount} photos — keep shooting in TruLens`);
    return {
      level: "partial",
      label: `${photoCount} photos · incomplete`,
      color: "#F97316",
      photoCount,
      webReady: false,
      reasons,
    };
  }

  if (photoCount < WEB_GALLERY_TARGET) {
    reasons.push(`Aim for ~${WEB_GALLERY_TARGET}+ guided shots for full web pack`);
    return {
      level: "partial",
      label: `${photoCount} photos · almost ready`,
      color: "#EAB308",
      photoCount,
      webReady: false,
      reasons,
    };
  }

  if (v.status === "SOLD") {
    return {
      level: "listed",
      label: "Sold",
      color: "#06b6d4",
      photoCount,
      webReady: false,
      reasons: ["Unit sold — remove from active web stock"],
    };
  }

  return {
    level: "ready",
    label: "Gallery web-ready",
    color: "#10B981",
    photoCount,
    webReady: true,
    reasons: v.lastPhotoSync
      ? [`Synced ${new Date(v.lastPhotoSync).toLocaleDateString("en-ZA")}`]
      : ["Ready for website (confirm publish in TruLens / settings)"],
  };
}
