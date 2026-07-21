/** TruFlow Premium product packaging + integration URLs */

export const PRODUCT_TIER = "premium" as const;
export const PRODUCT_NAME = "TruFlow Premium";
export const PRODUCT_TAGLINE = "Full DMS · CRM · Media & Web · Finance & recon";

/** Production defaults on Render (*.onrender.com); localhost when developing on PC */
function isTruSaasHost(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const h = window.location.hostname;
    return /\.onrender\.com$/i.test(h) || /\.?trusaas\.co\.za$/i.test(h);
  } catch {
    return false;
  }
}

export const DEFAULT_TRULENS_URL = isTruSaasHost()
  ? "https://lens.tru-saas.com"
  : "http://localhost:3000";

/** MKR pilot default; change in Settings for other dealers */
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

/** Open TruLens capture — passes ?stock= so catalogue highlights that unit */
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
