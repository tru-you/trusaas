/** WhatsApp / share helpers for listing units */

export const WA_NUMBER_KEY = "truflow_wa_number";

export function getAgencyWaNumber(): string {
  try {
    return (localStorage.getItem(WA_NUMBER_KEY) || "").replace(/\D/g, "");
  } catch {
    return "";
  }
}

export function setAgencyWaNumber(raw: string) {
  localStorage.setItem(WA_NUMBER_KEY, raw.trim());
}

export function formatZar(n: number): string {
  return "R " + Math.round(Number(n) || 0).toLocaleString("en-ZA");
}

export function buildListingWhatsAppBlurb(
  v: {
    address?: string;
    propertyType?: string;
    suburb?: string;
    bedrooms?: number;
    bathrooms?: number;
    erfSize?: string;
    floorSize?: string;
    listingRef: string;
    retailPrice: number;
    images?: string[];
  },
  opts?: { agencyName?: string }
): string {
  const agency = opts?.agencyName || "Our agency";
  const photos = v.images?.length || 0;
  const title = v.address || `${v.propertyType || "Property"} · ${v.suburb || ""}`;
  return (
    `*${title}*\n` +
    `Listing *${v.listingRef}*\n` +
    `${formatZar(v.retailPrice)}` +
    (v.bedrooms || v.bathrooms
      ? ` · ${v.bedrooms || 0} bed · ${v.bathrooms || 0} bath`
      : "") +
    (v.erfSize || v.floorSize
      ? ` · ${v.erfSize || v.floorSize} m²`
      : "") +
    `\n` +
    (photos ? `Gallery: ${photos} photos (TruLens)\n` : `Photos: shoot in TruLens\n`) +
    `\n${agency}\n— PropInspect listing share`
  );
}

async function fetchImageAsFile(url: string, index: number): Promise<File | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
    return new File([blob], `property-${index + 1}.${ext}`, { type: blob.type });
  } catch {
    return null;
  }
}

/** Opens WhatsApp (web/app) with prefilled listing blurb + images via Web Share API */
export async function openListingWhatsApp(
  v: Parameters<typeof buildListingWhatsAppBlurb>[0],
  phoneOverride?: string
) {
  const text = buildListingWhatsAppBlurb(v);

  // Try Web Share API with images (mobile browsers)
  if (navigator.share && v.images?.length) {
    const imageUrls = v.images.slice(0, 4);
    const files = (
      await Promise.all(imageUrls.map((url, i) => fetchImageAsFile(url, i)))
    ).filter((f): f is File => f !== null);

    if (files.length && navigator.canShare?.({ files })) {
      try {
        await navigator.share({ text, files });
        return;
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
      }
    }
  }

  // Fallback: wa.me text-only link
  const digits = (phoneOverride || getAgencyWaNumber()).replace(/\D/g, "");
  if (!digits) {
    void navigator.clipboard?.writeText(text).catch(() => undefined);
    alert(
      "WhatsApp number not set.\n\nBlurb copied to clipboard.\n\nSet your sales WhatsApp in Settings (e.g. 2766…)."
    );
    return;
  }
  const url = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function copyListingBlurb(v: Parameters<typeof buildListingWhatsAppBlurb>[0]) {
  const text = buildListingWhatsAppBlurb(v);
  await navigator.clipboard.writeText(text);
  return text;
}
