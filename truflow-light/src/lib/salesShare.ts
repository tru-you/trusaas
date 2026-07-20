/** WhatsApp / share helpers for stock units (Lite) */

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

export function openStockWhatsApp(
  v: Parameters<typeof buildStockWhatsAppBlurb>[0],
  phoneOverride?: string
) {
  const digits = (phoneOverride || getDealerWaNumber()).replace(/\D/g, "");
  const text = buildStockWhatsAppBlurb(v);
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
