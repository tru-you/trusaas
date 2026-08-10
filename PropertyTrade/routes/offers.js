import { Router } from 'express';
import { save, load, query } from '../lib/persist.js';
import { newId } from '../lib/id.js';
import { requireRole, filterByAgentScope } from '../lib/isolation.js';
import { sanitizeString, sanitizeNumber, isValidEnum, ENUMS } from '../lib/validate.js';

const TYPE = 'offers';

export default function offerRoutes(dataDir) {
  const r = Router();

  r.get('/api/offers', (req, res) => {
    const { status, propertyId, buyerId } = req.query;
    let items = query(dataDir, TYPE, req.agencyId, (o) => {
      if (status && o.status !== status) return false;
      if (propertyId && o.propertyId !== propertyId) return false;
      if (buyerId && o.buyerId !== buyerId) return false;
      return true;
    });
    items = filterByAgentScope(req, items);
    res.json(items);
  });

  r.get('/api/offers/:id', (req, res) => {
    const item = load(dataDir, TYPE, req.params.id);
    if (!item || item.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    res.json(item);
  });

  r.post('/api/offers', requireRole('admin','principal','manager'), (req, res) => {
    const b = req.body || {};
    if (!b.propertyId || !b.buyerId) return res.status(400).json({ error: 'propertyId and buyerId required.' });
    const id = newId('offer');
    const item = {
      id,
      agencyId: req.agencyId,
      propertyId: b.propertyId,
      buyerId: b.buyerId,
      mandateId: b.mandateId || null,
      offerAmountZAR: sanitizeNumber(b.offerAmountZAR),
      offerDate: b.offerDate || new Date().toISOString().slice(0, 10),
      conditions: Array.isArray(b.conditions) ? b.conditions.map(c => sanitizeString(c, 200)) : [],
      bondRequired: !!b.bondRequired,
      bondAmount: sanitizeNumber(b.bondAmount),
      bondInstitution: sanitizeString(b.bondInstitution, 100),
      validUntil: b.validUntil || null,
      status: 'submitted',
      counterAmountZAR: null,
      acceptedDate: null,
      rejectedDate: null,
      sellingAgentId: b.sellingAgentId || req.agentId,
      listingAgentId: b.listingAgentId || null,
      notes: sanitizeString(b.notes, 2000),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    save(dataDir, TYPE, id, item);

    const prop = load(dataDir, 'properties', b.propertyId);
    if (prop && prop.agencyId === req.agencyId) {
      prop.salesStatus = 'under-offer';
      prop.updatedAt = new Date().toISOString();
      save(dataDir, 'properties', prop.id, prop);
    }

    res.status(201).json(item);
  });

  r.post('/api/offers/:id/counter', requireRole('admin','principal','manager'), (req, res) => {
    const existing = load(dataDir, TYPE, req.params.id);
    if (!existing || existing.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    existing.status = 'countered';
    existing.counterAmountZAR = sanitizeNumber(req.body?.counterAmountZAR);
    existing.updatedAt = new Date().toISOString();
    save(dataDir, TYPE, existing.id, existing);
    res.json(existing);
  });

  r.post('/api/offers/:id/accept', requireRole('admin','principal','manager'), (req, res) => {
    const existing = load(dataDir, TYPE, req.params.id);
    if (!existing || existing.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    existing.status = 'accepted';
    existing.acceptedDate = new Date().toISOString().slice(0, 10);
    existing.updatedAt = new Date().toISOString();
    save(dataDir, TYPE, existing.id, existing);
    res.json(existing);
  });

  r.post('/api/offers/:id/reject', requireRole('admin','principal','manager'), (req, res) => {
    const existing = load(dataDir, TYPE, req.params.id);
    if (!existing || existing.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    existing.status = 'rejected';
    existing.rejectedDate = new Date().toISOString().slice(0, 10);
    existing.updatedAt = new Date().toISOString();
    save(dataDir, TYPE, existing.id, existing);

    const prop = load(dataDir, 'properties', existing.propertyId);
    if (prop && prop.agencyId === req.agencyId) {
      const otherOffers = query(dataDir, TYPE, req.agencyId, o =>
        o.propertyId === existing.propertyId && o.id !== existing.id &&
        (o.status === 'submitted' || o.status === 'countered')
      );
      if (otherOffers.length === 0) {
        prop.salesStatus = 'available';
        prop.updatedAt = new Date().toISOString();
        save(dataDir, 'properties', prop.id, prop);
      }
    }

    res.json(existing);
  });

  return r;
}
