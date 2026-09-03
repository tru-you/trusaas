import { Router } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

// Resolve catalogue directory
const candidates = [
  path.resolve(process.cwd(), 'public', 'catalogue'),
  path.resolve(__dirname, '..', '..', 'public', 'catalogue'),
];
const catalogueDir = candidates.find(p => fs.existsSync(p)) || candidates[0];

// Cache the index in memory on first load
let makeIndex: { name: string; file: string }[] | null = null;
function getMakeIndex(): { name: string; file: string }[] {
  if (!makeIndex) {
    const indexPath = path.join(catalogueDir, 'index.json');
    if (fs.existsSync(indexPath)) {
      makeIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    } else {
      makeIndex = [];
    }
  }
  return makeIndex!;
}

// GET /api/catalogue/makes — list all 312 makes
router.get('/makes', (req, res) => {
  const makes = getMakeIndex().map(m => m.name);
  res.json({ count: makes.length, makes });
});

// GET /api/catalogue/models?make=TOYOTA — list all models for a make
router.get('/models', (req, res) => {
  const makeName = String(req.query.make || '').trim().toUpperCase();
  if (!makeName) return res.status(400).json({ error: 'Missing make parameter' });

  const entry = getMakeIndex().find(m => m.name.toUpperCase() === makeName);
  if (!entry) return res.status(404).json({ error: `Make "${makeName}" not found` });

  const filePath = path.join(catalogueDir, entry.file);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Catalogue file not found' });

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  // data is { modelRange: { variant: { c: mmCode, y: [years] }, ... }, ... }
  const models = Object.entries(data).map(([name, variants]: [string, any]) => {
    const variantEntries = Object.entries(variants) as [string, any][];
    const firstVariant = variantEntries[0]?.[1];
    return {
      name,
      mmCode: firstVariant?.c || '',
      years: firstVariant?.y || [],
    };
  });

  res.json({ make: entry.name, count: models.length, models });
});

// GET /api/catalogue/search?q=hilux — fuzzy search across all makes and models
router.get('/search', (req, res) => {
  const query = String(req.query.q || '').trim().toLowerCase();
  if (!query || query.length < 2) return res.status(400).json({ error: 'Search query must be at least 2 characters' });

  const results: { make: string; model: string; mmCode: string; years: number[] }[] = [];
  const maxResults = 50;

  for (const entry of getMakeIndex()) {
    // Check if make name matches
    const makeMatches = entry.name.toLowerCase().includes(query);
    
    const filePath = path.join(catalogueDir, entry.file);
    if (!fs.existsSync(filePath)) continue;

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      // Structure: { modelRange: { variant: { c: mmCode, y: [years] }, ... }, ... }
      for (const [modelName, variants] of Object.entries(data) as [string, any][]) {
        if (results.length >= maxResults) break;
        if (makeMatches || modelName.toLowerCase().includes(query)) {
          // Get first variant's data as representative
          const variantEntries = Object.entries(variants) as [string, any][];
          const firstVariant = variantEntries[0]?.[1];
          results.push({
            make: entry.name,
            model: modelName,
            mmCode: firstVariant?.c || '',
            years: firstVariant?.y || [],
          });
        }
      }
    } catch {}
    
    if (results.length >= maxResults) break;
  }

  res.json({ query, count: results.length, results });
});

export default router;
