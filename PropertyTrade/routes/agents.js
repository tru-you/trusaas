import { Router } from 'express';
import { requireRole } from '../lib/isolation.js';
import { readStore, saveStore, createAgentCode } from '../lib/auth.js';
import { sanitizeString, isValidEnum, ENUMS } from '../lib/validate.js';

export default function agentRoutes(dataDir) {
  const r = Router();

  r.get('/api/agents', requireRole('admin'), (req, res) => {
    const store = readStore(dataDir);
    const agents = (store.agents || [])
      .filter(a => a.agencyId === req.agencyId)
      .map(({ salt, hash, ...a }) => a);
    res.json(agents);
  });

  r.post('/api/agents', requireRole('admin'), (req, res) => {
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ error: 'name required.' });
    const { agent, code } = createAgentCode(dataDir, {
      agencyId: req.agencyId,
      name: sanitizeString(b.name, 100),
      role: isValidEnum(b.role, ENUMS.AGENT_ROLES) ? b.role : 'agent',
      assignedPropertyIds: Array.isArray(b.assignedPropertyIds) ? b.assignedPropertyIds : [],
    });
    const { salt, hash, ...safe } = agent;
    res.status(201).json({ agent: safe, code });
  });

  r.put('/api/agents/:id', requireRole('admin'), (req, res) => {
    const store = readStore(dataDir);
    const agent = store.agents.find(a => a.id === req.params.id && a.agencyId === req.agencyId);
    if (!agent) return res.status(404).json({ error: 'Not found.' });
    const b = req.body || {};
    if (b.name !== undefined) agent.label = sanitizeString(b.name, 100);
    if (b.role !== undefined && isValidEnum(b.role, ENUMS.AGENT_ROLES)) agent.role = b.role;
    if (Array.isArray(b.assignedPropertyIds)) agent.assignedPropertyIds = b.assignedPropertyIds;
    if (b.active !== undefined) agent.active = !!b.active;
    saveStore(dataDir, store);
    const { salt, hash, ...safe } = agent;
    res.json(safe);
  });

  r.delete('/api/agents/:id', requireRole('admin'), (req, res) => {
    const store = readStore(dataDir);
    const agent = store.agents.find(a => a.id === req.params.id && a.agencyId === req.agencyId);
    if (!agent) return res.status(404).json({ error: 'Not found.' });
    agent.active = false;
    saveStore(dataDir, store);
    res.json({ ok: true });
  });

  return r;
}
