/* ============================================================
   TruSaaS product suite — all names use Tru…
   ============================================================ */
window.TCSA = window.TCSA || {};

TCSA.PRODUCT_URLS = {
  lens: "https://lens.tru-saas.com",
  flow: "https://flow.tru-saas.com",
  premium: "https://premium.tru-saas.com",
  tru3dDemo: "vehicle.html?id=porsche-cayenne-s-19",
  truChat: "technology.html#truchat",
  truReceptionist: "technology.html#trureceptionist",
  truShowroom: "https://true-cars.co.za/",
  waDemo:
    "https://wa.me/27620502091?text=" +
    encodeURIComponent(
      "Hi Paul, I'd like a TruSaaS demo (TruLens, TruFlow, TruOrbit, TruChat / TruReceptionist)."
    ),
};

/** Full suite — names must start with Tru */
TCSA.PRODUCTS = [
  {
    id: "trulens",
    tier: "core",
    num: "01",
    name: "TruLens",
    blurb: "Guided yard capture, VIR scores, PWA on the phone — the only camera in the stack.",
    href: "https://lens.tru-saas.com",
    external: true,
    tone: "teal",
  },
  {
    id: "truflow-lite",
    tier: "core",
    num: "02",
    name: "TruFlow Lite",
    blurb: "Stock, leads, tasks and light costs — honest entry DMS. Shoot only in TruLens.",
    href: "https://flow.tru-saas.com",
    external: true,
    tone: "blue",
  },
  {
    id: "truflow-premium",
    tier: "core",
    num: "03",
    name: "TruFlow Premium",
    blurb: "Full floor ops — media hub, recon, finance, public stock API for your website.",
    href: "https://premium.tru-saas.com",
    external: true,
    tone: "gold",
  },
  {
    id: "tru3d",
    tier: "experience",
    num: "04",
    name: "TruOrbit",
    blurb: "Orbit frames + damage pins from TruLens — product-grade condition proof for the showroom.",
    href: "vehicle.html?id=porsche-cayenne-s-19",
    external: false,
    tone: "teal",
  },
  {
    id: "trushowroom",
    tier: "experience",
    num: "05",
    name: "TruShowroom",
    blurb: "Buyer-facing virtual showroom (like this site) fed by live stock APIs — multi-dealer ready.",
    href: "certi-used.html",
    external: false,
    tone: "blue",
  },
  {
    id: "truchat",
    tier: "ai",
    num: "06",
    name: "TruChat",
    blurb: "Site & WhatsApp AI that matches stock, answers finance basics, and books viewings 24/7.",
    href: "technology.html#truchat",
    external: false,
    tone: "teal",
  },
  {
    id: "trureceptionist",
    tier: "ai",
    num: "07",
    name: "TruReceptionist",
    blurb: "Front-desk AI that qualifies walk-ins and routes into CRM — same brain as TruChat, voice-ready.",
    href: "technology.html#trureceptionist",
    external: false,
    tone: "gold",
  },
  {
    id: "truvir",
    tier: "trust",
    num: "08",
    name: "TruVIR",
    blurb: "Condition score + PDF audit trail — AI damage assist via TruLens where enabled.",
    href: "vir-report.html",
    external: false,
    tone: "blue",
  },
  {
    id: "trurto360",
    tier: "fleet",
    num: "09",
    name: "TruRTO360",
    blurb: "Dealership rent-to-own inventory with 360° VIR, milestone damage tracking, and transparent buy-out handover.",
    href: "rto360.html",
    external: false,
    tone: "gold",
  },
  {
    id: "leaseflow",
    tier: "fleet",
    num: "10",
    name: "LeaseFlow",
    blurb: "End-to-end lease management with virtual inspections and transparent handover — start clean, end documented.",
    href: "leaseflow.html",
    external: false,
    tone: "blue",
  },
  {
    id: "trulive",
    tier: "experience",
    num: "11",
    name: "TruLive",
    blurb: "Live video walkaround to remote buyers — no app install, session linked to the unit.",
    href: "technology.html",
    external: false,
    tone: "red",
  },
  {
    id: "trusync",
    tier: "growth",
    num: "12",
    name: "TruSync",
    blurb: "One stock update → AutoTrader, Cars.co.za, Facebook Marketplace and your TruShowroom.",
    href: "technology.html",
    external: false,
    tone: "gold",
  },
];

TCSA.renderProductGrid = function (el, opts) {
  if (!el) return;
  opts = opts || {};
  const list = opts.ids
    ? TCSA.PRODUCTS.filter(function (p) {
        return opts.ids.indexOf(p.id) >= 0;
      })
    : TCSA.PRODUCTS;
  el.innerHTML = list
    .map(function (p) {
      const rel = p.external ? ' target="_blank" rel="noopener"' : "";
      return (
        '<a class="ax-modtile rv" href="' +
        p.href +
        '"' +
        rel +
        ">" +
        '<div class="mt-top"><span class="mt-ic ' +
        (p.tone || "blue") +
        '">◆</span><span class="mt-num">' +
        p.num +
        "</span></div>" +
        '<div class="mt-name">' +
        p.name +
        "</div>" +
        '<div class="mt-desc">' +
        p.blurb +
        "</div>" +
        '<span class="mt-go">Open<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>' +
        "</a>"
      );
    })
    .join("");
};
