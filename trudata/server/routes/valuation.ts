import { Router } from 'express';
import { fetchValuation, markets } from '../lib/scraper/index';
import type { ValuationResult } from '../lib/scraper/index';

const router = Router();

router.post('/quick', async (req, res) => {
  try {
    const { make, model, year, market: marketCode, mileage } = req.body;

    if (!make || !model || !year) {
      return res.status(400).json({ error: 'Missing required parameters: make, model, year' });
    }

    // Pick market config (default SA)
    const cfg = markets.za;

    const result: ValuationResult = await fetchValuation(
      String(make).trim(),
      String(model).trim(),
      String(year).trim(),
      { mileage: mileage ? Number(mileage) : undefined },
      cfg
    );

    // Build price range from source extremes
    const sourceExtremes = result.sources
      .flatMap(s => [s.min, s.max])
      .filter(val => val != null)
      .sort((a, b) => a! - b!);

    res.json({
      make, model, year,
      median: result.averageRetailPrice,
      low: sourceExtremes.length ? sourceExtremes[0] : result.averageRetailPrice,
      high: sourceExtremes.length ? sourceExtremes[sourceExtremes.length - 1] : result.averageRetailPrice,
      count: result.listingsFound,
      confidence: result.listingsFound >= 15 ? 'high'
                : result.listingsFound >= 5  ? 'medium'
                : result.listingsFound > 0   ? 'low'
                : 'none',
      currency: result.currency || 'R',
      sources: result.sources.filter(s => s.count > 0),
      mileageAdjusted: result.mileageAdjusted || false,
      sampleMedianKm: result.sampleMedianKm,
      fallback: result.fallbackRequired,
      searchUrl: result.searchUrl,
    });
  } catch (error: any) {
    console.error('[trudata:valuation] Error:', error?.message || error);
    res.status(500).json({ error: 'Valuation failed — please try again' });
  }
});

export default router;
