import { Router } from 'express';
import { save, load, query } from '../lib/persist.js';
import { newId } from '../lib/id.js';
import { requireRole, agentCanAccessProperty, filterByAgentScope } from '../lib/isolation.js';
import { sanitizeString, sanitizeNumber, isValidEnum, ENUMS } from '../lib/validate.js';

const TYPE = 'payments';

export default function paymentRoutes(dataDir) {
  const r = Router();

  r.get('/api/payments', (req, res) => {
    const { month, status, propertyId } = req.query;
    let items = query(dataDir, TYPE, req.agencyId, (p) => {
      if (propertyId && p.propertyId !== propertyId) return false;
      if (status && p.status !== status) return false;
      if (month && p.dueDate && !p.dueDate.startsWith(month)) return false;
      return true;
    });
    items = filterByAgentScope(req, items);
    res.json(items);
  });

  r.post('/api/payments', requireRole('admin','principal','manager'), (req, res) => {
    const b = req.body || {};
    if (!b.leaseId) return res.status(400).json({ error: 'leaseId required.' });

    const lease = load(dataDir, 'leases', b.leaseId);
    if (!lease || lease.agencyId !== req.agencyId) return res.status(404).json({ error: 'Lease not found.' });
    if (!agentCanAccessProperty(req, lease.propertyId)) return res.status(403).json({ error: 'Not assigned.' });

    const id = newId('payment');
    const item = {
      id,
      agencyId: req.agencyId,
      leaseId: b.leaseId,
      propertyId: lease.propertyId,
      tenantId: lease.tenantId,
      amountZAR: sanitizeNumber(b.amountZAR),
      date: b.date || new Date().toISOString().slice(0, 10),
      dueDate: b.dueDate || new Date().toISOString().slice(0, 7),
      method: isValidEnum(b.method, ENUMS.PAYMENT_METHODS) ? b.method : 'eft',
      reference: sanitizeString(b.reference, 100),
      status: isValidEnum(b.status, ENUMS.PAYMENT_STATUSES) ? b.status : 'received',
      recordedBy: req.agentId,
      notes: sanitizeString(b.notes, 500),
      createdAt: new Date().toISOString(),
    };
    save(dataDir, TYPE, id, item);
    res.status(201).json(item);
  });

  r.put('/api/payments/:id', requireRole('admin','principal','manager'), (req, res) => {
    const existing = load(dataDir, TYPE, req.params.id);
    if (!existing || existing.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    const b = req.body || {};
    for (const f of ['amountZAR', 'date', 'dueDate', 'method', 'reference', 'status', 'notes']) {
      if (b[f] !== undefined) existing[f] = b[f];
    }
    save(dataDir, TYPE, existing.id, existing);
    res.json(existing);
  });

  r.get('/api/payments/arrears', (req, res) => {
    const leases = query(dataDir, 'leases', req.agencyId, l => l.status === 'active');
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const arrears = [];
    for (const lease of leases) {
      const payments = query(dataDir, TYPE, req.agencyId, p =>
        p.leaseId === lease.id && p.dueDate === currentMonth && p.status === 'received'
      );
      const paid = payments.reduce((sum, p) => sum + p.amountZAR, 0);
      const due = lease.monthlyRentZAR;
      if (paid < due) {
        const prop = load(dataDir, 'properties', lease.propertyId);
        const tenant = load(dataDir, 'tenants', lease.tenantId);
        arrears.push({
          leaseId: lease.id,
          propertyId: lease.propertyId,
          tenantId: lease.tenantId,
          address: prop?.address || '',
          tenantName: tenant ? `${tenant.firstName} ${tenant.lastName}` : '',
          monthlyRentZAR: due,
          paidZAR: paid,
          outstandingZAR: due - paid,
          month: currentMonth,
        });
      }
    }
    res.json(filterByAgentScope(req, arrears));
  });

  return r;
}
