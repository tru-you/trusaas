import { Router } from 'express';
import { agencyForSlug } from '../lib/auth.js';
import { load, query, save } from '../lib/persist.js';
import { newId } from '../lib/id.js';
import { sanitizeString, sanitizeNumber } from '../lib/validate.js';

/**
 * Satellite write surface (PropLens and friends).
 * Protected by the shared FLOWPMS_SYNC_KEY — the same value PropLens sends
 * as x-tru-sync-key. Every property lands inside its agency's portfolio and
 * becomes a published listing unless the satellite says otherwise.
 */
export default function syncRoutes(dataDir) {
  const r = Router();

  r.post('/api/sync/push-photos', (req, res) => {
    const key = process.env.FLOWPMS_SYNC_KEY;
    if (!key) {
      return res.status(503).json({ success: false, error: 'FLOWPMS_SYNC_KEY not set — push unavailable.' });
    }
    if (String(req.headers['x-tru-sync-key'] || '') !== key) {
      return res.status(401).json({ success: false, error: 'Invalid sync key.' });
    }

    const b = req.body || {};
    const agency = agencyForSlug(dataDir, String(b.agencySlug || ''));
    if (!agency) return res.status(404).json({ success: false, error: 'Unknown agency.' });

    const p = b.property && typeof b.property === 'object' ? b.property : {};
    const str = (v, max = 300) => sanitizeString(v, max);

    let existing = null;
    const propId = str(b.propertyId, 60);
    if (propId) {
      existing = load(dataDir, 'properties', propId);
      if (existing && existing.agencyId !== agency.id) existing = null;
    }
    if (!existing && b.listingRef) {
      existing = query(dataDir, 'properties', agency.id, (x) => x.listingRef === str(b.listingRef))[0] || null;
    }

    let created = false;
    let item;
    if (existing) {
      item = existing;
    } else if (b.createIfMissing !== false) {
      item = {
        id: propId || newId('property'),
        agencyId: agency.id,
        createdAt: new Date().toISOString(),
      };
      created = true;
    } else {
      return res.status(409).json({ success: false, created: false, error: 'Property does not exist and createIfMissing is false.' });
    }

    if (p.address) item.address = str(p.address);
    if (p.suburb) item.suburb = str(p.suburb);
    if (p.city) item.city = str(p.city);
    if (p.propertyType) item.propertyType = str(p.propertyType, 40);
    if (p.bedrooms != null) item.bedrooms = sanitizeNumber(p.bedrooms);
    if (p.bathrooms != null) item.bathrooms = sanitizeNumber(p.bathrooms);
    if (p.parkingSpaces != null) item.parkingSpaces = sanitizeNumber(p.parkingSpaces);
    if (p.erfRef) item.erfRef = str(p.erfRef, 80);
    if (p.erfSize != null) item.erfSize = sanitizeNumber(p.erfSize);
    if (p.floorSize != null) item.floorSize = sanitizeNumber(p.floorSize);
    if (p.listingRef) item.listingRef = str(p.listingRef, 60);
    if (p.price != null) item.askingPriceZAR = sanitizeNumber(p.price);
    if (Array.isArray(p.features)) item.features = p.features.map((f) => str(f, 80)).filter(Boolean);
    if (p.description) item.description = String(p.description).slice(0, 2000);
    if (p.inspection) item.inspection = p.inspection;
    if (p.damage) item.damageFindings = p.damage;
    if (p.conditionDeclaration) item.conditionDeclaration = p.conditionDeclaration;
    if (p.slotAssessment) item.slotAssessment = p.slotAssessment;

    const photos = b.photos && typeof b.photos === 'object' ? b.photos : {};
    const merged = { ...(item.photos || {}), ...photos };
    for (const k of Object.keys(merged)) {
      const v = merged[k];
      if (typeof v !== 'string' || v.length < 32) delete merged[k];
    }
    item.photos = merged;
    if (typeof b.showOnWebsite === 'boolean') item.published = b.showOnWebsite;
    else if (created) item.published = true;
    item.status = created ? 'Ready' : item.status || 'Ready';
    item.updatedAt = new Date().toISOString();
    save(dataDir, 'properties', item.id, item);

    const damageCount = Array.isArray(item.damageFindings) ? item.damageFindings.length : 0;
    res.json({
      success: true,
      synced: true,
      created,
      message: `Property ${created ? 'created' : 'updated'} with ${Object.keys(merged).length} photo(s).`,
      property: { id: item.id, listingRef: item.listingRef || null },
      breakdown: {
        mainImages: Object.keys(merged).length,
        extras: 0,
        damage: damageCount,
        total: Object.keys(merged).length,
      },
    });
  });

  return r;
}