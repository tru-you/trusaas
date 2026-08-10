import { Router } from 'express';
import { load, query } from '../lib/persist.js';
import { filterByAgentScope } from '../lib/isolation.js';
import { depositReceiptDeadline } from '../lib/sa-rules.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ITEMS = 200;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysStr(n) {
  return new Date(Date.now() + n * DAY_MS).toISOString().slice(0, 10);
}

function nameOf(entity, fallback = '') {
  if (!entity) return fallback;
  if (entity.firstName && entity.lastName) return `${entity.firstName} ${entity.lastName}`;
  return entity.name || entity.label || fallback;
}

export default function calendarRoutes(dataDir) {
  const r = Router();

  r.get('/api/calendar', (req, res) => {
    const today = todayStr();
    const in14 = addDaysStr(14);
    const in60 = addDaysStr(60);
    const out60 = addDaysStr(-60);
    const items = [];

    let viewings = query(dataDir, 'viewings', req.agencyId, v =>
      v.status === 'scheduled' && v.scheduledDate >= today && v.scheduledDate <= in60
    );
    viewings = filterByAgentScope(req, viewings);
    for (const v of viewings) {
      const prop = load(dataDir, 'properties', v.propertyId);
      const buyer = load(dataDir, 'buyers', v.buyerId);
      items.push({
        date: v.scheduledDate,
        time: v.scheduledTime || undefined,
        type: 'viewing',
        title: 'Viewing',
        sub: `${nameOf(buyer)} — ${prop?.address || v.propertyId}`,
        entityId: v.id,
      });
    }

    let leases = query(dataDir, 'leases', req.agencyId, l =>
      l.status === 'active' && l.endDate && l.endDate >= today && l.endDate <= in60
    );
    leases = filterByAgentScope(req, leases);
    for (const lease of leases) {
      const prop = load(dataDir, 'properties', lease.propertyId);
      const tenant = load(dataDir, 'tenants', lease.tenantId);
      items.push({
        date: lease.endDate,
        type: 'lease-expiry',
        title: 'Lease ends',
        sub: `${prop?.address || lease.propertyId} · ${nameOf(tenant)}`,
        entityId: lease.id,
      });
    }

    let mandates = query(dataDir, 'mandates', req.agencyId, m =>
      m.status === 'active' && m.endDate && m.endDate >= today && m.endDate <= in60
    );
    mandates = filterByAgentScope(req, mandates);
    for (const m of mandates) {
      const prop = load(dataDir, 'properties', m.propertyId);
      items.push({
        date: m.endDate,
        type: 'mandate-expiry',
        title: 'Mandate ends',
        sub: prop?.address || m.propertyId,
        entityId: m.id,
      });
    }

    let offers = query(dataDir, 'offers', req.agencyId, o =>
      (o.status === 'submitted' || o.status === 'countered') &&
      o.validUntil && o.validUntil >= today && o.validUntil <= in60
    );
    offers = filterByAgentScope(req, offers);
    for (const o of offers) {
      const prop = load(dataDir, 'properties', o.propertyId);
      const buyer = load(dataDir, 'buyers', o.buyerId);
      items.push({
        date: o.validUntil,
        type: 'offer-expiry',
        title: 'Offer expires',
        sub: `${nameOf(buyer)} — ${prop?.address || o.propertyId}`,
        entityId: o.id,
      });
    }

    let maintenance = query(dataDir, 'maintenance', req.agencyId, m =>
      m.status !== 'resolved' && m.status !== 'closed' &&
      m.createdAt && m.createdAt.slice(0, 10) >= out60 && m.createdAt.slice(0, 10) <= in60
    );
    maintenance = filterByAgentScope(req, maintenance);
    for (const m of maintenance) {
      const prop = load(dataDir, 'properties', m.propertyId);
      items.push({
        date: m.scheduledDate || m.createdAt.slice(0, 10),
        type: 'maintenance',
        title: 'Maintenance',
        sub: `${m.description || ''} — ${prop?.address || m.propertyId}`,
        entityId: m.id,
      });
    }

    let leasesForDeposits = query(dataDir, 'leases', req.agencyId, l =>
      l.depositPaidDate && !l.depositReceiptSentDate
    );
    leasesForDeposits = filterByAgentScope(req, leasesForDeposits);
    for (const lease of leasesForDeposits) {
      const deadline = depositReceiptDeadline(lease.depositPaidDate);
      if (!deadline || deadline < today || deadline > in14) continue;
      const prop = load(dataDir, 'properties', lease.propertyId);
      const tenant = load(dataDir, 'tenants', lease.tenantId);
      items.push({
        date: deadline,
        type: 'deposit-deadline',
        title: 'Deposit receipt due',
        sub: `${prop?.address || lease.propertyId} · ${nameOf(tenant)}`,
        entityId: lease.id,
      });
    }

    items.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      const at = a.time || '';
      const bt = b.time || '';
      if (at !== bt) return at < bt ? -1 : 1;
      return a.type < b.type ? -1 : a.type > b.type ? 1 : 0;
    });

    res.json(items.slice(0, MAX_ITEMS));
  });

  return r;
}
