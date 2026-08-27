import { RawFbListing } from '../types';

export const SA_MOCK_MULTI_SOURCE_LISTINGS: RawFbListing[] = [
  // 1. Facebook Marketplace (Underpriced Private Sale)
  {
    id: 'fb_item_polo_2017',
    source: 'facebook',
    url: 'https://www.facebook.com/marketplace/johannesburg/search?query=2017%20VW%20Polo%20TSI',
    title: '2017 VW Polo 1.2 TSI Comfortline clean accident free',
    description: 'Selling my 2017 polo tsi comfortline manual, 110000km, full service history, aircon, papers in order, R125k neg. Randburg JHB.',
    final_price: 125000,
    price: 125000,
    currency: 'ZAR',
    location: 'Randburg, Johannesburg',
    seller_id: 'seller_johan_01',
    seller_name: 'Johan van der Merwe (Private)',
    images: ['https://fbcdn.net/mock_polo1.jpg'],
    date_posted: '2026-08-20T10:00:00Z',
  },

  // 2. Cars.co.za (Underpriced Dealer Trade-in)
  {
    id: 'cars_item_hilux_2019',
    source: 'cars_co_za',
    url: 'https://www.cars.co.za/usedcars/Toyota/Hilux/?Year=2019',
    title: '2019 Toyota Hilux 2.8 GD-6 Raider 4x4 Double Cab',
    description: '2019 Hilux 2.8 GD6 4x4 auto, 135000 km, leather, canopy, towbar. Special dealership clearance price. Centurion.',
    final_price: 345000,
    initial_price: 410000,
    price: 345000,
    currency: 'ZAR',
    location: 'Centurion, Pretoria',
    seller_name: 'Centurion Auto Hub (Dealer)',
    images: ['https://img.cars.co.za/mock_hilux.jpg'],
    date_posted: '2026-08-01T08:30:00Z',
  },

  // 3. AutoTrader (Major Price Drop / Motivated Seller)
  {
    id: 'at_item_i20_2015',
    source: 'autotrader',
    url: 'https://www.autotrader.co.za/cars-for-sale?make=Hyundai&model=i20&year=2015',
    title: '2015 Hyundai i20 1.2 Motion',
    description: '2015 Hyundai i20 1.2 manual, 115000km, immaculate condition, 1 owner from new, reduced to R95,000 cash to clear floor.',
    final_price: 95000,
    initial_price: 118000,
    price: 95000,
    currency: 'ZAR',
    location: 'Cape Town, Western Cape',
    seller_name: 'Atlantic Motor Group (AutoTrader)',
    images: ['https://autotrader.co.za/mock_i20.jpg'],
    date_posted: '2026-08-22T11:20:00Z',
  },

  // 4. Independent Dealer Website via Google SERP (Stale Floorplan Stock: 52 Days Listed!)
  {
    id: 'serp_dealer_ranger_2018',
    source: 'dealer_direct',
    url: 'https://www.eastrandmotors.co.za/stock/2018-ford-ranger-22-tdci',
    title: '2018 Ford Ranger 2.2 TDCi XL Double Cab - Reduced Price!',
    description: 'East Rand Motors: 2018 Ford Ranger 2.2 diesel double cab, 160 000km, neat condition. Was R295,000 now R255,000. Floorplan clearance.',
    final_price: 255000,
    initial_price: 295000,
    price: 255000,
    currency: 'ZAR',
    location: 'Boksburg, Johannesburg',
    seller_name: 'East Rand Motors (Dealer Website)',
    images: ['https://eastrandmotors.co.za/mock_ranger.jpg'],
    date_posted: '2026-07-06T09:00:00Z', // 52 days ago!
  },

  // 5. Gumtree (Private Quick Sale)
  {
    id: 'gumtree_swift_2020',
    source: 'gumtree',
    url: 'https://www.gumtree.co.za/s-cars-bakkies/suzuki-swift/v1c9077p1',
    title: '2020 Suzuki Swift 1.2 GL manual clean',
    description: '2020 Swift 1.2 GL 55000km, aircon, electric windows, full service history with Suzuki. Relocating overseas, R115,000 non-negotiable.',
    final_price: 115000,
    price: 115000,
    currency: 'ZAR',
    location: 'Durban, KwaZulu-Natal',
    seller_name: 'Ashley Govender (Gumtree Private)',
    images: ['https://gumtree.co.za/mock_swift.jpg'],
    date_posted: '2026-08-24T14:00:00Z',
  },

  // 6. Non-runner (Spam/Salvage Filter Test)
  {
    id: 'fb_item_golf_nonrunner',
    source: 'facebook',
    url: 'https://www.facebook.com/marketplace/item/5610293847',
    title: '2008 VW Golf 5 GTI non runner gearbox issue',
    description: 'Golf 5 gti 2008 dsg, non runner gearbox issue, selling for spares or rebuild, R35000 as is. Boksburg.',
    final_price: 35000,
    price: 35000,
    currency: 'ZAR',
    location: 'Boksburg, Gauteng',
    seller_id: 'seller_kobus_05',
    seller_name: 'Kobus Marais',
    images: ['https://fbcdn.net/mock_golf.jpg'],
    date_posted: '2026-08-26T09:00:00Z',
  },
];

export const SA_MOCK_FB_LISTINGS = SA_MOCK_MULTI_SOURCE_LISTINGS;
