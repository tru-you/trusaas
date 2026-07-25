export type ClassifiedSource = 'autotrader' | 'cars.com' | 'cargurus' | 'edmunds' | 'google';


export type DealershipStatus = 'identified' | 'contacted' | 'meeting_scheduled' | 'partnered' | 'closed';

export interface CarDealership {
  id: string;
  name: string;
  status: DealershipStatus;
  source: ClassifiedSource;
  location: string;
  address: string;
  phone: string;
  email: string;
  contactPerson: string;
  inventoryCount: number;
  avgVehiclePrice: number;
  rating: number;
  reviewsCount: number;
  website: string;
  franchiseMakes: string[];
  notes?: string;
  intelReport?: {
    digitalMaturity: 'High' | 'Medium' | 'Emerging';
    estimatedMonthlyAdSpend: number;
    inventoryTurnoverDays: number;
    topSellingModels: string[];
    sentimentScore: number; // 0-100
    techStack?: {
      crm: string;
      inventoryManager: string;
      adsPlatform: string;
      analytics: string[];
      marketingAutomation?: string;
    };
    swotSummary: {
      strengths: string[];
      weaknesses: string[];
      opportunities: string[];
      threats: string[];
    };
  };
}
