import { Router } from 'express';
import { newId } from '../lib/id.js';
import { save, load, query } from '../lib/persist.js';
import { requireFields, sanitizeString, sanitizeNumber, isValidEnum, ENUMS } from '../lib/validate.js';
import { calculateSaleCommission, calculateRentalCommission, splitCommission } from '../lib/sa-rules.js';

export default function commissionRoutes(DATA_DIR) {
  const r = Router();

  r.get('/api/commissions', (req, res) => {
    let items = query(DATA_DIR, 'commissions', req.agencyId);
    if (req.query.type) items = items.filter(c => c.type === req.query.type);
    if (req.query.propertyId) items = items.filter(c => c.propertyId === req.query.propertyId);
    if (req.query.status) items = items.filter(c => c.status === req.query.status);
    res.json(items);
  });

  r.get('/api/commissions/:id', (req, res) => {
    const item = load(DATA_DIR, 'commissions', req.params.id);
    if (!item || item.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    res.json(item);
  });

  r.post('/api/commissions', (req, res) => {
    const err = requireFields(req.body, ['type', 'propertyId']);
    if (err) return res.status(400).json({ error: err });
    if (!isValidEnum(req.body.type, ENUMS.COMMISSION_TYPES)) {
      return res.status(400).json({ error: 'Invalid commission type.' });
    }

    const vatRegistered = !!req.body.vatRegistered;
    let calc;
    if (req.body.type === 'sale') {
      calc = calculateSaleCommission(
        sanitizeNumber(req.body.salePriceZAR),
        sanitizeNumber(req.body.commissionPercent),
        vatRegistered
      );
    } else {
      calc = calculateRentalCommission(
        sanitizeNumber(req.body.monthlyRentZAR),
        sanitizeNumber(req.body.commissionPercent),
        vatRegistered
      );
    }

    const rawSplits = Array.isArray(req.body.splits) ? req.body.splits.map(s => ({
      agentId: sanitizeString(s.agentId),
      role: isValidEnum(s.role, ENUMS.COMMISSION_SPLIT_ROLES) ? s.role : 'listing',
      percent: sanitizeNumber(s.percent),
      status: 'pending',
      paidDate: null,
    })) : [];
    const { splits, agencyRetainedZAR } = splitCommission(calc.netAmountZAR, rawSplits);

    const id = newId('commission');
    const now = new Date().toISOString();
    const commission = {
      id,
      agencyId: req.agencyId,
      type: req.body.type,
      propertyId: sanitizeString(req.body.propertyId),
      saleId: sanitizeString(req.body.saleId || ''),
      leaseId: sanitizeString(req.body.leaseId || ''),
      mandateId: sanitizeString(req.body.mandateId || ''),
      commissionPercent: sanitizeNumber(req.body.commissionPercent),
      ...calc,
      splits,
      agencyRetainedZAR,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    save(DATA_DIR, 'commissions', id, commission);
    res.status(201).json(commission);
  });

  r.put('/api/commissions/:id', (req, res) => {
    const item = load(DATA_DIR, 'commissions', req.params.id);
    if (!item || item.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });

    if (req.body.status) item.status = req.body.status;
    if (Array.isArray(req.body.splits)) {
      item.splits = req.body.splits.map(s => ({
        agentId: sanitizeString(s.agentId),
        role: isValidEnum(s.role, ENUMS.COMMISSION_SPLIT_ROLES) ? s.role : s.role,
        percent: sanitizeNumber(s.percent),
        amountZAR: sanitizeNumber(s.amountZAR),
        status: isValidEnum(s.status, ENUMS.COMMISSION_SPLIT_STATUSES) ? s.status : 'pending',
        paidDate: s.paidDate || null,
      }));
    }
    item.updatedAt = new Date().toISOString();
    save(DATA_DIR, 'commissions', item.id, item);
    res.json(item);
  });

  r.put('/api/commissions/:id/splits/:idx/pay', (req, res) => {
    const item = load(DATA_DIR, 'commissions', req.params.id);
    if (!item || item.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });

    const idx = parseInt(req.params.idx);
    if (!item.splits[idx]) return res.status(404).json({ error: 'Split not found.' });
    item.splits[idx].status = 'paid';
    item.splits[idx].paidDate = new Date().toISOString().slice(0, 10);

    const allPaid = item.splits.every(s => s.status === 'paid');
    const anyPaid = item.splits.some(s => s.status === 'paid');
    item.status = allPaid ? 'paid' : anyPaid ? 'partially_paid' : 'pending';

    item.updatedAt = new Date().toISOString();
    save(DATA_DIR, 'commissions', item.id, item);
    res.json(item);
  });

  return r;
}
