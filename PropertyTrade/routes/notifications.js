import { Router } from 'express';
import { load, query } from '../lib/persist.js';
import { filterByAgentScope } from '../lib/isolation.js';
import { depositReceiptDeadline, isFicaExpired } from '../lib/sa-rules.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ITEMS = 50;

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

export default function notificationRoutes(dataDir) {
  const r = Router();

  r.get('/api/notifications', (req, res) => {
    const today = todayStr();
    const in30 = addDaysStr(30);
    const items = [];
    const seen = new Set();

    function push(severity, type, title, sub, entityId, date) {
      const key = `${type}:${entityId}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push({ type, title, sub, entityId, date, severity });
    }

    let leases = query(dataDir, 'leases', req.agencyId, l => l.status === 'active');
    leases = filterByAgentScope(req, leases);

    for (const lease of leases) {
      const prop = load(dataDir, 'properties', lease.propertyId);
      const tenant = load(dataDir, 'tenants', lease.tenantId);
      const address = prop?.address || lease.propertyId;
      const tenantName = nameOf(tenant);

      if (lease.endDate && lease.endDate >= today && lease.endDate <= in30) {
        push(3, 'lease-expiry', 'Lease ending soon',
          `${address} · ${tenantName} · ${lease.endDate}`, lease.id, lease.endDate);
      }

      const unpaid = query(dataDir, 'payments', req.agencyId, p =>
        p.leaseId === lease.id && p.dueDate && p.dueDate < today && p.status !== 'received'
      );
      if (unpaid.length) {
        const outstanding = unpaid.reduce((s, p) => s + (p.amountZAR || 0), 0);
        const latestDue = unpaid.map(p => p.dueDate).sort().pop();
        push(1, 'arrears', 'Rent overdue',
          `${address} · ${tenantName} · R ${outstanding.toFixed(2)}`, lease.id, latestDue);
      }

      if (lease.depositPaidDate && !lease.depositReceiptSentDate) {
        const deadline = depositReceiptDeadline(lease.depositPaidDate);
        if (deadline && deadline < today) {
          push(1, 'deposit-overdue', 'Deposit receipt overdue',
            `${address} · ${tenantName} · due ${deadline}`, lease.id, deadline);
        }
      }
    }

    let maintenance = query(dataDir, 'maintenance', req.agencyId, m =>
      m.priority === 'urgent' && m.status !== 'resolved' && m.status !== 'closed'
    );
    maintenance = filterByAgentScope(req, maintenance);
    for (const m of maintenance) {
      const prop = load(dataDir, 'properties', m.propertyId);
      push(2, 'maintenance-urgent', 'Urgent maintenance',
        `${prop?.address || m.propertyId} · ${m.description || ''}`,
        m.id, m.reportedDate || m.createdAt.slice(0, 10));
    }

    const tenants = query(dataDir, 'tenants', req.agencyId, t => {
      if (!t.ficaStatus) return false;
      return t.ficaStatus === 'expired' ||
        (t.ficaSubmittedAt && isFicaExpired(t.ficaSubmittedAt));
    });
    for (const t of tenants) {
      push(4, 'fica', 'FICA expiring',
        `${nameOf(t)} · ${t.ficaStatus}`, t.id, t.ficaSubmittedAt || '');
    }

    items.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity - b.severity;
      if (!a.date || !b.date) return a.date ? -1 : b.date ? 1 : 0;
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });

    const clean = items.slice(0, MAX_ITEMS).map(({ severity, ...item }) => item);
    res.json({ items: clean });
  });

  return r;
}
