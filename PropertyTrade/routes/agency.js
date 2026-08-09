import { Router } from 'express';
import { requireRole } from '../lib/isolation.js';
import { readStore, saveStore } from '../lib/auth.js';
import { sanitizeString } from '../lib/validate.js';

export default function agencyRoutes(dataDir) {
  const r = Router();

  r.get('/api/agency', (req, res) => {
    const store = readStore(dataDir);
    res.json(store.agency || {});
  });

  r.put('/api/agency', requireRole('admin'), (req, res) => {
    const store = readStore(dataDir);
    const b = req.body || {};
    const a = store.agency || {};
    for (const f of ['name', 'slug', 'region', 'ficaRef', 'contactEmail', 'contactPhone', 'whatsapp', 'address', 'bankName', 'bankAccount', 'bankBranch', 'eaabRef']) {
      if (b[f] !== undefined) a[f] = sanitizeString(b[f], 300);
    }
    if (b.logoDataUrl !== undefined) a.logoDataUrl = b.logoDataUrl;
    a.updatedAt = new Date().toISOString();
    store.agency = a;
    saveStore(dataDir, store);
    res.json(a);
  });

  return r;
}
