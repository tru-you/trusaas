/** WhatsApp / share helpers for stock units */

export const WA_NUMBER_KEY = "truflow_wa_number";

export function getDealerWaNumber(): string {
  try {
    return (localStorage.getItem(WA_NUMBER_KEY) || "").replace(/\D/g, "");
  } catch {
    return "";
  }
}

export function setDealerWaNumber(raw: string) {
  localStorage.setItem(WA_NUMBER_KEY, raw.trim());
}

export function formatZar(n: number): string {
  return "R " + Math.round(Number(n) || 0).toLocaleString("en-ZA");
}

export function buildStockWhatsAppBlurb(
  v: {
    year: number;
    make: string;
    model: string;
    trim?: string;
    stockNumber: string;
    retailPrice: number;
    mileage?: number;
    transmission?: string;
    fuelType?: string;
    images?: string[];
  },
  opts?: { dealerName?: string }
): string {
  const dealer = opts?.dealerName || "Our dealership";
  const photos = v.images?.length || 0;
  return (
    `*${v.year} ${v.make} ${v.model}*\n` +
    `${v.trim || "Standard"} · Stock *${v.stockNumber}*\n` +
    `${formatZar(v.retailPrice)}` +
    (v.mileage != null ? ` · ${Number(v.mileage).toLocaleString("en-ZA")} km` : "") +
    `\n` +
    (v.transmission || v.fuelType
      ? `${[v.transmission, v.fuelType].filter(Boolean).join(" · ")}\n`
      : "") +
    (photos ? `Gallery: ${photos} photos (TruLens)\n` : `Photos: shoot in TruLens\n`) +
    `\n${dealer}\n— TruFlow stock share`
  );
}

async function fetchImageAsFile(url: string, index: number): Promise<File | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
    return new File([blob], `vehicle-${index + 1}.${ext}`, { type: blob.type });
  } catch {
    return null;
  }
}

/** Opens WhatsApp (web/app) with prefilled stock blurb + images via Web Share API */
export async function openStockWhatsApp(
  v: Parameters<typeof buildStockWhatsAppBlurb>[0],
  phoneOverride?: string
) {
  const text = buildStockWhatsAppBlurb(v);

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
  const digits = (phoneOverride || getDealerWaNumber()).replace(/\D/g, "");
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

export async function copyStockBlurb(v: Parameters<typeof buildStockWhatsAppBlurb>[0]) {
  const text = buildStockWhatsAppBlurb(v);
  await navigator.clipboard.writeText(text);
  return text;
}
