/**
 * Cars on Caledon · TruChat config
 * AI chatbot + leads portal + site widget for the Caledon showroom.
 */
window.COC_TRUCHAT_CONFIG = {
  assistantName: "Caledon",
  dealerName: "Cars on Caledon",
  brandLine: "Cars on Caledon · Quality Pre-Owned · Kariega",
  address: "257 Caledon Street, Kariega, Eastern Cape",
  siteUrl: "https://www.carsoncaledon.co.za",

  logoUrl: "../../coc-mark.svg",
  fabIconUrl: "../../coc-mark.svg",

  brandPrimary: "#23419A",
  brandPrimaryDark: "#16296B",
  brandRed: "#23419A",
  brandRedDark: "#16296B",

  hoursText:
    "*Cars on Caledon hours:*\n• Mon–Fri: 08:00 – 17:30\n• Saturday: 08:00 – 13:00\n• Sunday: Closed",

  personalWhatsApp: "27618759389",
  salesWhatsApp: "27618759389",
  waBusinessNumber: "",

  dealerSlug: "true-cars",

  leadWebhook: "https://premium.tru-saas.com/api/integration/webhook-lead",
  leadStorageKey: "coc_truchat_leads_v1",
  portalPin: "",

  /* Branded hosts, matching every other tenant. This was the only config still
     pointing at raw *.onrender.com origins, so the chatbot's stock knowledge sat
     on different infrastructure from the showroom grid — it could go stale or
     cold-start while the page itself kept working, with nothing to show for it.
     The "caledon-cars" fallback slug is dropped: it does not exist in TruFlow,
     so it only ever bought a timeout. */
  stockApi: "https://flow.tru-saas.com/api/public/stock?dealer=cars-on-caledon",
  stockApiFallback: [
    "https://premium.tru-saas.com/api/public/stock?dealer=cars-on-caledon"
  ],

  greeting:
    "Hi — I'm the **Cars on Caledon** assistant.\n\nI can help you browse stock, book a viewing or live video walkaround, value your trade-in, or start a finance application. What do you need?",
  suggestions: ["Browse stock", "Book a viewing", "Trade-in valuation", "Finance help", "Leave my details"],

  brandMap: {
    golf: "VOLKSWAGEN",
    gti: "VOLKSWAGEN",
    polo: "VOLKSWAGEN",
    vw: "VOLKSWAGEN",
    volkswagen: "VOLKSWAGEN",
    toyota: "TOYOTA",
    hilux: "TOYOTA",
    fortuner: "TOYOTA",
    ford: "FORD",
    ranger: "FORD",
    wildtrak: "FORD",
    bmw: "BMW",
    m2: "BMW",
    mercedes: "MERCEDES-AMG",
    merc: "MERCEDES-AMG",
    amg: "MERCEDES-AMG",
    audi: "AUDI",
    rs3: "AUDI"
  },

  /* Deliberately empty. This was six exotics — an AMG A45, two GTIs, a Fortuner,
     a Wildtrak and a Hilux Legend — used as the fallback whenever the stock API
     was slow or down. The bot quoted them as if they were on the floor, which
     contradicts both this yard's positioning and its own R100k-R700k range, and
     invented inventory is worse than admitting the list is loading. chat-core
     only calls setCatalog() on a successful fetch, so with this empty the bot
     falls back to "let me check what is on the floor" instead of making cars up. */
  catalog: [],
};
