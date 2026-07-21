/**
 * True-Cars · TruChat config
 * AI chatbot + leads portal + site widget for true-cars.co.za only.
 */
window.TRUECARS_TRUCHAT_CONFIG = {
  assistantName: "True",
  dealerName: "True-Cars",
  brandLine: "True-Cars · TruSaaS demo showroom",
  address: "South Africa · virtual showroom",
  siteUrl: "https://true-cars.co.za",

  /** Brand mark — resolved relative to widget.js / chat page */
  logoUrl: "assets/truecars-mark.jpg",
  fabIconUrl: "assets/truecars-mark.jpg",

  /** Site blue/teal (matches true-cars CSS) */
  brandPrimary: "#1466E0",
  brandPrimaryDark: "#0B4DB0",
  brandRed: "#1466E0",
  brandRedDark: "#0B4DB0",

  hoursText:
    "*Demo showroom hours:*\n• Mon–Fri: 08:00 – 17:00\n• Saturday: 08:00 – 13:00\n• Sunday: Closed",

  /** Paul / TruSaaS demo line — digits only */
  personalWhatsApp: "27620502091",
  salesWhatsApp: "27620502091",
  waBusinessNumber: "",

  leadWebhook: "",
  leadStorageKey: "truecars_truchat_leads_v1",
  portalPin: "true",

  stockApi: "https://trusaas-premium.onrender.com/api/public/stock?dealer=true-cars",
  stockApiFallback: [
    "https://trusaas-premium.onrender.com/api/public/stock?dealer=demo",
  ],

  greeting:
    "Hi — I'm **True**, your assistant on **True-Cars**.\n\nI can help with **stock**, **test drives**, **trade-ins**, **finance**, or how **TruSaaS** works for dealers. What do you need?",
  suggestions: ["Browse stock", "Trade-in", "Finance help", "Dealer demo"],

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

  catalog: [
    {
      id: "golf-gti",
      brand: "VOLKSWAGEN",
      model: "Golf GTI",
      year: 2022,
      price: 589000,
      km: "32,000 km",
      fuel: "Petrol",
    },
    {
      id: "hilux",
      brand: "TOYOTA",
      model: "Hilux 2.8 GD-6 Legend",
      year: 2023,
      price: 729000,
      km: "28,000 km",
      fuel: "Diesel",
    },
    {
      id: "ranger",
      brand: "FORD",
      model: "Ranger 2.0D Wildtrak",
      year: 2022,
      price: 649000,
      km: "41,000 km",
      fuel: "Diesel",
    },
    {
      id: "polo",
      brand: "VOLKSWAGEN",
      model: "Polo 1.0 TSI",
      year: 2023,
      price: 329000,
      km: "18,000 km",
      fuel: "Petrol",
    },
  ],
};
