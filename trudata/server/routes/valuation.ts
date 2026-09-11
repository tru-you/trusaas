import { Router } from 'express';
import { fetchValuation, markets } from '../lib/scraper/index';
import type { ValuationResult } from '../lib/scraper/index';
import { getStaticInfo, getImagin8Opts, type StaticInfo } from '../lib/imagin8';

const router = Router();

router.post('/quick', async (req, res) => {
  try {
    const { make, model, variant, year, market: marketCode, mileage, mmCode } = req.body;

    if (!make || !model || !year) {
      return res.status(400).json({ error: 'Missing required parameters: make, model, year' });
    }

    // Pick market config (default SA)
    const cfg = markets.za;

    // Use clean base model for classifieds search (fallback to modelCore if noisy)
    const rawModel = String(model).trim();
    const cleanModel = rawModel.includes(' ') && rawModel.length > 15 
      ? (rawModel.split(' ')[0] || rawModel) 
      : rawModel;

    // Run scraper and static specs in parallel
    const opts = getImagin8Opts();
    const staticPromise: Promise<StaticInfo | null> = (mmCode && opts) 
      ? getStaticInfo(String(mmCode).trim(), opts).catch(() => null) 
      : Promise.resolve(null);

    const [result, specs] = await Promise.all([
      fetchValuation(
        String(make).trim(),
        cleanModel,
        String(year).trim(),
        { mileage: mileage ? Number(mileage) : undefined },
        cfg
      ),
      staticPromise,
    ]);

    res.json({
      make, model, variant: variant || undefined, year, mmCode: mmCode || undefined,
      median: result.averageRetailPrice,
      low: result.priceRange?.low || result.averageRetailPrice,
      high: result.priceRange?.high || result.averageRetailPrice,
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
      listings: result.listings || [],
      specs: specs ? {
        kw: specs.kw,
        cc: specs.cc,
        cylinders: specs.cylinders,
        doors: specs.doors,
        seats: specs.seats,
        bodyType: specs.bodyType,
        fuelType: specs.fuelType,
        fuelTankSize: specs.fuelTankSize,
        tare: specs.tare,
        gvm: specs.gvm,
        co2: specs.co2,
        introDate: specs.introDate,
        disconDate: specs.disconDate,
        vehicleType: specs.vehicleType,
      } : null,
    });
  } catch (error: any) {
    console.error('[trudata:valuation] Error:', error?.message || error);
    res.status(500).json({ error: 'Valuation failed — please try again' });
  }
});

export default router;
