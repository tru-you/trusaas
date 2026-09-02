import { Router } from 'express';
import { extractDealerProfile } from '../lib/dealer-crm/dealer-extractor';
import { DealerContactProfile, DealerScanResponse } from '../lib/dealer-crm/types';

const router = Router();

router.post('/scan', async (req, res) => {
  try {
    const { city = 'Johannesburg', country = 'za', maxDealers = 5, candidates = [] } = req.body;
    const cleanCity = String(city).trim();

    const prospects: DealerContactProfile[] = [];

    for (const candidate of candidates.slice(0, Number(maxDealers) || 5)) {
      try {
        const profile = await extractDealerProfile(candidate.domain, candidate.name, cleanCity, country === 'uk' ? 'uk' : 'za');
        if (profile) {
          prospects.push(profile);
        }
      } catch (e) {
        console.warn(`[DealerCRM] Error inspecting ${candidate.domain}:`, e);
      }
    }

    if (prospects.length === 0) {
      return res.json({ results: [], message: 'No dealers found for this search' });
    }

    const response: DealerScanResponse = {
      city: cleanCity,
      country: country === 'uk' ? 'uk' : 'za',
      dealersFound: prospects.length,
      prospects,
      scannedAt: new Date().toISOString()
    };

    res.json(response);
  } catch (err: any) {
    console.error('[DealerCRM] Scan error:', err);
    res.status(500).json({ error: err.message || 'Failed to scan dealers' });
  }
});

export default router;
