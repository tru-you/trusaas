/**
 * DMS-side gallery readiness (aligned with TruLens spirit).
 * Same rules as Premium — shared product contract.
 */

export type DmsReadinessLevel = "capture" | "partial" | "ready" | "listed";

export interface DmsGalleryReadiness {
  level: DmsReadinessLevel;
  label: string;
  color: string;
  photoCount: number;
  webReady: boolean;
  reasons: string[];
}

export const WEB_GALLERY_TARGET = 12;
export const MIN_USEFUL_GALLERY = 6;

export function computeDmsGalleryReadiness(v: {
  images?: string[] | null;
  status?: string;
  lastPhotoSync?: string;
  showOnWebsite?: boolean;
}): DmsGalleryReadiness {
  const photoCount = Array.isArray(v.images) ? v.images.filter(Boolean).length : 0;
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
