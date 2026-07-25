// TruCRM — automotive retail CRM domain model.
// Distinct from the generic Deal/Contact model in ../types.ts: a dealership sells a
// specific unit of stock to a specific person, usually against a trade-in and a bank
// approval, and is measured on speed-to-lead rather than deal size.

export type LeadStageId =
  | 'new'
  | 'contacted'
  | 'appointment'
  | 'showed'
  | 'demo'
  | 'writeup'
  | 'finance'
  | 'delivered'
  | 'lost';

export const LEAD_STAGES: { id: LeadStageId; title: string; short: string }[] = [
  { id: 'new', title: 'New Up', short: 'New' },
  { id: 'contacted', title: 'Contacted', short: 'Contacted' },
  { id: 'appointment', title: 'Appointment Set', short: 'Appt' },
  { id: 'showed', title: 'Showed / Walk-in', short: 'Showed' },
  { id: 'demo', title: 'Test Drive', short: 'Demo' },
  { id: 'writeup', title: 'Write-Up / Offer', short: 'Write-Up' },
  { id: 'finance', title: 'F&I / Bank', short: 'F&I' },
  { id: 'delivered', title: 'Delivered', short: 'Delivered' },
  { id: 'lost', title: 'Lost / Dead', short: 'Lost' },
];

/** Stages that count as an open working lead. */
export const OPEN_STAGES: LeadStageId[] = [
  'new',
  'contacted',
  'appointment',
  'showed',
  'demo',
  'writeup',
  'finance',
];

export type LeadSource =
  | 'Website'
  | 'AutoTrader'
  | 'Cars.co.za'
  | 'Facebook'
  | 'WhatsApp'
  | 'Walk-In'
  | 'Phone-In'
  | 'Referral'
  | 'Repeat Customer'
  | 'Service Drive';

export type LeadTemperature = 'Hot' | 'Warm' | 'Cold';

export type BuyerIntent = 'Cash' | 'Finance' | 'Undecided';

export interface VehicleOfInterest {
  stockNumber?: string;
  year: number;
  make: string;
  model: string;
  variant?: string;
  mileage?: number;
  vin?: string;
  askingPrice: number;
  imageUrl?: string;
}

export type TradeInStatus = 'None' | 'Declared' | 'Appraisal Booked' | 'Appraised' | 'Accepted' | 'Declined';

export interface TradeIn {
  status: TradeInStatus;
  year?: number;
  make?: string;
  model?: string;
  mileage?: number;
  /** What the customer thinks it's worth. */
  customerExpectation?: number;
  /** Dealer trade price, set after appraisal. Never shown as final until viewed. */
  appraisedValue?: number;
  /** Outstanding finance to settle on the trade. */
  settlementAmount?: number;
  appraisalNotes?: string;
  /** Set when the appraisal was run through TruValue. */
  truValueRef?: string;
}

export type FinanceStatus =
  | 'Not Started'
  | 'Docs Outstanding'
  | 'Submitted'
  | 'Approved'
  | 'Conditional'
  | 'Declined';

export type Bank = 'WesBank' | 'Absa' | 'MFC (Nedbank)' | 'Standard Bank' | 'Investec' | 'Other';

export interface FinanceApplication {
  status: FinanceStatus;
  bank?: Bank;
  submittedAt?: string;
  decisionAt?: string;
  approvedAmount?: number;
  deposit?: number;
  termMonths?: number;
  balloonPct?: number;
  rate?: number;
  conditions?: string;
  /** FICA / affordability docs still outstanding. */
  outstandingDocs?: string[];
}

export type ActivityChannel = 'call' | 'email' | 'whatsapp' | 'sms' | 'note' | 'appointment' | 'test-drive' | 'stage';

export type CallOutcome = 'connected' | 'voicemail' | 'no-answer' | 'wrong-number' | 'scheduled';

export interface LeadActivity {
  id: string;
  leadId: string;
  channel: ActivityChannel;
  /** Short headline, e.g. "Called — voicemail" */
  summary: string;
  body?: string;
  outcome?: CallOutcome;
  durationMinutes?: number;
  /** ISO timestamp. */
  at: string;
  by: string;
  /** True for the activity that first made contact — used for speed-to-lead. */
  isFirstResponse?: boolean;
}

export interface Appointment {
  id: string;
  leadId: string;
  type: 'Showroom Visit' | 'Test Drive' | 'Trade Appraisal' | 'Delivery' | 'Callback';
  /** ISO timestamp. */
  at: string;
  durationMinutes: number;
  status: 'Booked' | 'Confirmed' | 'Showed' | 'No-Show' | 'Cancelled';
  notes?: string;
}

/** The numbers on the deal sheet. Front gross = vehicle, back gross = F&I products. */
export interface DealSheet {
  vehiclePrice: number;
  discount: number;
  tradeAllowance: number;
  tradeSettlement: number;
  deposit: number;
  /** Value-added products: warranty, service plan, paint protection, tracker. */
  vapsValue: number;
  /** What the unit cost the dealer (stand-in value). */
  costOfSale: number;
}

export interface Lead {
  id: string;
  /** Sequential dealership reference, e.g. "UP-2026-0184". */
  reference: string;
  customerName: string;
  phone: string;
  email?: string;
  city?: string;
  source: LeadSource;
  temperature: LeadTemperature;
  intent: BuyerIntent;
  stage: LeadStageId;
  /** Assigned salesperson id. */
  salespersonId: string;
  vehicle: VehicleOfInterest;
  tradeIn: TradeIn;
  finance: FinanceApplication;
  dealSheet: DealSheet;
  /** ISO timestamp the lead landed. Speed-to-lead is measured from here. */
  createdAt: string;
  /** ISO timestamp of the last outbound touch of any kind. */
  lastContactedAt?: string;
  /** YYYY-MM-DD the next touch is due. Drives the Work Queue. */
  nextFollowUpDate?: string;
  nextFollowUpNote?: string;
  lostReason?: string;
  deliveredAt?: string;
  tags?: string[];
  notes?: string;
}

export interface Salesperson {
  id: string;
  name: string;
  initials: string;
  role: 'Sales Executive' | 'Sales Manager' | 'F&I Manager' | 'Dealer Principal';
  /** Units target for the month. */
  monthlyTarget: number;
  active: boolean;
}

/** Dealership-level settings that change how the CRM behaves. */
export interface DealershipSettings {
  dealershipName: string;
  currency: string;
  /** Minutes. Industry benchmark is 15; leads older than this are flagged. */
  speedToLeadTargetMins: number;
  /** Days between touches while a lead is open. */
  followUpCadenceDays: number[];
  /** Days with no contact before a lead is considered stale. */
  staleAfterDays: number;
}
