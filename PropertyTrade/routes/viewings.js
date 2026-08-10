import { Router } from 'express';
import { newId } from '../lib/id.js';
import { save, load, query } from '../lib/persist.js';
import { requireFields, sanitizeString, isValidEnum, ENUMS } from '../lib/validate.js';
import { requireRole, filterByAgentScope } from '../lib/isolation.js';

export default function viewingRoutes(DATA_DIR) {
  const r = Router();

  r.get('/api/viewings', (req, res) => {
    let items = query(DATA_DIR, 'viewings', req.agencyId);
    items = filterByAgentScope(req, items);
    if (req.query.propertyId) items = items.filter(v => v.propertyId === req.query.propertyId);
    if (req.query.buyerId) items = items.filter(v => v.buyerId === req.query.buyerId);
    if (req.query.status) items = items.filter(v => v.status === req.query.status);
    res.json(items);
  });

  r.get('/api/viewings/:id', (req, res) => {
    const item = load(DATA_DIR, 'viewings', req.params.id);
    if (!item || item.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    res.json(item);
  });

  r.post('/api/viewings', requireRole('admin','principal','manager'), (req, res) => {
    const err = requireFields(req.body, ['propertyId', 'buyerId', 'scheduledDate']);
    if (err) return res.status(400).json({ error: err });

    const now = new Date().toISOString();

    let interestId = req.body.interestId || null;
    if (!interestId) {
      const existing = query(DATA_DIR, 'interests', req.agencyId, i =>
        i.propertyId === req.body.propertyId && i.buyerId === req.body.buyerId && !i.deleted
      );
      if (existing.length) {
        interestId = existing[0].id;
        if (existing[0].status === 'new' || existing[0].status === 'contacted') {
          existing[0].status = 'viewing_scheduled';
          existing[0].updatedAt = now;
          save(DATA_DIR, 'interests', existing[0].id, existing[0]);
        }
      } else {
        interestId = newId('interest');
        const interest = {
          id: interestId,
          agencyId: req.agencyId,
          propertyId: sanitizeString(req.body.propertyId),
          buyerId: sanitizeString(req.body.buyerId),
          agentId: req.body.agentId ? sanitizeString(req.body.agentId) : req.agentId,
          status: 'viewing_scheduled',
          source: isValidEnum(req.body.source, ENUMS.INTEREST_SOURCES) ? req.body.source : 'web',
          lostReason: '',
          notes: [],
          createdAt: now,
          updatedAt: now,
        };
        save(DATA_DIR, 'interests', interestId, interest);
      }
    }

    const id = newId('viewing');
    const viewing = {
      id,
      agencyId: req.agencyId,
      propertyId: sanitizeString(req.body.propertyId),
      buyerId: sanitizeString(req.body.buyerId),
      interestId,
      agentId: req.body.agentId ? sanitizeString(req.body.agentId) : req.agentId,
      scheduledDate: sanitizeString(req.body.scheduledDate),
      scheduledTime: sanitizeString(req.body.scheduledTime || ''),
      status: 'scheduled',
      feedback: '',
      rating: '',
      createdAt: now,
      updatedAt: now,
    };
    save(DATA_DIR, 'viewings', id, viewing);
    res.status(201).json(viewing);
  });

  r.put('/api/viewings/:id', requireRole('admin','principal','manager'), (req, res) => {
    const item = load(DATA_DIR, 'viewings', req.params.id);
    if (!item || item.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });

    if (req.body.scheduledDate) item.scheduledDate = sanitizeString(req.body.scheduledDate);
    if (req.body.scheduledTime !== undefined) item.scheduledTime = sanitizeString(req.body.scheduledTime);
    if (req.body.status && isValidEnum(req.body.status, ENUMS.VIEWING_STATUSES)) item.status = req.body.status;
    if (req.body.agentId) item.agentId = sanitizeString(req.body.agentId);
    item.updatedAt = new Date().toISOString();
    save(DATA_DIR, 'viewings', item.id, item);
    res.json(item);
  });

  r.put('/api/viewings/:id/complete', requireRole('admin','principal','manager'), (req, res) => {
    const item = load(DATA_DIR, 'viewings', req.params.id);
    if (!item || item.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });

    item.status = 'completed';
    if (req.body.feedback) item.feedback = sanitizeString(req.body.feedback, 2000);
    if (req.body.rating && isValidEnum(req.body.rating, ENUMS.VIEWING_RATINGS)) item.rating = req.body.rating;
    item.updatedAt = new Date().toISOString();
    save(DATA_DIR, 'viewings', item.id, item);

    if (item.interestId) {
      const interest = load(DATA_DIR, 'interests', item.interestId);
      if (interest && interest.agencyId === req.agencyId) {
        if (interest.status === 'viewing_scheduled') {
          interest.status = 'viewing_done';
          interest.updatedAt = new Date().toISOString();
          save(DATA_DIR, 'interests', interest.id, interest);
        }
      }
    }

    res.json(item);
  });

  return r;
}
