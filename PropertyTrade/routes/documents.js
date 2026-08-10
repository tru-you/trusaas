import { Router } from 'express';
import { save, load, query, remove } from '../lib/persist.js';
import { newId } from '../lib/id.js';
import { requireRole } from '../lib/isolation.js';
import { sanitizeString, isValidEnum } from '../lib/validate.js';

const TYPE = 'documents';

const DOC_TYPES = [
  'lease_agreement', 'fica_id', 'fica_proof_of_address', 'fica_proof_of_income',
  'deposit_receipt', 'inspection_report', 'maintenance_quote', 'owner_statement',
  'coc_electrical', 'coc_plumbing', 'rates_clearance', 'mandate',
  'offer_to_purchase', 'deed_of_sale', 'bond_approval', 'transfer_duty', 'other',
];

export default function documentRoutes(dataDir) {
  const r = Router();

  r.get('/api/documents', (req, res) => {
    const { parentType, parentId, docType } = req.query;
    const items = query(dataDir, TYPE, req.agencyId, (d) => {
      if (parentType && d.parentType !== parentType) return false;
      if (parentId && d.parentId !== parentId) return false;
      if (docType && d.docType !== docType) return false;
      return true;
    });
    const safe = items.map(({ dataUrl, ...rest }) => rest);
    res.json(safe);
  });

  r.get('/api/documents/:id', (req, res) => {
    const item = load(dataDir, TYPE, req.params.id);
    if (!item || item.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    res.json(item);
  });

  r.get('/api/documents/:id/download', (req, res) => {
    const item = load(dataDir, TYPE, req.params.id);
    if (!item || item.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    if (!item.dataUrl) return res.status(404).json({ error: 'No file data.' });
    const match = item.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Invalid data.' });
    const buf = Buffer.from(match[2], 'base64');
    res.set('Content-Type', match[1]);
    res.set('Content-Disposition', `inline; filename="${item.filename}"`);
    res.send(buf);
  });

  r.post('/api/documents', requireRole('admin','principal','manager'), (req, res) => {
    const b = req.body || {};
    if (!b.parentType || !b.parentId) return res.status(400).json({ error: 'parentType and parentId required.' });
    const id = newId('document');
    const item = {
      id,
      agencyId: req.agencyId,
      parentType: sanitizeString(b.parentType, 30),
      parentId: sanitizeString(b.parentId, 40),
      docType: isValidEnum(b.docType, DOC_TYPES) ? b.docType : 'other',
      filename: sanitizeString(b.filename, 200),
      mimeType: sanitizeString(b.mimeType, 100),
      dataUrl: b.dataUrl || '',
      uploadedBy: req.auth.label,
      notes: sanitizeString(b.notes, 500),
      createdAt: new Date().toISOString(),
    };
    save(dataDir, TYPE, id, item);
    const { dataUrl, ...safe } = item;
    res.status(201).json(safe);
  });

  r.delete('/api/documents/:id', requireRole('admin','principal','manager'), (req, res) => {
    const item = load(dataDir, TYPE, req.params.id);
    if (!item || item.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    remove(dataDir, TYPE, req.params.id);
    res.json({ ok: true });
  });

  return r;
}
