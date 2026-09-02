import { Router } from 'express';
import { extractDealerProfile } from '../lib/dealer-crm/dealer-extractor';
import { DealerContactProfile, DealerScanResponse } from '../lib/dealer-crm/types';
import { crawlLegacySites } from '../lib/legacy-finder/crawler';

const router = Router();

router.post('/scan', async (req, res) => {
  try {
    const { city = 'Johannesburg', country = 'za', maxResults = 5, candidates = [] } = req.body;
    const cleanCity = String(city).trim();
    const maxDealers = Math.min(10, Math.max(1, Number(maxResults) || 5));

    let dealerCandidates = candidates;

    // If no candidates provided, discover them via SERP (same as agency crawler)
    if (!dealerCandidates.length) {
      const crawlResult = await crawlLegacySites({
        city: cleanCity,
        industry: 'Used Car Dealerships',
        country: country === 'uk' ? 'uk' : 'za',
        maxResults: maxDealers,
      });
      dealerCandidates = (crawlResult.targets || []).map((t: any) => ({
        domain: t.domain,
        name: t.businessName || t.domain,
      }));
    }

    const prospects: DealerContactProfile[] = [];

    for (const candidate of dealerCandidates.slice(0, maxDealers)) {
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
      return res.json({ prospects: [], dealersFound: 0, city: cleanCity, message: 'No dealers found for this search' });
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
