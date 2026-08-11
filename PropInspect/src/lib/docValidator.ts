import type { DocStage, Enquiry } from '../types';

/** Fields DocHub's generator must have before a stage can be finalised.
 *
 *  Only enforced when the doc's `mode === 'generate'` — for `mode === 'attach'`
 *  the agency's own uploaded document is authoritative and we cannot inspect
 *  its contents to validate.
 *
 *  Note what is NOT here: the offer to purchase used to require a
 *  `voetstootsClause`. A blanket "sold as is" does not survive a agency sale to
 *  a consumer — the CPA gives the buyer a right to goods of good quality (s55)
 *  and an implied warranty (s56) that a seller in the ordinary course of
 *  business cannot contract out of. What the CPA does allow is excluding a
 *  SPECIFIC defect the buyer was expressly told about and accepted (s55(6)),
   *  so the offer requires `disclosedDefects` instead — the actual findings from
   *  the property's inspection record, shown to the buyer before they sign, rather
   *  than a catch-all clause that would not hold. */
const REQUIRED_FIELDS: Record<DocStage, readonly string[]> = {
  offer: ['erfRef', 'priceBreakdown', 'validityWindow'],
  /* transfer is the binding Offer to Purchase — it needs the property's
     identity and the disclosed defects; there is no vehicle trade-in line. */
  transfer: ['disclosedDefects', 'erfRef'], // ncaDisclosure added conditionally below
  /* Property compliance = the electrical CoC (ref + issue date) plus the
     beetle / wood-borer clearance mortgage lenders ask for. No roadworthy
     certificate or NATIS in a property sale. */
  compliance: ['electricalCocRef', 'electricalCocDate', 'beetleClearance'],
  invoice: ['invoiceNo', 'vatBreakdown', 'erfRef'], // buyerAddress added conditionally below
  /* Handover = occupation certificate + confirmation the transfer registered
     at the Deeds Office. No vehicle warranty or NATIS here. */
  occupation: ['occupationCertificate', 'transferRegistered'],
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
  Enquiry?: Pick<Enquiry, 'dealChecklist'>,
): CanAdvanceResult {
  const required = [...REQUIRED_FIELDS[stage]];

  if (stage === 'transfer') {
    const financeStatus = Enquiry?.dealChecklist?.financeStatus;
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
    /* An empty array counts as present — but only because the generator fills
       `disclosedDefects` from the property's inspection record, so `[]` means "we
       looked and found none", not "nobody checked". Absent still fails, which
       is the case where the inspection was never done. Keeping those two apart is
       the whole point of disclosing specific defects rather than relying on a
       blanket clause. */
    return false;
  });

  return { ok: missing.length === 0, missing };
}
