import { Router } from 'express';
import { fetchValuation, markets } from '../lib/scraper/index';

const router = Router();

/**
 * POST /api/property/comps
 * Live suburb property benchmarks via the housing scraper (Private Property + Property24)
 */
router.post('/comps', async (req, res) => {
  try {
    const { suburb = '', city = '', country = 'za' } = req.body;

    if (!suburb) {
      return res.status(400).json({ error: 'Missing required parameter: suburb' });
    }

    // Use the housing market config with fetchValuation
    // For property, "make" = property type (or suburb), "model" = city area, "year" = current
    const searchTerm = `${suburb} ${city}`.trim();
    const result = await fetchValuation(
      searchTerm,
      'property',
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
    console.error('[PropertyAPI] Error:', err.message);
    res.status(500).json({ error: 'Property valuation query failed' });
  }
});

export default router;

