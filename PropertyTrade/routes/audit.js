import { Router } from 'express';
import { query } from '../lib/persist.js';
import { requireRole } from '../lib/isolation.js';

export default function auditRoutes(dataDir) {
  const r = Router();

  r.get('/api/audit', requireRole('admin', 'principal', 'manager'), (req, res) => {
    const { entityType, action } = req.query;
    const items = query(dataDir, 'audit_logs', req.agencyId, (a) => {
      if (entityType && a.entityType !== entityType) return false;
      if (action && a.action !== action) return false;
      return true;
    })
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, 100);
    res.json(items);
  });

  return r;
}
