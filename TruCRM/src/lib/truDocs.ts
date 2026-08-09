import { BusinessProfile, Invoice, Proposal, SlaContract } from '../types';

// Bridges the CRM records to the standalone TruDocs document editor
// (public/tru-docs.html). We prefill its localStorage state, then open the
// page — the user can still edit everything, add signatures and print/PDF.

const TRUDOCS_KEY = 'trudocs_v1';

export interface TruDocsRow {
  desc: string;
  qty: string;
  price: string;
  commit: string;
  target: string;
}

export interface TruDocsState {
  mode: 'quote' | 'invoice' | 'sla';
  vat: string;
  fields: Record<string, string>;
  rows: TruDocsRow[];
  sig: Record<string, string>;
}

const today = () => new Date().toISOString().split('T')[0];

function bizFields(p: BusinessProfile): Record<string, string> {
  return {
    bizName: p.companyName,
    bizReg: p.regNumber || '',
    bizAddr: [p.address, p.phone, p.email].filter(Boolean).join('\n'),
  };
}

function bankBlock(p: BusinessProfile): string {
  const b = p.bank || {};
  return [
    b.bankName || 'Your bank',
    `Account name · ${b.accountName || p.companyName}`,
    `Account no. · ${b.accountNumber || '—'}`,
    `Branch · ${b.branchCode || '—'}`,
  ].join('\n');
}

export function openTruDocs(state: TruDocsState, currency: string) {
  try {
    localStorage.setItem(TRUDOCS_KEY, JSON.stringify(state));
  } catch {
    // storage may be unavailable (private mode) — the page still opens blank
  }
  window.open(`/tru-docs.html?cur=${encodeURIComponent(currency || 'R')}`, '_blank');
}

export function invoiceToTruDocs(inv: Invoice, p: BusinessProfile): TruDocsState {
  return {
    mode: 'invoice',
    vat: String(inv.taxRate ?? p.taxRate ?? 15),
    fields: {
      ...bizFields(p),
      docNo: inv.invoiceNumber,
      docDate: inv.issueDate,
      dueDate: inv.dueDate,
      clientName: inv.clientName,
      clientAddr: inv.clientEmail,
      ref: '',
      vehicle: '',
      scope: '',
      bank: bankBlock(p),
      notes: inv.notes || 'Payment due on the due date above. Thank you for your business.',
      signAName: '',
      signADate: today(),
      signBName: '',
      signBDate: today(),
    },
    rows: (inv.items || []).map((i) => ({
      desc: i.description,
      qty: String(i.quantity),
      price: String(i.unitPrice),
      commit: '',
      target: '',
    })),
    sig: {},
  };
}

export function proposalToTruDocs(pr: Proposal, p: BusinessProfile): TruDocsState {
  return {
    mode: 'quote',
    vat: String(p.taxRate ?? 15),
    fields: {
      ...bizFields(p),
      docNo: pr.proposalNumber,
      docDate: pr.createdDate,
      dueDate: pr.validUntil,
      clientName: pr.company || pr.clientName,
      clientAddr: pr.clientEmail,
      ref: pr.dealId ? `Deal ${pr.dealId}` : '',
      vehicle: pr.title,
      scope: pr.scopeSummary,
      bank: bankBlock(p),
      notes: '',
      signAName: '',
      signADate: today(),
      signBName: pr.signerName || '',
      signBDate: pr.signedDate || today(),
    },
    rows: (pr.items || []).map((i) => ({
      desc: i.description,
      qty: String(i.quantity),
      price: String(i.unitPrice),
      commit: '',
      target: '',
    })),
    sig: pr.signatureImage ? { a: '', b: pr.signatureImage } : {},
  };
}

export function slaToTruDocs(sla: SlaContract, p: BusinessProfile): TruDocsState {
  const rows: TruDocsRow[] = [
    {
      desc: sla.supportCoverage,
      qty: '',
      price: '',
      commit: `${sla.uptimeTarget}% uptime`,
      target: `${sla.maxResponseTimeMins} min response`,
    },
    {
      desc: sla.tier,
      qty: '',
      price: '',
      commit: `${sla.maxResolutionHours} hr resolution`,
      target: sla.monthlyFee ? `${p.currency}${sla.monthlyFee.toLocaleString()}/mo` : '',
    },
  ];
  return {
    mode: 'sla',
    vat: String(p.taxRate ?? 15),
    fields: {
      ...bizFields(p),
      docNo: `SLA-${sla.startDate.slice(0, 4)}-001`,
      docDate: sla.startDate,
      dueDate: sla.renewalDate,
      clientName: sla.company || sla.clientName,
      clientAddr: '',
      ref: '',
      vehicle: sla.tier,
      scope: `${sla.tier} tier\nUptime target · ${sla.uptimeTarget}%\nResponse · within ${sla.maxResponseTimeMins} minutes\nResolution · within ${sla.maxResolutionHours} hours\nCoverage · ${sla.supportCoverage}`,
      bank: [p.companyName, p.email, p.phone].filter(Boolean).join('\n'),
      notes: '',
      signAName: '',
      signADate: today(),
      signBName: '',
      signBDate: today(),
    },
    rows,
    sig: {},
  };
}
