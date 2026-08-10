import { Router } from 'express';
import { save, load, query } from '../lib/persist.js';
import { newId } from '../lib/id.js';
import { requireRole, agentCanAccessProperty, filterByAgentScope } from '../lib/isolation.js';
import { sanitizeString, sanitizeNumber, isValidEnum, ENUMS } from '../lib/validate.js';
import { isDepositReceiptOverdue, isDepositRefundOverdue, leaseExpiringWithin } from '../lib/sa-rules.js';
import { paginate } from '../lib/paginate.js';
import { recordAudit } from '../lib/audit.js';

const TYPE = 'leases';

export default function leaseRoutes(dataDir) {
  const r = Router();

  r.get('/api/leases', (req, res) => {
    const { status, expiring, propertyId } = req.query;
    let items = query(dataDir, TYPE, req.agencyId, (l) => {
      if (status && l.status !== status) return false;
      if (propertyId && l.propertyId !== propertyId) return false;
      if (expiring === 'true' && !leaseExpiringWithin(l, 60)) return false;
      return true;
    });
    items = filterByAgentScope(req, items);
    const rows = items.map(l => ({
      ...l,
      depositReceiptOverdue: isDepositReceiptOverdue(l),
      depositRefundOverdue: isDepositRefundOverdue(l),
    }));
    res.json(paginate(req, res, rows));
  });

  r.get('/api/leases/:id', (req, res) => {
    const item = load(dataDir, TYPE, req.params.id);
    if (!item || item.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    if (!agentCanAccessProperty(req, item.propertyId)) return res.status(403).json({ error: 'Not assigned.' });
    res.json({
      ...item,
      depositReceiptOverdue: isDepositReceiptOverdue(item),
      depositRefundOverdue: isDepositRefundOverdue(item),
    });
  });

  r.post('/api/leases', requireRole('admin','principal','manager'), (req, res) => {
    const b = req.body || {};
    if (!b.propertyId || !b.tenantId) return res.status(400).json({ error: 'propertyId and tenantId required.' });

    const prop = load(dataDir, 'properties', b.propertyId);
    if (!prop || prop.agencyId !== req.agencyId) return res.status(404).json({ error: 'Property not found.' });

    const id = newId('lease');
    const item = {
      id,
      agencyId: req.agencyId,
      propertyId: b.propertyId,
      tenantId: b.tenantId,
      startDate: b.startDate || null,
      endDate: b.endDate || null,
      monthlyRentZAR: sanitizeNumber(b.monthlyRentZAR || prop.monthlyRentZAR),
      annualEscalation: sanitizeNumber(b.annualEscalation, 8),
      depositZAR: sanitizeNumber(b.depositZAR || prop.depositZAR),
      depositBankName: sanitizeString(b.depositBankName, 100),
      depositAccountNumber: sanitizeString(b.depositAccountNumber, 30),
      depositPaidDate: b.depositPaidDate || null,
      depositReceiptSentDate: b.depositReceiptSentDate || null,
      status: isValidEnum(b.status, ENUMS.LEASE_STATUSES) ? b.status : 'draft',
      terminationReason: null,
      moveInDate: b.moveInDate || null,
      moveOutDate: null,
      leaseDocumentId: b.leaseDocumentId || null,
      notes: sanitizeString(b.notes, 2000),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    save(dataDir, TYPE, id, item);

    prop.currentLeaseId = id;
    prop.currentTenantId = b.tenantId;
    if (item.status === 'active') prop.rentalStatus = 'occupied';
    prop.updatedAt = new Date().toISOString();
    save(dataDir, 'properties', prop.id, prop);

    recordAudit(dataDir, { agentId: req.agentId, agencyId: req.agencyId, action: 'create', entityType: 'lease', entityId: id });
    res.status(201).json(item);
  });

  r.put('/api/leases/:id', requireRole('admin','principal','manager'), (req, res) => {
    const existing = load(dataDir, TYPE, req.params.id);
    if (!existing || existing.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    const b = req.body || {};
    const fields = [
      'startDate', 'endDate', 'monthlyRentZAR', 'annualEscalation',
      'depositZAR', 'depositBankName', 'depositAccountNumber',
      'depositPaidDate', 'depositReceiptSentDate', 'status',
      'moveInDate', 'moveOutDate', 'leaseDocumentId', 'notes',
    ];
    for (const f of fields) {
      if (b[f] !== undefined) existing[f] = b[f];
    }
    existing.updatedAt = new Date().toISOString();
    save(dataDir, TYPE, existing.id, existing);
    recordAudit(dataDir, { agentId: req.agentId, agencyId: req.agencyId, action: 'update', entityType: 'lease', entityId: existing.id });
    res.json(existing);
  });

  r.post('/api/leases/:id/terminate', requireRole('admin','principal','manager'), (req, res) => {
    const existing = load(dataDir, TYPE, req.params.id);
    if (!existing || existing.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    existing.status = 'terminated';
    existing.terminationReason = sanitizeString(req.body?.reason, 500);
    existing.moveOutDate = req.body?.moveOutDate || new Date().toISOString().slice(0, 10);
    existing.updatedAt = new Date().toISOString();
    save(dataDir, TYPE, existing.id, existing);

    const prop = load(dataDir, 'properties', existing.propertyId);
    if (prop && prop.agencyId === req.agencyId) {
      prop.rentalStatus = 'vacant';
      prop.currentLeaseId = null;
      prop.currentTenantId = null;
      prop.updatedAt = new Date().toISOString();
      save(dataDir, 'properties', prop.id, prop);
    }

    recordAudit(dataDir, { agentId: req.agentId, agencyId: req.agencyId, action: 'terminate', entityType: 'lease', entityId: existing.id });
    res.json(existing);
  });

  return r;
}
