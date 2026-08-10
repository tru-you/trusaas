import { Router } from 'express';
import { requireRole, scopeToAgency } from '../lib/isolation.js';
import { readStore, saveStore, agencyById } from '../lib/auth.js';
import { sanitizeString } from '../lib/validate.js';
import { recordAudit } from '../lib/audit.js';

export default function agencyRoutes(dataDir) {
  const r = Router();

  const getOwn = (req) => {
    if (!req.agencyId) return {};
    const store = readStore(dataDir);
    return agencyById(dataDir, req.agencyId) || store.agency || {};
  };

  r.get('/api/agency', (req, res) => {
    res.json(getOwn(req));
  });

  r.put('/api/agency', scopeToAgency, requireRole('admin', 'principal'), (req, res) => {
    const store = readStore(dataDir);
    const b = req.body || {};
    const a = getOwn(req);
    // slug is permanent — it keys the public feed and satellite pairing.
    for (const f of ['name', 'region', 'ficaRef', 'contactEmail', 'contactPhone', 'whatsapp', 'address', 'bankName', 'bankAccount', 'bankBranch', 'eaabRef']) {
      if (b[f] !== undefined) a[f] = sanitizeString(b[f], 300);
    }
    if (b.logoDataUrl !== undefined) a.logoDataUrl = b.logoDataUrl;
    a.updatedAt = new Date().toISOString();
    store.agencies = store.agencies.map(x => (x.id === a.id ? a : x));
    if (store.agency && store.agency.id === a.id) store.agency = a;
    saveStore(dataDir, store);
    recordAudit(dataDir, { agentId: req.agentId, agencyId: req.agencyId, action: 'update', entityType: 'agency', entityId: a.id });
    res.json(a);
  });

  return r;
}