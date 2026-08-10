import { Router } from 'express';
import {
  loginWithCode,
  readStore,
  verifyCodeWithProduct,
  listAgencies,
  PRODUCTS,
} from '../lib/auth.js';

export default function authRoutes(dataDir) {
  const r = Router();

  r.post('/api/auth/login', (req, res) => {
    const { code, remember } = req.body || {};
    if (!code) return res.status(400).json({ error: 'Code is required.' });
    const result = loginWithCode(code, dataDir);
    if (!result) return res.status(401).json({ error: 'Invalid access code.' });
    res.json(result);
  });

  /** Satellite handshake: a code + product; grants what the agency owns. */
  r.post('/api/auth/verify-code', (req, res) => {
    const syncKey = process.env.FLOWPMS_SYNC_KEY;
    if (!syncKey) {
      return res.status(503).json({ error: 'FLOWPMS_SYNC_KEY not set — pairing unavailable.' });
    }
    if (String(req.headers['x-tru-sync-key'] || '') !== syncKey) {
      return res.status(401).json({ error: 'Invalid sync key.' });
    }
    const { code, product } = req.body || {};
    if (!code || !product) return res.status(400).json({ error: 'code and product are required.' });
    if (!PRODUCTS.includes(product)) return res.status(400).json({ error: 'Unknown product.' });

    const result = verifyCodeWithProduct(code, product, dataDir);
    if (result.refused === 'unknown') return res.status(401).json({ error: 'Invalid code.' });
    if (result.refused === 'master') {
      return res.status(403).json({ error: 'The master login cannot enter a product.' });
    }
    if (result.refused === 'product') {
      return res.status(403).json({
        error: 'This agency does not own that product.',
        products: result.products,
      });
    }
    res.json(result);
  });

  r.get('/api/auth/me', (req, res) => {
    if (!req.auth) return res.status(401).json({ error: 'Not signed in.' });
    const store = readStore(dataDir);
    const agencies = listAgencies(dataDir);
    const mine = req.auth.agencyId
      ? agencies.find(a => a.id === req.auth.agencyId)
      : undefined;
    res.json({
      id: req.auth.sub,
      role: req.auth.role,
      label: req.auth.label,
      agencyId: req.auth.agencyId,
      agencyName: mine?.name || store.agency?.name || '',
    });
  });

  return r;
}