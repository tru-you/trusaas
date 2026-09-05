/**
 * MKR Auto Sales · TruChat config
 * AI chatbot + leads portal + site widget for MKR showroom.
 */
window.MKR_TRUCHAT_CONFIG = {
  assistantName: "MKR",
  dealerName: "MKR Auto Sales",
  brandLine: "MKR Auto Sales · Premium Pre-Owned · Gqeberha",
  address: "495 Cape Road, Westering, Gqeberha, 6025",
  siteUrl: "https://mkrautosales.co.za",

  logoUrl: "../../mkr-badge.jpg",
  fabIconUrl: "../../mkr-badge.jpg",

  brandPrimary: "#0B5BD7",
  brandPrimaryDark: "#0846A8",
  brandRed: "#0B5BD7",
  brandRedDark: "#0846A8",

  hoursText:
    "*MKR Auto Sales hours:*\n• Mon–Fri: 08:00 – 17:30\n• Saturday: 08:00 – 14:00\n• Sunday: Closed",

  personalWhatsApp: "27662912809",
  salesWhatsApp: "27662912809",
  waBusinessNumber: "",

  dealerSlug: "true-cars",

  leadWebhook: "https://premium.tru-saas.com/api/integration/webhook-lead",
  leadStorageKey: "mkr_truchat_leads_v1",
  portalPin: "",

  stockApi: "https://premium.tru-saas.com/api/public/stock?dealer=mkr-autosales",
  stockApiFallback: [
    "https://flow.tru-saas.com/api/public/stock?dealer=mkr-autosales",
    "https://lens.tru-saas.com/api/public/stock?dealer=mkr-autosales"
  ],

  greeting:
    "Hi — I'm your **MKR Auto Sales** assistant.\n\nThree portals: **Buy**, **Sell / Trade-In**, and **VAF Bridge Finance**. I can help with stock, viewings, valuations, or finance. What do you need?",
  suggestions: ["Browse stock", "Book a viewing", "Trade-in valuation", "VAF finance", "Leave my details"],

  brandMap: {
    golf: "VOLKSWAGEN",
    gti: "VOLKSWAGEN",
    polo: "VOLKSWAGEN",
    vw: "VOLKSWAGEN",
    volkswagen: "VOLKSWAGEN",
    toyota: "TOYOTA",
    hilux: "TOYOTA",
    fortuner: "TOYOTA",
    corolla: "TOYOTA",
    ford: "FORD",
    ranger: "FORD",
    bmw: "BMW",
    mercedes: "MERCEDES-BENZ",
    merc: "MERCEDES-BENZ",
    benz: "MERCEDES-BENZ",
    nissan: "NISSAN",
    navara: "NISSAN",
    hyundai: "HYUNDAI",
    tucson: "HYUNDAI",
    audi: "AUDI",
    mini: "MINI",
    renault: "RENAULT",
  },

  catalog: [
    { id: "navara-pro2x", brand: "NISSAN", model: "Navara 2.5DDTi PRO-2X", year: 2023, price: 529900, km: "42,846 km", fuel: "Diesel" },
    { id: "golf-gti", brand: "VOLKSWAGEN", model: "Golf 8 GTI", year: 2021, price: 489900, km: "38,200 km", fuel: "Petrol" },
    { id: "bmw-m2", brand: "BMW", model: "M2 Coupé", year: 2018, price: 589900, km: "64,000 km", fuel: "Petrol" },
    { id: "tucson-premium", brand: "HYUNDAI", model: "Tucson 2.0 Premium", year: 2019, price: 259900, km: "33,711 km", fuel: "Petrol" },
    { id: "polo-vivo", brand: "VOLKSWAGEN", model: "Polo Vivo 1.4 Life", year: 2026, price: 279900, km: "3,736 km", fuel: "Petrol" },
    { id: "fortuner-epic", brand: "TOYOTA", model: "Fortuner 2.8 GD-6 Epic", year: 2022, price: 569900, km: "48,000 km", fuel: "Diesel" },
  ],
};
