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

// Vertical make classifications
const MOTO_MAKES = new Set([
  'APRILIA', 'ARCTIC CAT', 'BAJAJ', 'BB QUADS', 'BENNELLI', 'BETA RACING', 'BIG BOY', 'BIMOTA',
  'BMW', 'BOMBARDIERCANAM', 'BUYANG', 'CAGIVA', 'CLEVELAND', 'CSR', 'DAELIM', 'DAYUN', 'DAZON',
  'DERBI', 'DINLI', 'DUCATI', 'EBR', 'ELECTRIC MOTION', 'GAS GAS', 'GOES', 'GOMOTO',
  'HARLEY DAVIDSON', 'HARTFORD', 'HDZT', 'HONDA', 'HUNTER', 'HUSABERG', 'HUSQVARNA', 'HYOSUNG',
  'INDIAN', 'JAWA', 'JIALING', 'JIANSHE', 'JOHNNY PAG', 'JONWAY', 'KAWASAKI', 'KAZUMA',
  'KIDEN', 'KINETIC', 'KTM', 'KYMCO', 'LAMBRETTA', 'LAVERDA', 'LIFAN', 'LINHAI', 'LML',
  'LONCIN', 'MASAI', 'MOTO GUZZI', 'MOTO PRO', 'MOTOMIA', 'MUTT', 'MV AGUSTA', 'MZ',
  'Multiple Motorcycle Manufacturers', 'PGO', 'PIAGGIO', 'POLARIS', 'PUZEY', 'QINGQI', 'QUADRO',
  'RADICAL RIDES', 'RAIDER', 'REGARD', 'RETROQUAD', 'ROYAL ENFIELD', 'SECMA', 'SHERCO', 'SHINERAY',
  'SKYGO', 'SMC', 'STUD', 'SUMOTO', 'SUZUKI', 'SWM', 'SYM', 'TGB', 'TM RACING', 'TRIUMPH',
  'TVS', 'URAL', 'VBA', 'VESPA', 'VICTORY', 'VOR', 'VUKA', 'WARRIOR', 'X-MOTO', 'XINGYUE',
  'YAMAHA', 'YAMOTO', 'ZAHOW', 'ZERO', 'ZHEJIANG CF MOTO', 'ZHEJIANG LEIKE', 'ZHEJIANG RENLI',
  'ZHEJIANG RIYA', 'ZIPPER', 'ZONGSHEN', 'ZONTES'
]);

const TRUCK_MAKES = new Set([
  'ASHOK LEYLAND', 'BELL', 'CATERPILLAR', 'CNHTC', 'D A F', 'DONGFENG', 'E R F', 'EICHER',
  'FAW', 'FOTON', 'FREIGHTLINER', 'FUSO', 'GOLDEN DRAGON', 'HINO', 'INTERNATIONAL', 'ISUZU',
  'IVECO', 'JAC', 'JMC', 'KINGLONG', 'LEYLAND', 'M A N', 'MACK', 'MERCEDES-BENZ', 'NISSAN',
  'PETERBILT', 'POWERSTAR', 'SAMAG', 'SCANIA', 'SHACMAN', 'TATA', 'UD TRUCKS', 'US TRUCK',
  'VOLVO', 'WESTERN STAR'
]);

const AG_PLANT_MAKES = new Set([
  'AGCO ALLIS (AGROTEC)', 'AGRIA', 'AGRIA-DEUTZ', 'AGRICO', 'BELARUS', 'BELL', 'BLACKWOOD HODGE',
  'CASE INTERNATIONAL', 'CATERPILLAR', 'CHALLENGER', 'CLAAS', 'DEUTZ FAHR', 'FARMTRAC', 'INDOTRAC',
  'JINMA', 'JOHN DEERE', 'KIOTI', 'KUBOTA', 'LANDINI', 'MASSEY FERGUSON', 'McCORMICK', 'NEW HOLLAND',
  'S.A.M.E.', 'SONALIKA', 'TAFE', 'URSUS', 'VALTRA (VALMET)', 'VST', 'WHITE OLIVER', 'YANMAR', 'YTO'
]);

