export function extractAgency(req, res, next) {
  if (!req.auth) return next();
  req.agencyId = req.auth.agencyId;
  req.agentId = req.auth.sub;
  req.agentRole = req.auth.role;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.agentRole)) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }
    next();
  };
}

export function scopeToAgency(req, res, next) {
  if (!req.agencyId) {
    return res.status(403).json({ error: 'No agency context.' });
  }
  next();
}

export function agentCanAccessProperty(req, propertyId) {
  if (req.agentRole === 'admin' || req.agentRole === 'manager') return true;
  const assigned = req.auth.assignedPropertyIds || [];
  return assigned.includes(propertyId);
}

export function filterByAgentScope(req, items) {
  if (req.agentRole === 'admin' || req.agentRole === 'manager') return items;
  const assigned = new Set(req.auth.assignedPropertyIds || []);
  return items.filter(item => {
    if (item.propertyId) return assigned.has(item.propertyId);
    if (item.id && item.address) return assigned.has(item.id);
    return true;
  });
}
