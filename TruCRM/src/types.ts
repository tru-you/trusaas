export type StageId = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

export interface Deal {
  id: string;
  title: string;
  company: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  value: number;
  stage: StageId;
  probability: number; // 0 - 100
  closeDate: string; // YYYY-MM-DD
  notes?: string;
  healthScore?: number;
  tags?: string[];
  createdAt: string;
}

export interface Contact {
  id: string;
  name: string;
  company: string;
  role: string;
  email: string;
  phone: string;
  status: 'Customer' | 'Lead' | 'Prospect' | 'Inactive';
  totalSpent: number;
  dealsCount: number;
  avatarUrl?: string;
  lastContactDate: string;
}

export type ProjectStatus = 'Planning' | 'In Progress' | 'On Hold' | 'Completed';

export interface Project {
  id: string;
  name: string;
  clientName: string;
  dealId?: string;
  status: ProjectStatus;
  progress: number; // 0 - 100
  budget: number;
  spent: number;
  startDate: string;
  dueDate: string;
  category: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  teamMembers: string[];
}

export type TaskStatus = 'Todo' | 'In Progress' | 'Review' | 'Done';

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  assignee: string;
  priority: 'Low' | 'Medium' | 'High';
  status: TaskStatus;
  dueDate: string;
  estimatedHours: number;
  loggedHours: number;
  category?: string;
}

export type TransactionType = 'Income' | 'Expense';

export interface Transaction {
  id: string;
  type: TransactionType;
  category: string;
  amount: number;
  vendorOrClient: string;
  date: string; // YYYY-MM-DD
  status: 'Reconciled' | 'Pending' | 'Flagged';
  paymentMethod: string;
  receiptUrl?: string;
  notes?: string;
  taxDeductible?: boolean;
}

export type InvoiceStatus = 'Paid' | 'Pending' | 'Overdue' | 'Draft';

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  taxRate: number; // percentage, e.g. 10 for 10%
  notes?: string;
  /** Filled when the client signs via a client signing link. */
  signatureImage?: string;
  signerName?: string;
  signedAt?: string;
}

export interface WorkflowRule {
  id: string;
  name: string;
  triggerEvent: 'deal_won' | 'invoice_overdue' | 'receipt_scanned';
  triggerDescription: string;
  actionType: 'send_email' | 'flag_accounting' | 'create_invoice';
  actionDescription: string;
  enabled: boolean;
  lastTriggered?: string;
}

export type ColorSchemeId = 'cyan' | 'emerald' | 'amber';

export interface BusinessProfile {
  companyName: string;
  tagline: string;
  currency: string; // e.g. '$'
  taxRate: number; // e.g. 10
  fiscalYearStart: string;
  email: string;
  phone?: string;
  address?: string;
  regNumber?: string;
  bank?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    branchCode?: string;
    swift?: string;
  };
  logoUrl?: string;
  colorScheme: ColorSchemeId;
}

export type ProposalStatus = 'Draft' | 'Sent' | 'Accepted' | 'Declined' | 'Expired';

export interface ProposalItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Proposal {
  id: string;
  proposalNumber: string;
  title: string;
  clientName: string;
  company: string;
  clientEmail: string;
  dealId?: string;
  status: ProposalStatus;
  amount: number;
  slaTier: 'Platinum 99.9%' | 'Gold 99.5%' | 'Standard 99.0%' | 'Custom';
  validUntil: string; // YYYY-MM-DD
  createdDate: string; // YYYY-MM-DD
  scopeSummary: string;
  items: ProposalItem[];
  deliverables?: string[];
  signatureStatus?: 'Unsigned' | 'Signed';
  signedDate?: string;
  /** PNG data URL of the drawn signature, and who signed. */
  signatureImage?: string;
  signerName?: string;
}

export interface SlaIncident {
  id: string;
  title: string;
  severity: 'Critical' | 'Major' | 'Minor';
  reportedAt: string;
  resolvedAt?: string;
  responseTimeMinutes: number;
  targetResponseMinutes: number;
  status: 'Open' | 'Investigating' | 'Resolved';
}

export interface SlaContract {
  id: string;
  clientName: string;
  company: string;
  tier: 'Platinum 24/7' | 'Gold 12/5' | 'Standard Business';
  uptimeTarget: number; // e.g. 99.9
  actualUptime: number; // e.g. 99.94
  maxResponseTimeMins: number; // e.g. 15
  avgResponseTimeMins: number; // e.g. 8
  maxResolutionHours: number; // e.g. 4
  status: 'Compliant' | 'At Risk' | 'Breached';
  startDate: string;
  renewalDate: string;
  supportCoverage: string; // e.g. '24/7/365 Phone & Priority Queue'
  monthlyFee: number;
  incidents: SlaIncident[];
  /** Filled when the client signs via a client signing link. */
  signatureImage?: string;
  signerName?: string;
  signedAt?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
  targetId?: string;
  targetType?: 'crm' | 'project' | 'accounting' | 'workflow';
}

