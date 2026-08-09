import { Router } from 'express';
import { save, load, query } from '../lib/persist.js';
import { newId } from '../lib/id.js';
import { sanitizeString, sanitizeNumber } from '../lib/validate.js';

const TYPE = 'owners';

export default function ownerRoutes(dataDir) {
  const r = Router();

  r.get('/api/owners', (req, res) => {
    const items = query(dataDir, TYPE, req.agencyId);
    res.json(items);
  });

  r.get('/api/owners/:id', (req, res) => {
    const item = load(dataDir, TYPE, req.params.id);
    if (!item || item.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    const properties = query(dataDir, 'properties', req.agencyId, p => p.ownerId === item.id);
    res.json({ ...item, properties });
  });

  r.post('/api/owners', (req, res) => {
    const b = req.body || {};
    const id = newId('owner');
    const item = {
      id,
      agencyId: req.agencyId,
      name: sanitizeString(b.name, 200),
      email: sanitizeString(b.email, 200),
      phone: sanitizeString(b.phone, 20),
      whatsapp: sanitizeString(b.whatsapp, 20),
      idNumber: sanitizeString(b.idNumber, 20),
      bankName: sanitizeString(b.bankName, 100),
      bankAccount: sanitizeString(b.bankAccount, 30),
      bankBranch: sanitizeString(b.bankBranch, 50),
      taxNumber: sanitizeString(b.taxNumber, 20),
      propertyIds: Array.isArray(b.propertyIds) ? b.propertyIds : [],
      commissionPercent: sanitizeNumber(b.commissionPercent, 10),
      notes: sanitizeString(b.notes, 2000),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    save(dataDir, TYPE, id, item);
    res.status(201).json(item);
  });

  r.put('/api/owners/:id', (req, res) => {
    const existing = load(dataDir, TYPE, req.params.id);
    if (!existing || existing.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    const b = req.body || {};
    for (const f of ['name', 'email', 'phone', 'whatsapp', 'idNumber', 'bankName', 'bankAccount', 'bankBranch', 'taxNumber', 'propertyIds', 'commissionPercent', 'notes']) {
      if (b[f] !== undefined) existing[f] = b[f];
    }
    existing.updatedAt = new Date().toISOString();
    save(dataDir, TYPE, existing.id, existing);
    res.json(existing);
  });

  return r;
}
