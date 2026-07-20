export type VehicleStatus = 'INVENTORY' | 'PENDING' | 'SOLD';

export interface Dealership {
  id: string;
  name: string;
  location: string;
}

export interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  status: VehicleStatus;
  retailPrice: number;
  costPrice: number;
  mileage: number;
  transmission: 'Automatic' | 'Manual';
  fuelType: 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric';
  stockNumber: string;
  dateAcquired: string;
  daysInInventory: number;
  description: string;
  bodyType?: string;
  engine?: string;
  images?: string[];
  damagePhotos?: string[];
  vinPhotos?: string[];
  serviceBookPhotos?: string[];
  extrasPhotos?: string[];
  reconTasks?: { id: string; name: string; cost: number; status: 'Pending' | 'In Progress' | 'Completed'; dateAdded: string; category?: string; photo?: string }[];
  natisStatus?: 'VERIFIED' | 'NONE';
  natisDetails?: { verifiedAt: string; ownerMatch: string; theftCheck: string; financeLien: string; licenseExpiry: string };
  inspectionResults?: Record<string, 'Pass' | 'Attention'>;
  dealershipId?: string;
}

export type LeadStatus = 'New' | 'Contacted' | 'Test Drive Scheduled' | 'Negotiating' | 'Closed Won' | 'Closed Lost';

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  vehicleId: string;
  source: string;
  status: LeadStatus;
  assignedUserId: string;
  createdAt: string;
  lastContactedAt: string | null;
  digitalScore: number;
  notes: string;
  journey?: { time: string; action: string; detail: string }[];
  dealershipId?: string;
}

export interface Task {
  id: string;
  title: string;
  leadId?: string;
  vehicleId?: string;
  assignedUserId: string;
  dueDate: string;
  priority: 'Normal' | 'High' | 'Urgent' | 'Low';
  status: 'Pending' | 'In Progress' | 'Completed';
  dealershipId?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  leadId: string;
  vehicleId: string;
  amount: number;
  paymentMethod: string;
  status: 'Sent' | 'Paid' | 'Overdue';
  dueDate: string;
  additionalCharges?: number;
  chargeDescription?: string;
  dealershipId?: string;
}

export interface Agreement {
  id: string;
  agreementNumber: string;
  leadId: string;
  vehicleId: string;
  purchasePrice: number;
  depositAmount: number;
  type: 'Vehicle Sale' | 'Deposit Hold' | 'Trade-In Transfer' | 'Offer to Purchase' | 'Finance Application';
  status: 'Pending Signature' | 'Signed' | 'Completed';
  signature?: string;
  signedAt?: string;
  signedBy?: string;
  dealershipId?: string;
  date?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'salesperson' | 'manager' | 'admin';
  phone: string;
  isActive: boolean;
  dealershipId?: string;
}

export interface Communication {
  id: string;
  leadId: string;
  type: 'email' | 'sms' | 'whatsapp' | 'call';
  subject: string;
  content: string;
  sentBy: string;
  sentAt: string;
  dealershipId?: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  referenceId?: string; // maps to a vehicle stockNumber or ID
  reconciled: boolean;
  dealershipId?: string;
}

export interface DigitalProduct {
  id: string;
  name: string;
  description: string;
  price: number;
}

export interface DigitalSale {
  id: string;
  productId: string;
  leadId: string;
  saleDate: string;
  amount: number;
  status: 'Pending' | 'Active' | 'Cancelled';
}

export interface DMSState {
  vehicles: Vehicle[];
  leads: Lead[];
  tasks: Task[];
  invoices: Invoice[];
  agreements: Agreement[];
  users: User[];
  communications: Communication[];
  expenses: Expense[];
  dealerships: Dealership[];
  digitalProducts: DigitalProduct[];
  digitalSales: DigitalSale[];
  settings?: {
    websitePortal: boolean;
    trueAI: boolean;
    smartLedger: boolean;
    chatbot: boolean;
    liveReceptionist: boolean;
    seoAeo: boolean;
    syndication: boolean;
  };
}
