/**
 * Cars on Caledon · TruChat config
 * AI chatbot + leads portal + site widget for the Caledon showroom.
 */
window.COC_TRUCHAT_CONFIG = {
  assistantName: "Caledon",
  dealerName: "Cars on Caledon",
  brandLine: "Cars on Caledon · Quality Pre-Owned · Kariega",
  address: "257 Caledon Street, Kariega, Eastern Cape",
  siteUrl: "https://carsoncaledon.co.za",

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

  leadWebhook: "",
  leadStorageKey: "coc_truchat_leads_v1",
  portalPin: "",

  stockApi: "https://trusaas-premium.onrender.com/api/public/stock?dealer=cars-on-caledon",
  stockApiFallback: [
    "https://trusaas-flow.onrender.com/api/public/stock?dealer=cars-on-caledon",
    "https://trusaas-flow.onrender.com/api/public/stock?dealer=caledon-cars"
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

  catalog: [
    { id: "ranger-wildtrak", brand: "FORD", model: "Ranger 3.2 TDCi Wildtrak 4x4", year: 2019, price: 419900, km: "115 000 km", fuel: "Diesel" },
    { id: "polo-gti", brand: "VOLKSWAGEN", model: "Polo GTI 2.0 TSI", year: 2021, price: 384900, km: "46 500 km", fuel: "Petrol" },
    { id: "golf-gti", brand: "VOLKSWAGEN", model: "Golf 7.5 GTI 2.0 TSI", year: 2020, price: 429900, km: "62 000 km", fuel: "Petrol" },
    { id: "fortuner-epic", brand: "TOYOTA", model: "Fortuner 2.8 GD-6 4x4 Epic", year: 2021, price: 539900, km: "88 000 km", fuel: "Diesel" },
    { id: "a45-amg", brand: "MERCEDES-AMG", model: "A45 4Matic", year: 2018, price: 479900, km: "71 000 km", fuel: "Petrol" },
    { id: "hilux-legend", brand: "TOYOTA", model: "Hilux 2.8 GD-6 Legend RS", year: 2022, price: 619900, km: "52 000 km", fuel: "Diesel" }
  ],
};
