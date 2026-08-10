import { Router } from 'express';
import { newId } from '../lib/id.js';
import { save, load, query } from '../lib/persist.js';
import { requireFields, sanitizeString, sanitizeNumber, isValidEnum, ENUMS } from '../lib/validate.js';
import { requireRole, filterByAgentScope } from '../lib/isolation.js';
import { paginate } from '../lib/paginate.js';
import { recordAudit } from '../lib/audit.js';

export default function interestRoutes(DATA_DIR) {
  const r = Router();

  r.get('/api/interests', (req, res) => {
    let items = query(DATA_DIR, 'interests', req.agencyId);
    items = filterByAgentScope(req, items);
    if (req.query.propertyId) items = items.filter(i => i.propertyId === req.query.propertyId);
    if (req.query.buyerId) items = items.filter(i => i.buyerId === req.query.buyerId);
    if (req.query.status) items = items.filter(i => i.status === req.query.status);
    res.json(paginate(req, res, items));
  });

  r.get('/api/interests/:id', (req, res) => {
    const item = load(DATA_DIR, 'interests', req.params.id);
    if (!item || item.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    res.json(item);
  });

  r.post('/api/interests', requireRole('admin','principal','manager'), (req, res) => {
    const err = requireFields(req.body, ['propertyId', 'buyerId']);
    if (err) return res.status(400).json({ error: err });

    const id = newId('interest');
    const now = new Date().toISOString();
    const interest = {
      id,
      agencyId: req.agencyId,
      propertyId: sanitizeString(req.body.propertyId),
      buyerId: sanitizeString(req.body.buyerId),
      agentId: req.body.agentId ? sanitizeString(req.body.agentId) : req.agentId,
      status: 'new',
      source: isValidEnum(req.body.source, ENUMS.INTEREST_SOURCES) ? req.body.source : 'web',
      lostReason: '',
      notes: [],
      createdAt: now,
      updatedAt: now,
    };
    save(DATA_DIR, 'interests', id, interest);
    recordAudit(DATA_DIR, { agentId: req.agentId, agencyId: req.agencyId, action: 'create', entityType: 'interest', entityId: id });
    res.status(201).json(interest);
  });

  r.put('/api/interests/:id', requireRole('admin','principal','manager'), (req, res) => {
    const item = load(DATA_DIR, 'interests', req.params.id);
    if (!item || item.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });

    if (req.body.status && isValidEnum(req.body.status, ENUMS.INTEREST_STATUSES)) item.status = req.body.status;
    if (req.body.source && isValidEnum(req.body.source, ENUMS.INTEREST_SOURCES)) item.source = req.body.source;
    if (req.body.agentId) item.agentId = sanitizeString(req.body.agentId);
    if (req.body.lostReason !== undefined) item.lostReason = sanitizeString(req.body.lostReason);
    item.updatedAt = new Date().toISOString();
    save(DATA_DIR, 'interests', item.id, item);
    recordAudit(DATA_DIR, { agentId: req.agentId, agencyId: req.agencyId, action: 'update', entityType: 'interest', entityId: item.id });
    res.json(item);
  });

  r.post('/api/interests/:id/note', requireRole('admin','principal','manager'), (req, res) => {
    const item = load(DATA_DIR, 'interests', req.params.id);
    if (!item || item.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    const text = sanitizeString(req.body.text, 1000);
    if (!text) return res.status(400).json({ error: 'Note text required.' });

    if (!item.notes) item.notes = [];
    item.notes.push({ date: new Date().toISOString(), author: req.body.author || req.agentId, text });
    item.updatedAt = new Date().toISOString();
    save(DATA_DIR, 'interests', item.id, item);
    recordAudit(DATA_DIR, { agentId: req.agentId, agencyId: req.agencyId, action: 'note', entityType: 'interest', entityId: item.id });
    res.json(item);
  });

  r.delete('/api/interests/:id', requireRole('admin','principal','manager'), (req, res) => {
    const item = load(DATA_DIR, 'interests', req.params.id);
    if (!item || item.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    item.deleted = true;
    item.updatedAt = new Date().toISOString();
    save(DATA_DIR, 'interests', item.id, item);
    recordAudit(DATA_DIR, { agentId: req.agentId, agencyId: req.agencyId, action: 'delete', entityType: 'interest', entityId: item.id });
    res.json({ ok: true });
  });

  return r;
}
