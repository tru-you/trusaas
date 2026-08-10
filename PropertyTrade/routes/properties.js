import { Router } from 'express';
import { save, load, query } from '../lib/persist.js';
import { newId } from '../lib/id.js';
import { requireRole, agentCanAccessProperty, filterByAgentScope } from '../lib/isolation.js';
import { sanitizeString, sanitizeNumber, isValidEnum, ENUMS } from '../lib/validate.js';
import { paginate } from '../lib/paginate.js';
import { recordAudit } from '../lib/audit.js';
import { csvBuild } from '../lib/csv.js';

const TYPE = 'properties';

export default function propertyRoutes(dataDir) {
  const r = Router();

  r.get('/api/properties/export.csv', (req, res) => {
    let items = query(dataDir, TYPE, req.agencyId, p => !p.deleted);
    items = filterByAgentScope(req, items);
    const csv = csvBuild([
      ['ID', 'Address', 'Suburb', 'City', 'Type', 'Bedrooms', 'Bathrooms', 'Parking', 'FloorSize', 'ErfSize', 'Price', 'Status', 'ListingRef'],
      ...items.map(p => [
        p.id,
        p.address,
        p.suburb,
        p.city,
        p.propertyType,
        p.bedrooms,
        p.bathrooms,
        p.parking,
        p.floorArea,
        p.erfNumber,
        (p.purpose === 'sale' || p.purpose === 'both') ? p.askingPriceZAR : p.monthlyRentZAR,
        (p.purpose === 'sale' || p.purpose === 'both') ? p.salesStatus : p.rentalStatus,
        p.listingRef || '',
      ]),
    ]);
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="properties-export.csv"');
    res.send(csv + '\r\n');
  });

  r.get('/api/properties', (req, res) => {
    const { purpose, status, type, search } = req.query;
    let items = query(dataDir, TYPE, req.agencyId, (p) => {
      if (purpose && p.purpose !== purpose) return false;
      if (type && p.propertyType !== type) return false;
      if (status) {
        if (p.purpose === 'sale' || p.purpose === 'both') {
          if (p.salesStatus !== status && p.rentalStatus !== status) return false;
        } else {
          if (p.rentalStatus !== status) return false;
        }
      }
      if (search) {
        const s = search.toLowerCase();
        if (!`${p.address} ${p.suburb} ${p.city} ${p.unitNumber || ''}`.toLowerCase().includes(s)) return false;
      }
      return true;
    });
    items = filterByAgentScope(req, items);
    res.json(paginate(req, res, items));
  });

  r.get('/api/properties/:id', (req, res) => {
    const item = load(dataDir, TYPE, req.params.id);
    if (!item || item.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    if (!agentCanAccessProperty(req, item.id)) return res.status(403).json({ error: 'Not assigned.' });
    res.json(item);
  });

  r.post('/api/properties', requireRole('admin','manager','principal'), (req, res) => {
    const b = req.body || {};
    const id = newId('property');
    const item = {
      id,
      agencyId: req.agencyId,
      ownerId: b.ownerId || null,
      address: sanitizeString(b.address, 300),
      unitNumber: sanitizeString(b.unitNumber, 50),
      suburb: sanitizeString(b.suburb, 100),
      city: sanitizeString(b.city, 100),
      province: sanitizeString(b.province, 100),
      postalCode: sanitizeString(b.postalCode, 10),
      propertyType: isValidEnum(b.propertyType, ENUMS.PROPERTY_TYPES) ? b.propertyType : 'House',
      bedrooms: sanitizeNumber(b.bedrooms),
      bathrooms: sanitizeNumber(b.bathrooms),
      parking: sanitizeNumber(b.parking),
      floorArea: sanitizeNumber(b.floorArea),
      erfNumber: sanitizeString(b.erfNumber, 50),
      monthlyRentZAR: sanitizeNumber(b.monthlyRentZAR),
      depositZAR: sanitizeNumber(b.depositZAR),
      rentalStatus: isValidEnum(b.rentalStatus, ENUMS.RENTAL_STATUSES) ? b.rentalStatus : 'vacant',
      askingPriceZAR: sanitizeNumber(b.askingPriceZAR),
      salesStatus: isValidEnum(b.salesStatus, ENUMS.SALES_STATUSES) ? b.salesStatus : 'available',
      purpose: isValidEnum(b.purpose, ENUMS.PROPERTY_PURPOSES) ? b.purpose : 'rental',
      published: b.published === true,
      currentLeaseId: null,
      currentTenantId: null,
      managingAgentId: b.managingAgentId || req.agentId,
      photos: b.photos || {},
      features: Array.isArray(b.features) ? b.features.map(f => sanitizeString(f, 50)) : [],
      notes: sanitizeString(b.notes, 2000),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    save(dataDir, TYPE, id, item);
    recordAudit(dataDir, { agentId: req.agentId, agencyId: req.agencyId, action: 'create', entityType: 'property', entityId: id });
    res.status(201).json(item);
  });

  r.put('/api/properties/:id', (req, res) => {
    const existing = load(dataDir, TYPE, req.params.id);
    if (!existing || existing.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    if (!agentCanAccessProperty(req, existing.id)) return res.status(403).json({ error: 'Not assigned.' });

    const b = req.body || {};
    const fields = [
      'address', 'unitNumber', 'suburb', 'city', 'province', 'postalCode',
      'propertyType', 'bedrooms', 'bathrooms', 'parking', 'floorArea', 'erfNumber',
      'monthlyRentZAR', 'depositZAR', 'rentalStatus', 'askingPriceZAR', 'salesStatus',
      'purpose', 'published', 'managingAgentId', 'photos', 'features', 'notes', 'ownerId',
      'currentLeaseId', 'currentTenantId',
    ];
    for (const f of fields) {
      if (b[f] !== undefined) existing[f] = b[f];
    }
    existing.updatedAt = new Date().toISOString();
    save(dataDir, TYPE, existing.id, existing);
    recordAudit(dataDir, { agentId: req.agentId, agencyId: req.agencyId, action: 'update', entityType: 'property', entityId: existing.id });
    res.json(existing);
  });

  r.delete('/api/properties/:id', requireRole('admin','principal'), (req, res) => {
    const existing = load(dataDir, TYPE, req.params.id);
    if (!existing || existing.agencyId !== req.agencyId) return res.status(404).json({ error: 'Not found.' });
    existing.deleted = true;
    existing.updatedAt = new Date().toISOString();
    save(dataDir, TYPE, existing.id, existing);
    recordAudit(dataDir, { agentId: req.agentId, agencyId: req.agencyId, action: 'delete', entityType: 'property', entityId: existing.id });
    res.json({ ok: true });
  });

  return r;
}
