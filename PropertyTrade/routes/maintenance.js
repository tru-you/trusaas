import { Router } from 'express';
import { save, load, query } from '../lib/persist.js';
import { newId } from '../lib/id.js';
import { agentCanAccessProperty, filterByAgentScope } from '../lib/isolation.js';
import { sanitizeString, sanitizeNumber, isValidEnum, ENUMS } from '../lib/validate.js';

const TYPE = 'maintenance';

export default function maintenanceRoutes(dataDir) {
  const r = Router();

  r.get('/api/maintenance', (req, res) => {
    const { status, priority, propertyId } = req.query;
    let items = query(dataDir, TYPE, req.agencyId, (m) => {
      if (status && m.status !== status) return false;
      if (priority && m.priority !== priority) return false;
      if (propertyId && m.propertyId !== propertyId) return false;
      return true;
    });
    items = filterByAgentScope(req, items);
    res.json(items);
  });

  r.get('/api/maintenance/:id', (req, res) => {
    const item = load(dataDir, TYPE, req.params.id);
    if (!item || item.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    res.json(item);
  });

  r.post('/api/maintenance', (req, res) => {
    const b = req.body || {};
    if (!b.propertyId) return res.status(400).json({ error: 'propertyId required.' });
    const id = newId('maintenance');
    const item = {
      id,
      agencyId: req.agencyId,
      propertyId: b.propertyId,
      tenantId: b.tenantId || null,
      reportedBy: sanitizeString(b.reportedBy, 100),
      reportedDate: b.reportedDate || new Date().toISOString().slice(0, 10),
      category: isValidEnum(b.category, ENUMS.MAINTENANCE_CATEGORIES) ? b.category : 'other',
      description: sanitizeString(b.description, 2000),
      priority: isValidEnum(b.priority, ENUMS.MAINTENANCE_PRIORITIES) ? b.priority : 'medium',
      status: 'reported',
      assignedTo: sanitizeString(b.assignedTo, 100),
      assignedAgentId: b.assignedAgentId || null,
      estimatedCostZAR: sanitizeNumber(b.estimatedCostZAR),
      actualCostZAR: 0,
      quotePaid: false,
      photos: Array.isArray(b.photos) ? b.photos : [],
      notes: [],
      resolvedDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    save(dataDir, TYPE, id, item);
    res.status(201).json(item);
  });

  r.put('/api/maintenance/:id', (req, res) => {
    const existing = load(dataDir, TYPE, req.params.id);
    if (!existing || existing.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    const b = req.body || {};
    for (const f of ['category', 'description', 'priority', 'status', 'assignedTo', 'assignedAgentId', 'estimatedCostZAR', 'actualCostZAR', 'quotePaid']) {
      if (b[f] !== undefined) existing[f] = b[f];
    }
    existing.updatedAt = new Date().toISOString();
    save(dataDir, TYPE, existing.id, existing);
    res.json(existing);
  });

  r.post('/api/maintenance/:id/note', (req, res) => {
    const existing = load(dataDir, TYPE, req.params.id);
    if (!existing || existing.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    const note = {
      date: new Date().toISOString(),
      author: req.auth.label,
      text: sanitizeString(req.body?.text, 1000),
    };
    if (!Array.isArray(existing.notes)) existing.notes = [];
    existing.notes.push(note);
    existing.updatedAt = new Date().toISOString();
    save(dataDir, TYPE, existing.id, existing);
    res.json(existing);
  });

  r.put('/api/maintenance/:id/resolve', (req, res) => {
    const existing = load(dataDir, TYPE, req.params.id);
    if (!existing || existing.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    existing.status = 'resolved';
    existing.resolvedDate = new Date().toISOString().slice(0, 10);
    if (req.body?.actualCostZAR !== undefined) existing.actualCostZAR = sanitizeNumber(req.body.actualCostZAR);
    existing.updatedAt = new Date().toISOString();
    save(dataDir, TYPE, existing.id, existing);
    res.json(existing);
  });

  return r;
}
