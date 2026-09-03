import { Router } from 'express';
import { fetchValuation, markets } from '../lib/scraper/index';
import { extractFsboLeads } from '../lib/scraper/fsbo-extractor';

const router = Router();

/**
 * POST /api/property/comps
 * Live suburb property benchmarks via the housing scraper (Private Property + Property24)
 */
router.post('/comps', async (req, res) => {
  try {
    const { suburb = '', city = '', propertyType = 'property' } = req.body;

    if (!suburb) {
      return res.status(400).json({ error: 'Missing required parameter: suburb' });
    }

    // Use the housing market config with fetchValuation
    // For property, "make" = suburb, "model" = property type, "year" = current
    const searchTerm = `${suburb} ${city}`.trim();
    const typeParam = propertyType && propertyType !== 'Any' ? propertyType : 'property';
    
    const result = await fetchValuation(
      searchTerm,
      typeParam,
      String(new Date().getFullYear()),
      {},
      markets.housingZa
    );

    if (!result.averageRetailPrice && result.listingsFound === 0) {
      return res.json({
        noData: true,
        message: 'No property listings found for this suburb',
        suburb,
        city,
      });
    }

    // Build price range from sources
    const sourceAvgs = result.sources
      .filter(s => s.count > 0 && s.avg != null)
      .map(s => s.avg as number)
      .sort((a, b) => a - b);

    res.json({
      suburb,
      city,
      medianAskingPrice: result.averageRetailPrice,
      low: sourceAvgs.length ? sourceAvgs[0] : result.averageRetailPrice,
      high: sourceAvgs.length ? sourceAvgs[sourceAvgs.length - 1] : result.averageRetailPrice,
      totalActiveListings: result.listingsFound,
      confidence: result.listingsFound >= 15 ? 'high'
                : result.listingsFound >= 5  ? 'medium'
                : result.listingsFound > 0   ? 'low'
                : 'none',
      currency: result.currency || 'R',
      sources: result.sources.filter(s => s.count > 0),
      fallback: result.fallbackRequired,
    });
  } catch (err: any) {
    console.error('[PropertyAPI] Comps error:', err.message);
    res.status(500).json({ error: 'Property valuation query failed' });
  }
});

/**
 * POST /api/property/fsbo
 * Live Direct Private Property Sellers (FSBO) Lead Feed
 */
router.post('/fsbo', async (req, res) => {
  try {
    const { suburb = '', city = '', limit = 8 } = req.body;
    if (!suburb) {
      return res.status(400).json({ error: 'Missing required parameter: suburb' });
    }

    const cleanLimit = Math.min(25, Math.max(1, Number(limit) || 8));
    const result = await extractFsboLeads(String(suburb).trim(), String(city).trim(), cleanLimit);

    if (result.count === 0) {
      return res.json({
        suburb: result.suburb,
        city: result.city,
        count: 0,
        leads: [],
        message: 'No private sellers found in this area at this time.',
        scannedAt: result.scannedAt
      });
    }

    res.json(result);
  } catch (err: any) {
    console.error('[PropertyAPI] FSBO error:', err?.message || err);
    res.status(500).json({ error: 'Failed to extract private seller leads' });
  }
});

export default router;

