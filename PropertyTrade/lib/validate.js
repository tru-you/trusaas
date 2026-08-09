export function requireFields(body, fields) {
  const missing = fields.filter(f => !body || body[f] === undefined || body[f] === '');
  if (missing.length) {
    return `Missing required fields: ${missing.join(', ')}`;
  }
  return null;
}

export function sanitizeString(val, maxLen = 500) {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

export function sanitizeNumber(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

export function isValidEnum(val, allowed) {
  return allowed.includes(val);
}

const PROPERTY_TYPES = ['House', 'Flat', 'Townhouse', 'Estate', 'Farm', 'Commercial'];
const PROPERTY_PURPOSES = ['rental', 'sale', 'both'];
const RENTAL_STATUSES = ['vacant', 'occupied', 'maintenance', 'listed'];
const SALES_STATUSES = ['available', 'under-offer', 'sold', 'withdrawn'];
const LEASE_STATUSES = ['draft', 'active', 'expiring', 'expired', 'terminated'];
const PAYMENT_METHODS = ['eft', 'cash', 'debit_order', 'card', 'other'];
const PAYMENT_STATUSES = ['received', 'pending', 'bounced', 'reversed'];
const MAINTENANCE_CATEGORIES = ['plumbing', 'electrical', 'structural', 'appliance', 'pest', 'security', 'garden', 'other'];
const MAINTENANCE_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const MAINTENANCE_STATUSES = ['reported', 'assigned', 'in_progress', 'awaiting_parts', 'resolved', 'closed'];
const FICA_STATUSES = ['pending', 'submitted', 'verified', 'expired'];
const MANDATE_TYPES = ['sole', 'dual', 'open'];
const MANDATE_STATUSES = ['active', 'expired', 'cancelled', 'sold'];
const OFFER_STATUSES = ['submitted', 'countered', 'accepted', 'rejected', 'expired', 'cancelled'];
const SALE_STATUSES = ['pending-transfer', 'registered', 'complete'];
const AGENT_ROLES = ['admin', 'manager', 'agent'];

const INTEREST_STATUSES = ['new', 'contacted', 'viewing_scheduled', 'viewing_done', 'offer_made', 'won', 'lost'];
const INTEREST_SOURCES = ['walk_in', 'referral', 'web', 'portal', 'showroom', 'whatsapp'];
const VIEWING_STATUSES = ['scheduled', 'completed', 'cancelled', 'no_show'];
const VIEWING_RATINGS = ['hot', 'warm', 'cold', 'not_interested'];
const COMMISSION_TYPES = ['sale', 'rental'];
const COMMISSION_SPLIT_ROLES = ['listing', 'selling', 'referral'];
const COMMISSION_SPLIT_STATUSES = ['pending', 'invoiced', 'paid'];

export const ENUMS = {
  PROPERTY_TYPES, PROPERTY_PURPOSES, RENTAL_STATUSES, SALES_STATUSES,
  LEASE_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES,
  MAINTENANCE_CATEGORIES, MAINTENANCE_PRIORITIES, MAINTENANCE_STATUSES,
  FICA_STATUSES, MANDATE_TYPES, MANDATE_STATUSES, OFFER_STATUSES,
  SALE_STATUSES, AGENT_ROLES,
  INTEREST_STATUSES, INTEREST_SOURCES,
  VIEWING_STATUSES, VIEWING_RATINGS,
  COMMISSION_TYPES, COMMISSION_SPLIT_ROLES, COMMISSION_SPLIT_STATUSES,
};
