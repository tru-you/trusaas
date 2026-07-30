/**
 * Ray / Your Car Guy — TruChat config
 *
 * Ship tonight: web AI chatbot + chatbot leads portal (+ WP widget).
 * Text Business bot: later.
 */
window.RAY_TRUCHAT_CONFIG = {
  assistantName: "Ray",
  dealerName: "Your Car Guy",
  brandLine: "Your Car Guy · Port Elizabeth",
  address: "17 Burt Drive, Newton Park, Port Elizabeth",
  siteUrl: "https://yourcarguy.co.za",
  /**
   * Brand mark — premium YCG icon (FAB + chat avatar).
   * Relative paths resolve from widget.js / chat page location.
   * After WP upload: …/uploads/truchat/ray/assets/ycg-icon.jpg
   */
  logoUrl: "assets/ycg-icon.jpg",
  fabIconUrl: "assets/ycg-icon.jpg",
  /** Brand red from live WP nav bar */
  brandRed: "#e30613",

  hoursText:
    "*Working hours:*\n• Mon–Fri: 07:30 – 17:30\n• Saturday: 07:30 – 13:00\n• Sunday: By appointment",

  /**
   * Ray's personal Text — digits only, country code, no +
   * Web chat "Continue on Text" + tickets land here.
   */
  personalText: "+1 512 555 0142",
  salesText: "+1 512 555 0142",

  /** Text Business Cloud API number — later */
  waBusinessNumber: "",

  /**
   * Optional: POST qualified leads as JSON { type, dealer, entry }.
   * Use Make.com / Zapier / n8n / Formspree so portal isn't the only inbox.
   * Example Formspree: "https://formspree.io/f/xxxxxxxx"
   */
  leadWebhook: "",

  /** Simple PIN for portal.html (leave "" to disable) */
  portalPin: "ycg",

  /** Public stock API — empty / fail → local catalog */
  stockApi: "https://premium.tru-saas.com/api/public/stock?dealer=your-car-guy",
  stockApiFallback: [
    "https://premium.tru-saas.com/api/public/stock?dealer=demo",
  ],

  greeting:
    "Hi — I'm **Ray** at **Your Car Guy**, Newton Park.\n\nQuality used cars, real answers — **stock**, **test drives**, **trade-ins**, **finance**, or **hours**. What can I sort for you?",
  suggestions: ["Browse stock", "Trade-in valuation", "Book test drive", "Finance help"],

  brandMap: {
    ranger: "FORD",
    ford: "FORD",
    everest: "FORD",
    mustang: "FORD",
    hilux: "TOYOTA",
    toyota: "TOYOTA",
    corolla: "TOYOTA",
    polo: "VOLKSWAGEN",
    vw: "VOLKSWAGEN",
    volkswagen: "VOLKSWAGEN",
    golf: "VOLKSWAGEN",
    audi: "AUDI",
    s3: "AUDI",
    a4: "AUDI",
    a3: "AUDI",
    chevy: "CHEVROLET",
    chevrolet: "CHEVROLET",
    utility: "CHEVROLET",
    haval: "HAVAL",
    mercedes: "MERCEDES-BENZ",
    merc: "MERCEDES-BENZ",
    benz: "MERCEDES-BENZ",
    nissan: "NISSAN",
    renault: "RENAULT",
    duster: "RENAULT",
    suzuki: "SUZUKI",
    harley: "HARLEY DAVIDSON",
  },

  /** Fallback catalog if stock API empty */
  catalog: [
    {
      id: "ranger-wildtrak",
      brand: "FORD",
      model: "Ranger 2.0D Bi-Turbo Wildtrak A/T D/C",
      year: 2023,
      price: 569000,
      km: "55,500 km",
      fuel: "Diesel",
    },
    {
      id: "ranger-xl",
      brand: "FORD",
      model: "Ranger 2.2TDCi XL D/C",
      year: 2019,
      price: 359000,
      km: "84,000 km",
      fuel: "Diesel",
    },
    {
      id: "chevy-utility",
      brand: "CHEVROLET",
      model: "Utility 1.4 A/C S/C",
      year: 2012,
      price: 149000,
      km: "160,000 km",
      fuel: "Gas",
    },
    {
      id: "audi-s3",
      brand: "AUDI",
      model: "S3 Sportback",
      year: 2012,
      price: 255000,
      km: "141,000 km",
      fuel: "Gas",
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
