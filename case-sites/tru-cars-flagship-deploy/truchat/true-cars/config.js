/**
 * True-Cars · TruChat config
 * AI chatbot + leads portal + site widget for true-cars.co.za only.
 */
window.TRUECARS_TRUCHAT_CONFIG = {
  assistantName: "True",
  dealerName: "True-Cars",
  brandLine: "True-Cars · Powered by TruDealer",
  address: "South Africa · virtual showroom",
  siteUrl: "https://true-cars.co.za",

  /** Brand mark — resolved relative to widget.js / chat page */
  logoUrl: "/assets/brand/favicon.svg",
  fabIconUrl: "/assets/brand/favicon.svg",

  /** TruChat AI API (DeepSeek Powered). Uses Netlify function proxy */
  aiEndpoint: "/.netlify/functions/truchat",
  chatApi: "/.netlify/functions/truchat",

  /** Site blue/teal (matches true-cars CSS) */
  theme: "light",
  brandPrimary: "#07879A",
  brandPrimaryDark: "#056274",
  brandRed: "#07879A",
  brandRedDark: "#056274",

  hoursText:
    "*Demo showroom hours:*\n• Mon–Fri: 08:00 – 17:00\n• Saturday: 08:00 – 13:00\n• Sunday: Closed",

  /** Paul / TruSaaS demo line — digits only */
  personalWhatsApp: "27620502091",
  salesWhatsApp: "27620502091",
  waBusinessNumber: "",

  dealerSlug: "true-cars",
  leadWebhook: "https://premium.tru-saas.com/api/integration/webhook-lead",
  leadStorageKey: "truecars_truchat_leads_v1",
  portalPin: "true",

  stockApi: "https://premium.tru-saas.com/api/public/stock?dealer=true-cars",
  stockApiFallback: [
    "https://premium.tru-saas.com/api/public/stock?dealer=demo",
  ],

  greeting:
    "Hi — I'm **True**, your assistant on **True-Cars**.\n\nI can help with **stock**, **test drives**, **trade-ins**, **finance** or **delivery** — and you can say **talk to a human** at any point to continue on WhatsApp with the team.",
  suggestions: ["Browse stock", "Trade-in", "Finance help", "Talk to a human"],

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
    audi: "AUDI",
    byd: "BYD",
    porsche: "PORSCHE",
    honda: "HONDA",
    mazda: "MAZDA",
  },

  /* Fallback only — on true-cars pages the widget reads live TCSA.vehicles instead */
  catalog: [
    {
      id: "jeep-grandcherokee-23",
      brand: "JEEP",
      model: "Grand Cherokee 3.6 4x4 Overland",
      year: 2023,
      price: 819900,
      km: "36,100 km",
      fuel: "Petrol",
    },
    {
      id: "toyota-fortuner-28-20",
      brand: "TOYOTA",
      model: "Fortuner 2.8GD-6 4x4 Auto",
      year: 2020,
      price: 464900,
      km: "159,000 km",
      fuel: "Diesel",
    },
    {
      id: "kia-seltos-25",
      brand: "KIA",
      model: "Seltos 1.5CRDi LX",
      year: 2025,
      price: 409900,
      km: "2,400 km",
      fuel: "Diesel",
    },
    {
      id: "audi-q3-sportback-23",
      brand: "AUDI",
      model: "Q3 Sportback 35TFSI S Line",
      year: 2023,
      price: 539900,
      km: "61,100 km",
      fuel: "Petrol",
    },
  ],
};
