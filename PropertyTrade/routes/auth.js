import { Router } from 'express';
import { loginWithCode, readStore } from '../lib/auth.js';

export default function authRoutes(dataDir) {
  const r = Router();

  r.post('/api/auth/login', (req, res) => {
    const { code, remember } = req.body || {};
    if (!code) return res.status(400).json({ error: 'Code is required.' });
    const result = loginWithCode(code, dataDir);
    if (!result) return res.status(401).json({ error: 'Invalid access code.' });
    res.json(result);
  });

  r.get('/api/auth/me', (req, res) => {
    if (!req.auth) return res.status(401).json({ error: 'Not signed in.' });
    const store = readStore(dataDir);
    res.json({
      id: req.auth.sub,
      role: req.auth.role,
      label: req.auth.label,
      agencyId: req.auth.agencyId,
      agencyName: store.agency?.name || '',
    });
  });

  return r;
}
