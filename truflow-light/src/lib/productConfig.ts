/** TruFlow Lite product packaging + integration URLs */

export const PRODUCT_TIER = "lite" as const;
export const PRODUCT_NAME = "TruFlow Lite";
export const PRODUCT_TAGLINE = "Stock · Leads · Tasks · Light costs — photos via TruLens";

export const DEFAULT_TRULENS_URL = "http://localhost:3000";
export const TRULENS_URL_KEY = "truflow_trulens_url";
export const DEALER_SLUG_KEY = "truflow_dealer_slug";

export function getTruLensUrl(): string {
  try {
    return (localStorage.getItem(TRULENS_URL_KEY) || DEFAULT_TRULENS_URL).replace(/\/$/, "");
  } catch {
    return DEFAULT_TRULENS_URL;
  }
}

export function setTruLensUrl(url: string) {
  localStorage.setItem(TRULENS_URL_KEY, url.trim().replace(/\/$/, "") || DEFAULT_TRULENS_URL);
}

export function getDealerSlug(): string {
  try {
    return localStorage.getItem(DEALER_SLUG_KEY) || "demo";
  } catch {
    return "demo";
  }
}

export function setDealerSlug(slug: string) {
  localStorage.setItem(DEALER_SLUG_KEY, slug.trim() || "demo");
}

export function openTruLens(stockNumber?: string) {
  const base = getTruLensUrl();
  const url = stockNumber
    ? `${base}/?stock=${encodeURIComponent(stockNumber)}`
    : base;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function publicStockPath(origin = typeof window !== "undefined" ? window.location.origin : ""): string {
  return `${origin}/api/public/stock?dealer=${encodeURIComponent(getDealerSlug())}`;
}

export function stockWidgetSnippet(apiOrigin: string): string {
  const api = `${apiOrigin.replace(/\/$/, "")}/api/public/stock`;
  return `<!-- TruSaaS live stock -->
<div id="trusass-stock"></div>
<script
  src="${apiOrigin.replace(/\/$/, "")}/embed/stock-widget.js"
  data-api="${api}"
  data-dealer="${getDealerSlug()}"
  data-theme="light"
></script>`;
}
