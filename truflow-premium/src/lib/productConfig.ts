/** TruFlow Premium product packaging + integration URLs */

export const PRODUCT_TIER = "premium" as const;
export const PRODUCT_NAME = "TruFlow Premium";
export const PRODUCT_TAGLINE = "Full DMS · CRM · Media & Web · Finance & recon";

/** Production defaults on Render (*.onrender.com); localhost when developing on PC */
function isTruSaasHost(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const h = window.location.hostname;
    return /\.onrender\.com$/i.test(h) || /(^|\.)tru-saas\.com$/i.test(h) || /\.?trusaas\.co\.za$/i.test(h);
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

/** Support WhatsApp. The Support row in the sidebar / More sheet deep-links
 *  here with the dealer name, tier and current section pre-filled. Left blank
 *  by default rather than shipping a placeholder number that would misdial —
 *  set the real TruSaaS support line in Settings (stored per-device) and the
 *  button starts opening WhatsApp; until then it copies the message instead. */
export const SUPPORT_WA_KEY = "truflow_support_wa";
export const DEFAULT_SUPPORT_WA = "447476995694"; // TruSaaS support: +44 7476 995 694

export function getSupportWaNumber(): string {
  try {
    return (localStorage.getItem(SUPPORT_WA_KEY) || DEFAULT_SUPPORT_WA).replace(/\D/g, "");
  } catch {
    return DEFAULT_SUPPORT_WA;
  }
}

export function setSupportWaNumber(raw: string) {
  localStorage.setItem(SUPPORT_WA_KEY, raw.trim());
}

/** Open WhatsApp to TruSaaS support with a pre-filled context blurb. Falls back
 *  to copying the message when no support number is configured, mirroring the
 *  stock-share behaviour in salesShare.ts. */
export function openSupportWhatsApp(msg: string) {
  const digits = getSupportWaNumber();
  if (!digits) {
    void navigator.clipboard?.writeText(msg).catch(() => undefined);
    alert("Support WhatsApp number not set.\n\nMessage copied to clipboard.\n\nSet it in Settings.");
    return;
  }
  window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
}

/** Open TruLens capture — passes ?stock= so catalogue highlights that unit */
export function openTruLens(stockNumber?: string) {
  const base = getTruLensUrl();
  const url = stockNumber
    ? `${base}/?stock=${encodeURIComponent(stockNumber)}`
    : base;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function publicStockPath(
  origin = typeof window !== "undefined" ? window.location.origin : "",
  slug?: string,
): string {
  return `${origin}/api/public/stock?dealer=${encodeURIComponent(slug || getDealerSlug())}`;
}

/* stockWidgetSnippet() lived here and generated the embed code shown on the
   Settings page. That card was replaced by the Dealer Details editor, leaving
   this with no caller, so it has been removed.

   `public/embed/stock-widget.js` is deliberately NOT removed with it. Dealers
   who already copied the snippet have that script tag on their live websites;
   deleting the file would break their stock listings. It is a published asset,
   not internal code, and its lifetime is not tied to this generator. */