// GET /api/catalogue/makes — list makes (with optional vertical filter)
router.get('/makes', (req, res) => {
  const vertical = String(req.query.vertical || 'cars').toLowerCase().trim();
  const allEntries = getMakeIndex();
  
  let filtered = allEntries;
  if (vertical === 'moto' || vertical === 'motorcycles') {
    filtered = allEntries.filter(m => MOTO_MAKES.has(m.name.toUpperCase().trim()));
  } else if (vertical === 'trucks' || vertical === 'commercial') {
    filtered = allEntries.filter(m => TRUCK_MAKES.has(m.name.toUpperCase().trim()));
  } else if (vertical === 'marine' || vertical === 'boats') {
    // Specialty marine entries
    filtered = allEntries.filter(m => m.name.toUpperCase() === 'SPECIALTY' || m.name.toUpperCase() === 'YAMAHA' || m.name.toUpperCase() === 'HONDA' || m.name.toUpperCase() === 'SUZUKI');
  } else if (vertical === 'caravans' || vertical === 'trailers') {
    filtered = allEntries.filter(m => m.name.toUpperCase() === 'SPECIALTY');
  } else if (vertical === 'yellowmetal' || vertical === 'agri') {
    filtered = allEntries.filter(m => AG_PLANT_MAKES.has(m.name.toUpperCase().trim()) || m.name.toUpperCase() === 'SPECIALTY');
  } else {
    // Default cars: filter out pure heavy ag tractors unless they also make passenger vehicles
    filtered = allEntries.filter(m => !AG_PLANT_MAKES.has(m.name.toUpperCase().trim()) || ['BMW', 'HONDA', 'SUZUKI'].includes(m.name.toUpperCase().trim()));
  }

  res.json({ count: filtered.length, vertical, makes: filtered.map(m => ({ name: m.name, file: m.file })) });
});

// GET /api/catalogue/models?make=TOYOTA&vertical=cars — list all models for a make
const SPECIALTY_MAP: Record<string, string[]> = {
  marine: ['BOAT/JETSKI'],
  boats: ['BOAT/JETSKI'],
  caravans: ['CARAVAN', 'TRAILER'],
  trailers: ['CARAVAN', 'TRAILER'],
  yellowmetal: ['YELLOW METAL', 'GENERATOR', 'GOLF CART'],
  agri: ['YELLOW METAL', 'GENERATOR'],
  moto: ['BICYCLE'],
  motorcycles: ['BICYCLE'],
};

router.get('/models', (req, res) => {
  const makeName = String(req.query.make || '').trim().toUpperCase();
  const vertical = String(req.query.vertical || '').trim().toLowerCase();
  if (!makeName) return res.status(400).json({ error: 'Missing make parameter' });

  const entry = getMakeIndex().find(m => m.name.toUpperCase() === makeName);
  if (!entry) return res.status(404).json({ error: `Make "${makeName}" not found` });

  const filePath = path.join(catalogueDir, entry.file);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Catalogue file not found' });

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  // data is { modelRange: { variant: { c: mmCode, y: [years] }, ... }, ... }
  let entries = Object.entries(data);
  if (entry.name === 'SPECIALTY' && vertical && SPECIALTY_MAP[vertical]) {
    const allowed = SPECIALTY_MAP[vertical];
    entries = entries.filter(([name]) => allowed.includes(name));
  }

  const models = entries.map(([name, variants]: [string, any]) => {
    const variantEntries = Object.entries(variants) as [string, any][];
    const firstVariant = variantEntries[0]?.[1];
    return {
      name,
      mmCode: firstVariant?.c || '',
      years: firstVariant?.y || [],
    };
  });

  res.json({ make: entry.name, vertical: vertical || undefined, count: models.length, models });
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
