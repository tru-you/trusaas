import express from 'express';
import { requireRole } from '../lib/isolation.js';
import {
  createAgency,
  listAgencies,
  agencyById,
  rotateAgencyCode,
  readStore,
  saveStore,
  PRODUCTS,
} from '../lib/auth.js';

/**
 * TruSaaS master console — manages the agency registry.
 * Only the master login (role 'admin', no agencyId) may use these.
 * Slugs are permanent once chosen: public feeds and satellites key off them.
 */
export default function masterRoutes(dataDir) {
  const r = express.Router();
  r.use(requireRole('admin'), (req, res, next) => {
    if (req.agencyId) {
      return res.status(403).json({ error: 'Master console only.' });
    }
    next();
  });

  r.get('/agencies', (req, res) => {
    res.json(listAgencies(dataDir));
  });

  r.post('/agencies', (req, res) => {
    const b = req.body || {};
    const result = createAgency(dataDir, {
      name: b.name,
      slug: b.slug,
      products: b.products,
      websiteUrl: b.websiteUrl,
    });
    if (result.error) return res.status(400).json({ error: result.error });
    const { agency, code } = result;
    res.status(201).json({ agency, code });
  });

  r.put('/agencies/:id', (req, res) => {
    const agency = agencyById(dataDir, req.params.id);
    if (!agency) return res.status(404).json({ error: 'Agency not found.' });

    const b = req.body || {};
    if (b.name !== undefined) agency.name = String(b.name).trim().slice(0, 100) || agency.name;
    if (b.websiteUrl !== undefined) agency.websiteUrl = String(b.websiteUrl).trim().slice(0, 300);
    if (b.products !== undefined) {
      if (!Array.isArray(b.products) || b.products.some(p => !PRODUCTS.includes(p))) {
        return res.status(400).json({
          error: 'Products must be a subset of ' + PRODUCTS.join(', ') + '.',
        });
      }
      agency.products = b.products;
    }
    agency.updatedAt = new Date().toISOString();

    const store = readStore(dataDir);
    store.agencies = store.agencies.map(a => (a.id === agency.id ? agency : a));
    saveStore(dataDir, store);
    res.json(agency);
  });

  r.post('/agencies/:id/rotate', (req, res) => {
    const result = rotateAgencyCode(dataDir, req.params.id);
    if (!result) return res.status(404).json({ error: 'Agency not found.' });
    res.json({ code: result.code });
  });

  return r;
}