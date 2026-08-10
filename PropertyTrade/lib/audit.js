import { save } from './persist.js';
import { newId } from './id.js';

export function recordAudit(dataDir, { agentId, agencyId, action, entityType, entityId, changes }) {
  const id = newId('audit');
  save(dataDir, 'audit_logs', id, {
    id,
    agentId: agentId || null,
    agencyId: agencyId || null,
    action,
    entityType,
    entityId,
    changes: changes || null,
    at: new Date().toISOString(),
  });
}
