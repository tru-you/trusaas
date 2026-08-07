import type { DocStage, Lead } from '../types';

/** Fields TruContract's generator must have before a stage can be finalised.
 *
 *  Only enforced when the doc's `mode === 'generate'` — for `mode === 'attach'`
 *  the dealer's own uploaded document is authoritative and we cannot inspect
 *  its contents to validate. */
const REQUIRED_FIELDS: Record<DocStage, readonly string[]> = {
  proforma: ['vin', 'priceBreakdown', 'validityWindow'],
  deed: ['voetstootsClause', 'tradeInLine'], // ncaDisclosure added conditionally below
  compliance: ['rwcRef', 'rwcDate', 'natisMatch'],
  invoice: ['invoiceNo', 'vatBreakdown', 'vin'], // buyerAddress added conditionally below
  handover: ['warrantyDoc', 'natisUpdated'],
};

export interface CanAdvanceResult {
  ok: boolean;
  missing: string[];
}

/** Given a stage + the field snapshot the generator would use, decide whether
 *  the doc has enough to be finalised. Conditional fields (NCA for financed
 *  deals, buyer address for high-value invoices) are added here rather than
 *  hardcoded into the schema so a paid-cash R4,000 sale does not demand
 *  fields it doesn't need. */
export function canAdvance(
  stage: DocStage,
  snapshot: Record<string, unknown>,
  lead?: Pick<Lead, 'dealChecklist'>,
): CanAdvanceResult {
  const required = [...REQUIRED_FIELDS[stage]];

  if (stage === 'deed') {
    const financeStatus = lead?.dealChecklist?.financeStatus;
    // Anything other than 'N/A' or undefined implies finance is in play,
    // which triggers the NCA disclosure requirement.
    if (financeStatus && financeStatus !== 'N/A') {
      required.push('ncaDisclosure');
    }
  }

  if (stage === 'invoice') {
    const totalRaw = snapshot['total'] ?? snapshot['amount'];
    const total = typeof totalRaw === 'number' ? totalRaw : Number(totalRaw ?? 0);
    if (Number.isFinite(total) && total > 5000) {
      required.push('buyerAddress');
    }
  }

  const missing = required.filter((field) => {
    const value = snapshot[field];
    if (value === undefined || value === null) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (typeof value === 'boolean') return value === false;
    return false;
  });

  return { ok: missing.length === 0, missing };
}
