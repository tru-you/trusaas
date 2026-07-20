/**
 * Ray / Your Car Guy — TruChat config
 * Personal-first: handoff lands on Ray's (or showroom) WhatsApp.
 * Business-ready: same config powers a future Cloud API bot.
 */
window.RAY_TRUCHAT_CONFIG = {
  assistantName: "Ray",
  dealerName: "Your Car Guy",
  brandLine: "Your Car Guy · Port Elizabeth",
  address: "17 Burt Drive, Newton Park, Port Elizabeth",
  hoursText:
    "*Working hours:*\n• Mon–Fri: 07:30 – 17:30\n• Saturday: 07:30 – 13:00\n• Sunday: Closed",
  /** Sales / Ray WhatsApp — digits only, country code, no + */
  salesWhatsApp: "27834659921",
  /** Optional public stock API (TruFlow) — leave empty to use local catalog */
  stockApi: "https://trusaas-premium.onrender.com/api/public/stock?dealer=your-car-guy",
  stockApiFallback: [
    "https://trusaas-premium.onrender.com/api/public/stock?dealer=demo",
  ],
  greeting:
    "Hi — I'm **Ray**, your virtual assistant at **Your Car Guy**.\n\nI can help with stock, test drives, trade-in valuations, or showroom hours. What do you need?",
  suggestions: ["Browse stock", "Trade-in valuation", "Showroom hours"],
  brandMap: {
    ranger: "FORD",
    ford: "FORD",
    everest: "FORD",
    hilux: "TOYOTA",
    toyota: "TOYOTA",
    polo: "VOLKSWAGEN",
    vw: "VOLKSWAGEN",
    volkswagen: "VOLKSWAGEN",
    audi: "AUDI",
    s3: "AUDI",
  },
  /** Local catalog if API empty */
  catalog: [
    {
      id: "ford-ranger",
      brand: "FORD",
      model: "Ranger 2.0D Bi-Turbo Wildtrak 4x4",
      year: 2021,
      price: 499000,
      km: "80,000 km",
      fuel: "Diesel",
    },
    {
      id: "audi-s3",
      brand: "AUDI",
      model: "S3 Sportback",
      year: 2012,
      price: 255000,
      km: "141,000 km",
      fuel: "Petrol",
    },
    {
      id: "ford-everest",
      brand: "FORD",
      model: "Everest 2.2 TDCi XLS A/T",
      year: 2018,
      price: 369000,
      km: "94,000 km",
      fuel: "Diesel",
    },
    {
      id: "vw-polo",
      brand: "VOLKSWAGEN",
      model: "Polo Vivo 1.4 Trendline",
      year: 2020,
      price: 189000,
      km: "55,000 km",
      fuel: "Petrol",
    },
    {
      id: "toyota-hilux",
      brand: "TOYOTA",
      model: "Hilux 2.8 GD-6 Legend 4x4",
      year: 2022,
      price: 589000,
      km: "45,000 km",
      fuel: "Diesel",
    },
  ],
};
