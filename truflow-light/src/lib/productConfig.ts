/** TruFlow Lite product packaging + integration URLs */

export const PRODUCT_TIER = "lite" as const;
export const PRODUCT_NAME = "TruFlow Lite";
export const PRODUCT_TAGLINE = "Stock · Leads · Tasks · Light costs — photos via TruLens";

/** Production defaults on trusaas.co.za; localhost when developing on PC */
function isTruSaasHost(): boolean {
  try {
    return typeof window !== "undefined" && /\.?trusaas\.co\.za$/i.test(window.location.hostname);
  } catch {
    return false;
  }
}

export const DEFAULT_TRULENS_URL = isTruSaasHost()
  ? "https://lens.trusaas.co.za"
  : "http://localhost:3000";

export const DEFAULT_DEALER_SLUG = "mkr-autosales";
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
    return localStorage.getItem(DEALER_SLUG_KEY) || DEFAULT_DEALER_SLUG;
  } catch {
    return DEFAULT_DEALER_SLUG;
  }
}

export function setDealerSlug(slug: string) {
  localStorage.setItem(DEALER_SLUG_KEY, slug.trim() || DEFAULT_DEALER_SLUG);
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
