const DAY_MS = 24 * 60 * 60 * 1000;

export function formatZAR(cents) {
  const rands = Math.abs(cents) / 100;
  const formatted = rands.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `R ${cents < 0 ? '-' : ''}${formatted}`;
}

export function formatDateSA(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function depositReceiptDeadline(depositPaidDate) {
  if (!depositPaidDate) return null;
  return new Date(new Date(depositPaidDate).getTime() + 14 * DAY_MS).toISOString().slice(0, 10);
}

export function isDepositReceiptOverdue(lease) {
  if (!lease.depositPaidDate || lease.depositReceiptSentDate) return false;
  const deadline = depositReceiptDeadline(lease.depositPaidDate);
  return new Date().toISOString().slice(0, 10) > deadline;
}

export function depositRefundDeadline(moveOutDate) {
  if (!moveOutDate) return null;
  return new Date(new Date(moveOutDate).getTime() + 14 * DAY_MS).toISOString().slice(0, 10);
}

export function isDepositRefundOverdue(lease) {
  if (!lease.moveOutDate || lease.status !== 'terminated') return false;
  const deadline = depositRefundDeadline(lease.moveOutDate);
  return new Date().toISOString().slice(0, 10) > deadline;
}

export function leaseAnniversaryDue(lease) {
  if (lease.status !== 'active' || !lease.startDate) return false;
  const start = new Date(lease.startDate);
  const now = new Date();
  const nextAnniv = new Date(start);
  nextAnniv.setFullYear(now.getFullYear());
  if (nextAnniv < now) nextAnniv.setFullYear(now.getFullYear() + 1);
  const daysUntil = (nextAnniv - now) / DAY_MS;
  return daysUntil <= 60 && daysUntil > 0;
}

export function escalatedRent(monthlyRentZAR, annualEscalation) {
  return Math.round(monthlyRentZAR * (1 + annualEscalation / 100));
}

export function isFicaExpired(ficaSubmittedAt) {
  if (!ficaSubmittedAt) return false;
  const months = (Date.now() - new Date(ficaSubmittedAt).getTime()) / (30 * DAY_MS);
  return months > 24;
}

export function isMandateExpiring(mandate) {
  if (mandate.status !== 'active' || !mandate.endDate) return false;
  const daysUntil = (new Date(mandate.endDate) - new Date()) / DAY_MS;
  return daysUntil <= 30 && daysUntil > 0;
}

export function isOfferExpired(offer) {
  if (offer.status !== 'submitted' && offer.status !== 'countered') return false;
  if (!offer.validUntil) return false;
  return new Date().toISOString().slice(0, 10) > offer.validUntil;
}

export function leaseExpiringWithin(lease, days) {
  if (lease.status !== 'active' || !lease.endDate) return false;
  const daysUntil = (new Date(lease.endDate) - new Date()) / DAY_MS;
  return daysUntil <= days && daysUntil > 0;
}

const SA_VAT_RATE = 0.15;

export function calculateSaleCommission(salePriceZAR, commissionPercent, vatRegistered) {
  const gross = Math.round(salePriceZAR * commissionPercent / 100);
  const vat = vatRegistered ? Math.round(gross * SA_VAT_RATE) : 0;
  return { grossAmountZAR: gross, vatAmountZAR: vat, netAmountZAR: gross - vat };
}

export function calculateRentalCommission(monthlyRentZAR, commissionPercent, vatRegistered) {
  const gross = Math.round(monthlyRentZAR * commissionPercent / 100);
  const vat = vatRegistered ? Math.round(gross * SA_VAT_RATE) : 0;
  return { grossAmountZAR: gross, vatAmountZAR: vat, netAmountZAR: gross - vat };
}

export function splitCommission(netAmountZAR, splits) {
  let allocated = 0;
  const result = splits.map(s => {
    const amount = Math.round(netAmountZAR * s.percent / 100);
    allocated += amount;
    return { ...s, amountZAR: amount };
  });
  return { splits: result, agencyRetainedZAR: netAmountZAR - allocated };
}
