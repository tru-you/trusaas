import { Router } from 'express';
import { agencyForSlug } from '../lib/auth.js';
import { query, save } from '../lib/persist.js';
import { newId } from '../lib/id.js';
import { sanitizeString } from '../lib/validate.js';

/**
 * Anonymous read/insert surface — the wire for agency public websites
 * (prop-website) and lead capture. Only ever touches published rows of one
 * agency, resolved by slug. Never exposes auth data.
 */
export default function publicRoutes(dataDir) {
  const r = Router();

  r.get('/api/prop/public/listings', (req, res) => {
    const agency = agencyForSlug(dataDir, String(req.query.agency || ''));
    if (!agency) return res.json([]);

    const rows = query(dataDir, 'properties', agency.id, p => p.published && !p.deleted);
    res.json(rows.map(p => ({
      id: p.id,
      address: p.address,
      unitNumber: p.unitNumber,
      suburb: p.suburb,
      city: p.city,
      province: p.province,
      postalCode: p.postalCode,
      propertyType: p.propertyType,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      parking: p.parking,
      floorArea: p.floorArea,
      purpose: p.purpose,
      rentalStatus: p.rentalStatus,
      salesStatus: p.salesStatus,
      monthlyRentZAR: p.monthlyRentZAR,
      askingPriceZAR: p.askingPriceZAR,
      photos: p.photos || {},
      features: p.features || [],
    })));
  });

  r.post('/api/prop/webhook/lead', (req, res) => {
    const b = req.body || {};
    const agency = agencyForSlug(dataDir, String(b.agency || ''));
    if (!agency) return res.status(404).json({ ok: false, error: 'Unknown agency.' });

    const name = sanitizeString(b.name, 150);
    const contact = sanitizeString(b.contact || b.phone, 150);
    if (!name || !contact) {
      return res.status(400).json({ ok: false, error: 'name and a contact are required.' });
    }

    const lead = {
      id: newId('interest'),
      agencyId: agency.id,
      propertyId: sanitizeString(b.propertyId, 60) || null,
      name,
      contact,
      email: sanitizeString(b.email, 200) || '',
      message: sanitizeString(b.message, 2000) || '',
      source: sanitizeString(b.source, 60) || 'website',
      status: 'new',
      createdAt: new Date().toISOString(),
    };
    save(dataDir, 'leads', lead.id, lead);
    res.status(201).json({ ok: true, id: lead.id });
  });

  return r;
}