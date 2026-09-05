/*  Reef City Motors — ENTRY tier demo stock
    Budget / high-volume pre-owned. Real SA models, Aug-2026 market pricing.
    Defines global MOCK_STOCK consumed by index.html. */

const MOCK_STOCK = [
  { id:"rcm-001", make:"Renault", model:"Kwid", variant:"1.0 Dynamique", year:2022, mileage:41200, price:159900, body:"Hatchback", color:"Fiery Red", transmission:"Manual", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1549317661-bd32c8ce0afa?w=640&q=80", specs:["1.0L","50kW","Aircon"], truPrice:165000, virScore:88 },
  { id:"rcm-002", make:"Volkswagen", model:"Polo Vivo", variant:"1.4 Trendline", year:2021, mileage:63400, price:184900, body:"Hatchback", color:"Reflex Silver", transmission:"Manual", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=640&q=80", specs:["1.4L","63kW","5-Speed"], truPrice:189000, virScore:90 },
  { id:"rcm-003", make:"Toyota", model:"Starlet", variant:"1.4 Xi", year:2021, mileage:58700, price:199900, body:"Hatchback", color:"Silver Metallic", transmission:"Manual", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1502877338535-766e1452684a?w=640&q=80", specs:["1.4L","68kW","5-Speed"], truPrice:205000, virScore:91 },
  { id:"rcm-004", make:"Ford", model:"Figo", variant:"1.5 Trend", year:2020, mileage:72100, price:154900, body:"Hatchback", color:"Diffused Silver", transmission:"Manual", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=640&q=80", specs:["1.5L","91kW","5-Speed"], truPrice:159000, virScore:85 },
  { id:"rcm-005", make:"Hyundai", model:"i10", variant:"1.1 Motion", year:2021, mileage:49800, price:149900, body:"Hatchback", color:"Alpine Blue", transmission:"Manual", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=640&q=80", specs:["1.1L","49kW","5-Speed"], truPrice:154000, virScore:87 },
  { id:"rcm-006", make:"Kia", model:"Picanto", variant:"1.0 Street", year:2022, mileage:38400, price:179900, body:"Hatchback", color:"Clear White", transmission:"Manual", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1502877338535-766e1452684a?w=640&q=80", specs:["1.0L","49kW","5-Speed"], truPrice:184000, virScore:92 },
  { id:"rcm-007", make:"Nissan", model:"NP200", variant:"1.6 8V Base", year:2021, mileage:81300, price:169900, body:"Bakkie", color:"Solid White", transmission:"Manual", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=640&q=80", specs:["1.6L","64kW","Canopy-ready"], truPrice:175000, virScore:83 },
  { id:"rcm-008", make:"Toyota", model:"Avanza", variant:"1.5 SX", year:2019, mileage:98600, price:189900, body:"MPV", color:"Silver Mica", transmission:"Manual", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=640&q=80", specs:["1.5L","7-Seater","Petrol"], truPrice:196000, virScore:84 },
  { id:"rcm-009", make:"Datsun", model:"Go", variant:"1.2 Lux", year:2020, mileage:64500, price:114900, body:"Hatchback", color:"Ruby", transmission:"Manual", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1549317661-bd32c8ce0afa?w=640&q=80", specs:["1.2L","50kW","Touchscreen"], truPrice:119000, virScore:80 },
  { id:"rcm-010", make:"Volkswagen", model:"Polo", variant:"1.4 Comfortline", year:2018, mileage:112400, price:174900, body:"Hatchback", color:"Deep Black", transmission:"Manual", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=640&q=80", specs:["1.4L","63kW","Bluetooth"], truPrice:181000, virScore:82 },
  { id:"rcm-011", make:"Suzuki", model:"Swift", variant:"1.2 GA", year:2021, mileage:52900, price:169900, body:"Hatchback", color:"Pearl White", transmission:"Manual", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=640&q=80", specs:["1.2L","61kW","5-Speed"], truPrice:174000, virScore:93 },
  { id:"rcm-012", make:"Toyota", model:"Corolla Quest", variant:"1.6 Plus", year:2019, mileage:104200, price:229900, body:"Sedan", color:"Graphite", transmission:"Manual", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=640&q=80", specs:["1.6L","90kW","Reverse Cam"], truPrice:236000, virScore:88 },
  { id:"rcm-013", make:"Chevrolet", model:"Utility", variant:"1.4 Club", year:2016, mileage:143800, price:129900, body:"Bakkie", color:"Summit White", transmission:"Manual", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1590362891991-f776e747a588?w=640&q=80", specs:["1.4L","Canopy","Tow Bar"], truPrice:134000, virScore:78 },
  { id:"rcm-014", make:"Hyundai", model:"Grand i10", variant:"1.0 Fluid", year:2020, mileage:69700, price:164900, body:"Hatchback", color:"Titan Grey", transmission:"Automatic", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1502877338535-766e1452684a?w=640&q=80", specs:["1.0L","49kW","Auto"], truPrice:170000, virScore:86 },
  { id:"rcm-015", make:"Ford", model:"EcoSport", variant:"1.5 Ambiente", year:2019, mileage:88900, price:214900, body:"SUV", color:"Moondust Silver", transmission:"Manual", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1551830820-330a71b99659?w=640&q=80", specs:["1.5L","91kW","High Ride"], truPrice:221000, virScore:84 }
];
