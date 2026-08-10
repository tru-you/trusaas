import { Router } from 'express';
import { save, load, query } from '../lib/persist.js';
import { newId } from '../lib/id.js';
import { requireRole, filterByAgentScope } from '../lib/isolation.js';
import { sanitizeString, sanitizeNumber, isValidEnum, ENUMS } from '../lib/validate.js';

const TYPE = 'sales';

export default function saleRoutes(dataDir) {
  const r = Router();

  r.get('/api/sales', (req, res) => {
    const { status } = req.query;
    let items = query(dataDir, TYPE, req.agencyId, (s) => {
      if (status && s.status !== status) return false;
      return true;
    });
    items = filterByAgentScope(req, items);
    res.json(items);
  });

  r.get('/api/sales/:id', (req, res) => {
    const item = load(dataDir, TYPE, req.params.id);
    if (!item || item.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    res.json(item);
  });

  r.post('/api/sales', requireRole('admin','principal','manager'), (req, res) => {
    const b = req.body || {};
    if (!b.propertyId || !b.buyerId || !b.offerId) {
      return res.status(400).json({ error: 'propertyId, buyerId, and offerId required.' });
    }
    const id = newId('sale');
    const item = {
      id,
      agencyId: req.agencyId,
      propertyId: b.propertyId,
      buyerId: b.buyerId,
      mandateId: b.mandateId || null,
      offerId: b.offerId,
      salePriceZAR: sanitizeNumber(b.salePriceZAR),
      saleDate: b.saleDate || new Date().toISOString().slice(0, 10),
      commissionZAR: sanitizeNumber(b.commissionZAR),
      commissionPaidDate: b.commissionPaidDate || null,
      transferDate: b.transferDate || null,
      conveyancer: sanitizeString(b.conveyancer, 200),
      conveyancerPhone: sanitizeString(b.conveyancerPhone, 20),
      bondRegistered: !!b.bondRegistered,
      bondInstitution: sanitizeString(b.bondInstitution, 100),
      status: isValidEnum(b.status, ENUMS.SALE_STATUSES) ? b.status : 'pending-transfer',
      notes: sanitizeString(b.notes, 2000),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    save(dataDir, TYPE, id, item);

    const prop = load(dataDir, 'properties', b.propertyId);
    if (prop && prop.agencyId === req.agencyId) {
      prop.salesStatus = 'sold';
      prop.updatedAt = new Date().toISOString();
      save(dataDir, 'properties', prop.id, prop);
    }

    res.status(201).json(item);
  });

  r.put('/api/sales/:id', requireRole('admin','principal','manager'), (req, res) => {
    const existing = load(dataDir, TYPE, req.params.id);
    if (!existing || existing.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    const b = req.body || {};
    for (const f of ['salePriceZAR', 'saleDate', 'commissionZAR', 'commissionPaidDate', 'transferDate', 'conveyancer', 'conveyancerPhone', 'bondRegistered', 'bondInstitution', 'status', 'notes']) {
      if (b[f] !== undefined) existing[f] = b[f];
    }
    existing.updatedAt = new Date().toISOString();
    save(dataDir, TYPE, existing.id, existing);
    res.json(existing);
  });

  return r;
}
