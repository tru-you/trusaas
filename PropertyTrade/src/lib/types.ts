export interface AgentBrief {
  id: string;
  role: 'admin' | 'manager' | 'agent';
  label: string;
  agencyId: string;
  agencyName: string;
}

export interface Property {
  id: string;
  agencyId: string;
  ownerId: string | null;
  address: string;
  unitNumber: string;
  suburb: string;
  city: string;
  province: string;
  postalCode: string;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  floorArea: number;
  erfNumber: string;
  monthlyRentZAR: number;
  depositZAR: number;
  rentalStatus: string;
  askingPriceZAR: number;
  salesStatus: string;
  purpose: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
  idNumber: string;
  phone: string;
  email: string;
  whatsapp: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  ficaStatus: string;
  ficaSubmittedAt: string | null;
  employer: string;
  employerPhone: string;
  monthlyIncome: number;
  notes: string;
  createdAt: string;
}

export interface Buyer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  budgetZAR?: number;
  createdAt?: string;
}

export interface Interest {
  id: string;
  propertyId: string;
  buyerId: string;
  status: string;
  source?: string;
  note?: string;
  createdAt?: string;
}

export interface Viewing {
  id: string;
  propertyId: string;
  buyerId: string;
  interestId?: string;
  scheduledDate: string;
  scheduledTime?: string;
  status: string;
  rating?: string;
  notes?: string;
  createdAt?: string;
}

export interface Mandate {
  id: string;
  propertyId: string;
  ownerId?: string;
  type: string;
  status: string;
  signedDate?: string;
  expiryDate?: string;
  commissionRatePct?: number;
  createdAt?: string;
}

export interface Offer {
  id: string;
  propertyId: string;
  buyerId: string;
  mandateId?: string;
  offerAmountZAR: number;
  status: string;
  expiryDate?: string;
  createdAt?: string;
}

export interface Sale {
  id: string;
  propertyId: string;
  buyerId: string;
  offerId: string;
  saleAmountZAR?: number;
  status: string;
  transferDate?: string;
  createdAt?: string;
}

export interface Lease {
  id: string;
  propertyId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  monthlyRentZAR: number;
  annualEscalation?: number;
  depositZAR: number;
  depositBankName?: string;
  depositAccountNumber?: string;
  depositPaidDate?: string;
  depositReceiptSentDate?: string;
  depositReceiptOverdue?: boolean;
  depositRefundOverdue?: boolean;
  status: string;
  terminationReason?: string;
  moveInDate?: string;
  moveOutDate?: string;
  createdAt?: string;
}

export interface Payment {
  id: string;
  leaseId: string;
  propertyId?: string;
  tenantId?: string;
  dueDate: string;
  amountZAR: number;
  status: string;
  method: string;
  date?: string;
  reference?: string;
  notes?: string;
  createdAt?: string;
}

export interface ArrearsRow {
  leaseId: string;
  propertyId: string;
  tenantId: string;
  address: string;
  tenantName: string;
  monthlyRentZAR: number;
  paidZAR: number;
  outstandingZAR: number;
  month: string;
}

export interface Agent {
  id: string;
  label: string;
  role: string;
  assignedPropertyIds?: string[];
  active: boolean;
  createdAt?: string;
}

export interface Agency {
  id?: string;
  name: string;
  slug: string;
  region?: string;
  ficaRef?: string;
  contactEmail?: string;
  contactPhone?: string;
  whatsapp?: string;
  address?: string;
  bankName?: string;
  bankAccount?: string;
  bankBranch?: string;
  eaabRef?: string;
  logoDataUrl?: string;
  updatedAt?: string;
}

export interface RentRollRow {
  propertyId: string;
  address: string;
  tenantName: string;
  monthlyRentZAR: number;
  paidZAR: number;
  balanceZAR: number;
  leaseEnd: string;
}

export interface RentRollReport {
  month: string;
  totalDueZAR: number;
  totalPaidZAR: number;
  totalOutstandingZAR: number;
  rows: RentRollRow[];
}

export interface ArrearsReport {
  month: string;
  count: number;
  rows: (ArrearsRow & { phone?: string })[];
}

export interface PipelineRow {
  propertyId: string;
  address: string;
  suburb: string;
  askingPriceZAR: number;
  activeMandates: number;
  pendingOffers: number;
  daysOnMarket: number;
}

export interface SalesPipeline {
  summary: {
    available: number;
    underOffer: number;
    sold: number;
    withdrawn: number;
    totalListingValueZAR: number;
  };
  pipeline: Record<string, PipelineRow[]>;
}

export interface CommissionRow {
  propertyId: string;
  address: string;
  ownerName?: string;
  rentCollectedZAR?: number;
  commissionPercent?: number;
  commissionZAR: number;
  salePriceZAR?: number;
  commissionPaid?: boolean;
}

export interface CommissionReport {
  month: string;
  rental: { rows: CommissionRow[]; totalCommissionZAR: number };
  sales: { rows: CommissionRow[]; totalCommissionZAR: number };
  grandTotalZAR: number;
}

export interface Maintenance {
  id: string;
  propertyId: string;
  category?: string;
  priority: string;
  status: string;
  description?: string;
  reportedAt?: string;
  createdAt?: string;
}

export interface ExpiringLease {
  id: string;
  propertyId: string;
  tenantId: string;
  endDate: string;
  monthlyRentZAR: number;
}

export interface DepositAlert {
  leaseId: string;
  propertyId: string;
  depositPaidDate?: string;
}

export interface DashboardStats {
  totalProperties: number;
  occupiedCount: number;
  vacantCount: number;
  occupancyRate: number;
  rentDueThisMonthZAR: number;
  rentCollectedThisMonthZAR: number;
  rentOutstandingZAR: number;
  arrearsCount: number;
  maintenanceOpen: number;
  maintenanceUrgent: number;
  activeListings: number;
  pendingOffers: number;
  activeLeads: number;
  viewingsThisWeek: number;
  expiringLeases: ExpiringLease[];
  depositAlerts: DepositAlert[];
  month: string;
}