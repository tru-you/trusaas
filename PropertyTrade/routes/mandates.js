import { Router } from 'express';
import { save, load, query } from '../lib/persist.js';
import { newId } from '../lib/id.js';
import { agentCanAccessProperty, filterByAgentScope } from '../lib/isolation.js';
import { sanitizeString, sanitizeNumber, isValidEnum, ENUMS } from '../lib/validate.js';

const TYPE = 'mandates';

export default function mandateRoutes(dataDir) {
  const r = Router();

  r.get('/api/mandates', (req, res) => {
    const { status, propertyId } = req.query;
    let items = query(dataDir, TYPE, req.agencyId, (m) => {
      if (status && m.status !== status) return false;
      if (propertyId && m.propertyId !== propertyId) return false;
      return true;
    });
    items = filterByAgentScope(req, items);
    res.json(items);
  });

  r.get('/api/mandates/:id', (req, res) => {
    const item = load(dataDir, TYPE, req.params.id);
    if (!item || item.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    res.json(item);
  });

  r.post('/api/mandates', (req, res) => {
    const b = req.body || {};
    if (!b.propertyId || !b.ownerId) return res.status(400).json({ error: 'propertyId and ownerId required.' });
    const id = newId('mandate');
    const item = {
      id,
      agencyId: req.agencyId,
      propertyId: b.propertyId,
      ownerId: b.ownerId,
      type: isValidEnum(b.type, ENUMS.MANDATE_TYPES) ? b.type : 'sole',
      startDate: b.startDate || new Date().toISOString().slice(0, 10),
      endDate: b.endDate || null,
      askingPriceZAR: sanitizeNumber(b.askingPriceZAR),
      commissionPercent: sanitizeNumber(b.commissionPercent, 5),
      commissionVAT: !!b.commissionVAT,
      status: isValidEnum(b.status, ENUMS.MANDATE_STATUSES) ? b.status : 'active',
      mandateDocumentId: b.mandateDocumentId || null,
      notes: sanitizeString(b.notes, 2000),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    save(dataDir, TYPE, id, item);
    res.status(201).json(item);
  });

  r.put('/api/mandates/:id', (req, res) => {
    const existing = load(dataDir, TYPE, req.params.id);
    if (!existing || existing.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    const b = req.body || {};
    for (const f of ['type', 'startDate', 'endDate', 'askingPriceZAR', 'commissionPercent', 'commissionVAT', 'status', 'mandateDocumentId', 'notes']) {
      if (b[f] !== undefined) existing[f] = b[f];
    }
    existing.updatedAt = new Date().toISOString();
    save(dataDir, TYPE, existing.id, existing);
    res.json(existing);
  });

  return r;
}
