export interface Vehicle {
  id: string;
  yr: number;
  make: string;
  name: string;
  variant: string;
  body: 'Hatchback' | 'SUV' | 'Bakkie' | 'Coupe' | 'Sedan';
  perf: boolean;
  km: number; // raw number so we can sort and filter easily
  tr: 'Auto' | 'Manual' | 'DSG' | 'DCT' | 'S-Tronic';
  fuel: 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric';
  price: number;
  tag: string;
  hot: boolean;
  img: string;
  gallery: string[];
  engine: string;
  power: string;
  owners: number;
  color: string;
  history: string;
  grade: 'A+' | 'A' | 'B+';
  features: string[];
}

export interface FilterState {
  search: string;
  make: string;
  body: string;
  maxPrice: number | '';
  minYear: number | '';
  sort: 'featured' | 'price-asc' | 'price-desc' | 'year-desc' | 'km-asc';
}

export interface TradeInSubmission {
  name: string;
  phone: string;
  email: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  vehicleKm: number;
  condition: 'Excellent' | 'Good' | 'Fair';
  notes?: string;
}

export interface Testimonial {
  id: string;
  stars: number;
  quote: string;
  author: string;
  vehicleModel: string;
  initials: string;
}
