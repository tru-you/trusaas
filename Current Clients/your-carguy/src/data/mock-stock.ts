// Mock VMG feed data — matches the response shape we'll receive from VMG API
// This layer will be swapped for real API calls when credentials are ready

export interface Vehicle {
  id: string;
  stockNo: string;
  year: number;
  make: string;
  model: string;
  variant: string;
  fullName: string;
  price: number;
  mileage: number;
  transmission: string;
  fuelType: string;
  engineSize?: string;
  drivetrain?: string;
  bodyType: string;
  colour: string;
  doors?: number;
  vin?: string;
  condition: string;
  images: string[];
  damageTags?: { slot: string; tags: { type: string; severity: number }[] }[];
  dateAdded: string;
  daystInStock: number;
  category?: "featured" | "new-in" | "hot-deal";
}

const IMAGES = [
  "https://images.unsplash.com/photo-1590362891981-f532a1c663f3?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1549317661-bd32c8ce0afa?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1558618666-fcd2fc071e65?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1583121274602-a3e3cad4b3af?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1542361345-86e0b1aa23db?w=800&h=600&fit=crop",
];

export const VEHICLES: Vehicle[] = [
  {
    id: "v001",
    stockNo: "YC-RNG-001",
    year: 2020,
    make: "Ford",
    model: "Ranger",
    variant: "2.0D Bi-Turbo Wildtrak 4x4 A/T P/U D/C",
    fullName: "2020 FORD RANGER 2.0D BI-TURBO WILDTRAK 4X4 A/T P/U D/C",
    price: 489900,
    mileage: 83000,
    transmission: "Automatic",
    fuelType: "Diesel",
    engineSize: "1997cc",
    drivetrain: "4x4",
    bodyType: "Bakkie Double Cab",
    colour: "White",
    doors: 4,
    condition: "Excellent",
    images: IMAGES.slice(0, 6),
    dateAdded: "2026-06-15",
    daystInStock: 77,
    category: "featured",
  },
  {
    id: "v002",
    stockNo: "YC-HTL-002",
    year: 2023,
    make: "Toyota",
    model: "Hilux",
    variant: "2.4 GD-6 Raider X 4x4 A/T P/U D/C",
    fullName: "2023 TOYOTA HILUX 2.4 GD-6 RAIDER X 4X4 A/T P/U D/C",
    price: 479000,
    mileage: 147000,
    transmission: "Automatic",
    fuelType: "Diesel",
    engineSize: "2393cc",
    drivetrain: "4x4",
    bodyType: "Bakkie Double Cab",
    colour: "Silver",
    doors: 4,
    condition: "Excellent",
    images: IMAGES.slice(1, 7).concat(IMAGES[0]),
    dateAdded: "2026-07-01",
    daystInStock: 61,
    category: "featured",
  },
  {
    id: "v003",
    stockNo: "YC-SMJ-003",
    year: 2024,
    make: "Suzuki",
    model: "Jimny",
    variant: "1.5 GLX A/T",
    fullName: "2024 SUZUKI JIMNY 1.5 GLX A/T",
    price: 419900,
    mileage: 17500,
    transmission: "Automatic",
    fuelType: "Petrol",
    engineSize: "1462cc",
    drivetrain: "4x4",
    bodyType: "4 x 4",
    colour: "Blue",
    doors: 3,
    condition: "Excellent",
    images: IMAGES.slice(2, 7),
    dateAdded: "2026-07-20",
    daystInStock: 42,
    category: "featured",
  },
  {
    id: "v004",
    stockNo: "YC-GHF-004",
    year: 2022,
    make: "Volkswagen",
    model: "Golf",
    variant: "GTI 2.0 TSI DSG",
    fullName: "2022 VOLKSWAGEN GOLF GTI 2.0 TSI DSG",
    price: 429900,
    mileage: 32000,
    transmission: "Automatic",
    fuelType: "Petrol",
    engineSize: "1984cc",
    drivetrain: "FWD",
    bodyType: "Hatchback",
    colour: "Kings Red",
    doors: 5,
    condition: "Excellent",
    images: [IMAGES[3], ...IMAGES.slice(4, 7), IMAGES[0]],
    dateAdded: "2026-05-10",
    daystInStock: 113,
    category: "hot-deal",
  },
  {
    id: "v005",
    stockNo: "YC-MBC-005",
    year: 2019,
    make: "Mercedes-Benz",
    model: "C-Class",
    variant: "C200 AMG Line G Tronic",
    fullName: "2019 MERCEDES-BENZ C-CLASS C200 AMG LINE G TRONIC",
    price: 399900,
    mileage: 89000,
    transmission: "Automatic",
    fuelType: "Petrol",
    engineSize: "1497cc",
    drivetrain: "RWD",
    bodyType: "Sedan",
    colour: "Obsidian Black",
    doors: 4,
    condition: "Very Good",
    images: IMAGES.slice(0, 4),
    dateAdded: "2026-04-05",
    daystInStock: 148,
  },
  {
    id: "v006",
    stockNo: "YC-TYT-006",
    year: 2021,
    make: "Toyota",
    model: "Fortuner",
    variant: "2.8 GD-6 4x4 A/T Raider",
    fullName: "2021 TOYOTA FORTUNER 2.8 GD-6 4X4 A/T RAIDER",
    price: 485000,
    mileage: 67000,
    transmission: "Automatic",
    fuelType: "Diesel",
    engineSize: "2755cc",
    drivetrain: "4x4",
    bodyType: "SUV",
    colour: "White",
    doors: 5,
    condition: "Excellent",
    images: IMAGES.slice(1, 5),
    dateAdded: "2026-03-15",
    daystInStock: 169,
  },
  {
    id: "v007",
    stockNo: "YC-FDE-007",
    year: 2023,
    make: "Ford",
    model: "Everest",
    variant: "2.0 BiTurbo 4x4 XLT A/T",
    fullName: "2023 FORD EVEREST 2.0 BITURBO 4X4 XLT A/T",
    price: 499900,
    mileage: 22000,
    transmission: "Automatic",
    fuelType: "Diesel",
    engineSize: "1997cc",
    drivetrain: "4x4",
    bodyType: "SUV",
    colour: "Gray",
    doors: 5,
    condition: "Excellent",
    images: IMAGES.slice(2, 6),
    dateAdded: "2026-08-01",
    daystInStock: 30,
    category: "new-in",
  },
  {
    id: "v008",
    stockNo: "YC-HAC-008",
    year: 2022,
    make: "Honda",
    model: "Civic",
    variant: "1.5 VTEC Turbo Touring",
    fullName: "2022 HONDA CIVIC 1.5 VTEC TURBO TOURING",
    price: 339900,
    mileage: 45000,
    transmission: "CVT",
    fuelType: "Petrol",
    engineSize: "1498cc",
    drivetrain: "FWD",
    bodyType: "Sedan",
    colour: "Sonic Grey",
    doors: 4,
    condition: "Very Good",
    images: IMAGES.slice(3, 7),
    dateAdded: "2026-06-20",
    daystInStock: 72,
  },
];

/** Simulate VMG fetch with artificial delay */
export async function fetchVMGStock(params?: {
  page?: number;
  limit?: number;
  filters?: { makes?: string[]; minPrice?: number; maxPrice?: number };
}): Promise<{ vehicles: Vehicle[]; total: number }> {
  await new Promise((r) => setTimeout(r, 300)); // mimic network latency

  let filtered = [...VEHICLES];

  if (params?.filters) {
    if (params.filters.makes?.length) {
      filtered = filtered.filter((v) => params.filters!.makes!.includes(v.make));
    }
    if (params.filters.minPrice != null) {
      filtered = filtered.filter((v) => v.price >= params.filters!.minPrice!);
    }
    if (params.filters.maxPrice != null) {
      filtered = filtered.filter((v) => v.price <= params.filters!.maxPrice!);
    }
  }

  return { vehicles: filtered.slice(0, params?.limit || 12), total: filtered.length };
}
