import { Router } from 'express';
import { query, load, save } from '../lib/persist.js';
import { requireRole, filterByAgentScope } from '../lib/isolation.js';

/**
 * Agency inbox: leads captured from the public website/webhook.
 * Scoped to the signed-in agency; agents see their assigned properties' leads.
 */
export default function leadRoutes(dataDir) {
  const r = Router();
  r.use(requireRole('admin', 'principal', 'manager', 'agent'));

  r.get('/', (req, res) => {
    const rows = query(dataDir, 'leads', req.agencyId, l => !l.deleted)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    res.json(filterByAgentScope(req, rows));
  });

  r.put('/:id', (req, res) => {
    const lead = load(dataDir, 'leads', req.params.id);
    if (!lead || lead.agencyId !== req.agencyId) {
      return res.status(404).json({ error: 'Not found.' });
    }
    const b = req.body || {};
    if (!['new', 'contacted', 'closed'].includes(b.status)) {
      return res.status(400).json({ error: 'status must be new | contacted | closed.' });
    }
    lead.status = b.status;
    lead.updatedAt = new Date().toISOString();
    save(dataDir, 'leads', lead.id, lead);
    res.json(lead);
  });

  return r;
}