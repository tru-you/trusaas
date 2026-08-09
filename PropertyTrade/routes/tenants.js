import { Router } from 'express';
import { save, load, query } from '../lib/persist.js';
import { newId } from '../lib/id.js';
import { filterByAgentScope } from '../lib/isolation.js';
import { sanitizeString, sanitizeNumber, isValidEnum, ENUMS } from '../lib/validate.js';

const TYPE = 'tenants';

export default function tenantRoutes(dataDir) {
  const r = Router();

  r.get('/api/tenants', (req, res) => {
    const { search, ficaStatus } = req.query;
    let items = query(dataDir, TYPE, req.agencyId, (t) => {
      if (ficaStatus && t.ficaStatus !== ficaStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!`${t.firstName} ${t.lastName} ${t.email || ''} ${t.phone || ''}`.toLowerCase().includes(s)) return false;
      }
      return true;
    });
    res.json(items);
  });

  r.get('/api/tenants/:id', (req, res) => {
    const item = load(dataDir, TYPE, req.params.id);
    if (!item || item.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    res.json(item);
  });

  r.post('/api/tenants', (req, res) => {
    const b = req.body || {};
    const id = newId('tenant');
    const item = {
      id,
      agencyId: req.agencyId,
      firstName: sanitizeString(b.firstName, 100),
      lastName: sanitizeString(b.lastName, 100),
      idNumber: sanitizeString(b.idNumber, 20),
      phone: sanitizeString(b.phone, 20),
      email: sanitizeString(b.email, 200),
      whatsapp: sanitizeString(b.whatsapp, 20),
      emergencyContactName: sanitizeString(b.emergencyContactName, 100),
      emergencyContactPhone: sanitizeString(b.emergencyContactPhone, 20),
      ficaStatus: isValidEnum(b.ficaStatus, ENUMS.FICA_STATUSES) ? b.ficaStatus : 'pending',
      ficaSubmittedAt: b.ficaSubmittedAt || null,
      employer: sanitizeString(b.employer, 200),
      employerPhone: sanitizeString(b.employerPhone, 20),
      monthlyIncome: sanitizeNumber(b.monthlyIncome),
      notes: sanitizeString(b.notes, 2000),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    save(dataDir, TYPE, id, item);
    res.status(201).json(item);
  });

  r.put('/api/tenants/:id', (req, res) => {
    const existing = load(dataDir, TYPE, req.params.id);
    if (!existing || existing.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    const b = req.body || {};
    const fields = [
      'firstName', 'lastName', 'idNumber', 'phone', 'email', 'whatsapp',
      'emergencyContactName', 'emergencyContactPhone', 'ficaStatus', 'ficaSubmittedAt',
      'employer', 'employerPhone', 'monthlyIncome', 'notes',
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
