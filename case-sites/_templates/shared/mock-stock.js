/*  Shared demo stock – realistic SA market vehicles.
    Drop this file into any template; override DEMO_DEALER in SITE_CONFIG. */

const MOCK_STOCK = [
  {
    id: "demo-001",
    make: "Volkswagen", model: "Polo", variant: "1.0 TSI Life",
    year: 2022, mileage: 34200, price: 289900, body: "Hatchback",
    color: "Reflex Silver", transmission: "Manual", fuel: "Petrol",
    img: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=640&q=80",
    specs: ["1.0L Turbo", "85kW", "5-Speed"],
    truPrice: 294000, virScore: 92
  },
  {
    id: "demo-002",
    make: "Toyota", model: "Hilux", variant: "2.4 GD-6 SR",
    year: 2021, mileage: 62400, price: 449900, body: "Bakkie",
    color: "Glacier White", transmission: "Manual", fuel: "Diesel",
    img: "https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=640&q=80",
    specs: ["2.4L Diesel", "110kW", "6-Speed"],
    truPrice: 459000, virScore: 88
  },
  {
    id: "demo-003",
    make: "Hyundai", model: "Creta", variant: "1.5 Executive",
    year: 2023, mileage: 18500, price: 379900, body: "SUV",
    color: "Phantom Black", transmission: "Automatic", fuel: "Petrol",
    img: "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=640&q=80",
    specs: ["1.5L", "85kW", "IVT Auto"],
    truPrice: 385000, virScore: 95
  },
  {
    id: "demo-004",
    make: "Ford", model: "EcoSport", variant: "1.0T Titanium",
    year: 2021, mileage: 47800, price: 249900, body: "SUV",
    color: "Blue Lightning", transmission: "Automatic", fuel: "Petrol",
    img: "https://images.unsplash.com/photo-1551830820-330a71b99659?w=640&q=80",
    specs: ["1.0L Turbo", "92kW", "6-Speed Auto"],
    truPrice: 255000, virScore: 86
  },
  {
    id: "demo-005",
    make: "Suzuki", model: "Swift", variant: "1.2 GL",
    year: 2023, mileage: 12300, price: 219900, body: "Hatchback",
    color: "Pearl Arctic White", transmission: "Manual", fuel: "Petrol",
    img: "https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=640&q=80",
    specs: ["1.2L", "61kW", "5-Speed"],
    truPrice: 224000, virScore: 97
  },
  {
    id: "demo-006",
    make: "Toyota", model: "Fortuner", variant: "2.4 GD-6 Auto",
    year: 2022, mileage: 41200, price: 599900, body: "SUV",
    color: "Attitude Black", transmission: "Automatic", fuel: "Diesel",
    img: "https://images.unsplash.com/photo-1625231334401-6162a6ce0b88?w=640&q=80",
    specs: ["2.4L Diesel", "110kW", "6-Speed Auto"],
    truPrice: 615000, virScore: 90
  },
  {
    id: "demo-007",
    make: "Volkswagen", model: "T-Cross", variant: "1.0 TSI Comfortline",
    year: 2022, mileage: 29100, price: 339900, body: "SUV",
    color: "Makena Turquoise", transmission: "Automatic", fuel: "Petrol",
    img: "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=640&q=80",
    specs: ["1.0L Turbo", "85kW", "7-Speed DSG"],
    truPrice: 345000, virScore: 93
  },
  {
    id: "demo-008",
    make: "Nissan", model: "NP200", variant: "1.6 Safety Pack",
    year: 2022, mileage: 55600, price: 179900, body: "Bakkie",
    color: "Solid White", transmission: "Manual", fuel: "Petrol",
    img: "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=640&q=80",
    specs: ["1.6L", "77kW", "5-Speed"],
    truPrice: 184000, virScore: 84
  },
  {
    id: "demo-009",
    make: "Kia", model: "Seltos", variant: "1.5 EX Auto",
    year: 2023, mileage: 15800, price: 419900, body: "SUV",
    color: "Gravity Grey", transmission: "Automatic", fuel: "Petrol",
    img: "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=640&q=80",
    specs: ["1.5L", "85kW", "CVT Auto"],
    truPrice: 425000, virScore: 94
  },
  {
    id: "demo-010",
    make: "Toyota", model: "Starlet", variant: "1.5 Xs Auto",
    year: 2023, mileage: 21400, price: 259900, body: "Hatchback",
    color: "Celestite Grey", transmission: "Automatic", fuel: "Petrol",
    img: "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=640&q=80",
    specs: ["1.5L", "79kW", "CVT Auto"],
    truPrice: 264000, virScore: 91
  },
  {
    id: "demo-011",
    make: "Haval", model: "Jolion", variant: "1.5T City",
    year: 2022, mileage: 38700, price: 299900, body: "SUV",
    color: "Hamilton White", transmission: "Manual", fuel: "Petrol",
    img: "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=640&q=80",
    specs: ["1.5L Turbo", "110kW", "6-Speed"],
    truPrice: 305000, virScore: 87
  },
  {
    id: "demo-012",
    make: "Mercedes-Benz", model: "C200", variant: "AMG Line Auto",
    year: 2021, mileage: 52300, price: 649900, body: "Sedan",
    color: "Obsidian Black", transmission: "Automatic", fuel: "Petrol",
    img: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=640&q=80",
    specs: ["1.5L Turbo", "150kW", "9G-Tronic"],
    truPrice: 665000, virScore: 89
  },
  {
    id: "demo-013",
    make: "Renault", model: "Kwid", variant: "1.0 Dynamique",
    year: 2023, mileage: 9800, price: 164900, body: "Hatchback",
    color: "Moonlight Silver", transmission: "Manual", fuel: "Petrol",
    img: "https://images.unsplash.com/photo-1549317661-bd32c8ce0afa?w=640&q=80",
    specs: ["1.0L", "50kW", "5-Speed"],
    truPrice: 169000, virScore: 96
  },
  {
    id: "demo-014",
    make: "Isuzu", model: "D-Max", variant: "250 HO Hi-Ride",
    year: 2022, mileage: 44100, price: 469900, body: "Bakkie",
    color: "Splash White", transmission: "Manual", fuel: "Diesel",
    img: "https://images.unsplash.com/photo-1590362891991-f776e747a588?w=640&q=80",
    specs: ["2.5L Diesel", "110kW", "6-Speed"],
    truPrice: 479000, virScore: 88
  },
  {
    id: "demo-015",
    make: "BMW", model: "X1", variant: "sDrive18i xLine Auto",
    year: 2021, mileage: 58200, price: 529900, body: "SUV",
    color: "Mineral White", transmission: "Automatic", fuel: "Petrol",
    img: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=640&q=80",
    specs: ["1.5L Turbo", "103kW", "7-Speed Auto"],
    truPrice: 539000, virScore: 85
  }
];
