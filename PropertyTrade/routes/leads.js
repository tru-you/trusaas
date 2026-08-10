import { Router } from 'express';
import { query, load, save } from '../lib/persist.js';
import { requireRole, filterByAgentScope } from '../lib/isolation.js';
import { paginate } from '../lib/paginate.js';
import { recordAudit } from '../lib/audit.js';

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
    res.json(paginate(req, res, filterByAgentScope(req, rows)));
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
    recordAudit(dataDir, { agentId: req.agentId, agencyId: req.agencyId, action: 'update', entityType: 'lead', entityId: lead.id });
    res.json(lead);
  });

  return r;
}