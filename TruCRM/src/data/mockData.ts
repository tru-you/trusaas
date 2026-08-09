import {
  Deal,
  Contact,
  Transaction,
  Invoice,
  WorkflowRule,
  BusinessProfile,
  Proposal,
  SlaContract,
} from '../types';

/* ============================================================================
   Seed data is intentionally empty — TruSaaS is a personal workspace, so a
   fresh install starts clean. Each module persists to localStorage and begins
   empty until the user adds their own records.
   ========================================================================== */

export const initialProfile: BusinessProfile = {
  companyName: 'TruSaaS',
  tagline: 'Your personal CRM — deals, projects & money in one place',
  currency: 'R',
  taxRate: 15.0,
  fiscalYearStart: 'March',
  email: 'hello@trusaas.io',
  phone: '+27 00 000 0000',
  address: 'Your street address\nCity, Province',
  regNumber: 'Reg / VAT no.',
  bank: {
    bankName: 'Your bank',
    accountName: 'TruSaaS',
    accountNumber: '0000000000',
    branchCode: '000000',
    swift: 'BIC',
  },
  colorScheme: 'cyan',
};

export const initialDeals: Deal[] = [];
export const initialContacts: Contact[] = [];
export const initialTransactions: Transaction[] = [];
export const initialInvoices: Invoice[] = [];
export const initialWorkflowRules: WorkflowRule[] = [];
export const initialProposals: Proposal[] = [];
export const initialSlaContracts: SlaContract[] = [];
