import { Router } from 'express';
import { save, load, query } from '../lib/persist.js';
import { newId } from '../lib/id.js';
import { requireRole } from '../lib/isolation.js';
import { sanitizeString, sanitizeNumber, isValidEnum, ENUMS } from '../lib/validate.js';

const TYPE = 'buyers';

export default function buyerRoutes(dataDir) {
  const r = Router();

  r.get('/api/buyers', (req, res) => {
    const { search } = req.query;
    const items = query(dataDir, TYPE, req.agencyId, (b) => {
      if (search) {
        const s = search.toLowerCase();
        if (!`${b.firstName} ${b.lastName} ${b.email || ''} ${b.phone || ''}`.toLowerCase().includes(s)) return false;
      }
      return true;
    });
    res.json(items);
  });

  r.get('/api/buyers/:id', (req, res) => {
    const item = load(dataDir, TYPE, req.params.id);
    if (!item || item.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    res.json(item);
  });

  r.post('/api/buyers', requireRole('admin','principal','manager'), (req, res) => {
    const b = req.body || {};
    const id = newId('buyer');
    const item = {
      id,
      agencyId: req.agencyId,
      firstName: sanitizeString(b.firstName, 100),
      lastName: sanitizeString(b.lastName, 100),
      idNumber: sanitizeString(b.idNumber, 20),
      phone: sanitizeString(b.phone, 20),
      email: sanitizeString(b.email, 200),
      whatsapp: sanitizeString(b.whatsapp, 20),
      ficaStatus: isValidEnum(b.ficaStatus, ENUMS.FICA_STATUSES) ? b.ficaStatus : 'pending',
      ficaSubmittedAt: b.ficaSubmittedAt || null,
      preApproved: !!b.preApproved,
      preApprovalAmount: sanitizeNumber(b.preApprovalAmount),
      budgetMin: sanitizeNumber(b.budgetMin),
      budgetMax: sanitizeNumber(b.budgetMax),
      requirements: sanitizeString(b.requirements, 1000),
      assignedAgentId: b.assignedAgentId || req.agentId,
      source: sanitizeString(b.source, 50) || 'walk-in',
      notes: sanitizeString(b.notes, 2000),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    save(dataDir, TYPE, id, item);
    res.status(201).json(item);
  });

  r.put('/api/buyers/:id', requireRole('admin','principal','manager'), (req, res) => {
    const existing = load(dataDir, TYPE, req.params.id);
    if (!existing || existing.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    const b = req.body || {};
    const fields = [
      'firstName', 'lastName', 'idNumber', 'phone', 'email', 'whatsapp',
      'ficaStatus', 'ficaSubmittedAt', 'preApproved', 'preApprovalAmount',
      'budgetMin', 'budgetMax', 'requirements', 'assignedAgentId', 'source', 'notes',
    ];
    for (const f of fields) {
      if (b[f] !== undefined) existing[f] = b[f];
    }
    existing.updatedAt = new Date().toISOString();
    save(dataDir, TYPE, existing.id, existing);
    res.json(existing);
  });

  return r;
}
