import { Router } from 'express';

const router = Router();

// Simple in-memory rate limiting
const sampleLimits = new Map<string, { count: number, date: string }>();

router.post('/', async (req, res) => {
  try {
    const { email, name, product, params } = req.body;

    if (!email || !product) {
      return res.status(400).json({ error: 'Email and product are required' });
    }

    // Rate limiting
    const today = new Date().toISOString().split('T')[0];
    const userLimit = sampleLimits.get(email) || { count: 0, date: today };
    
    if (userLimit.date !== today) {
      userLimit.count = 0;
      userLimit.date = today;
    }

    if (userLimit.count >= 3) {
      return res.status(429).json({ error: 'Daily sample limit reached (3 per day)' });
    }

    userLimit.count += 1;
    sampleLimits.set(email, userLimit);

    // Handle different products
    if (product === 'valuation') {
      // Live valuation using real market-scraper
      const { fetchValuation, markets } = await import('../../../packages/market-scraper/index');
      const result = await fetchValuation(
        String(params?.make || '').trim(),
        String(params?.model || '').trim(),
        String(params?.year || '').trim(),
        {},
        markets.za
      );
      return res.json({
        message: 'Free sample valuation — powered by TruData',
        data: {
          make: params?.make, model: params?.model, year: params?.year,
          median: result.averageRetailPrice,
          count: result.listingsFound,
          confidence: result.listingsFound >= 15 ? 'high' : result.listingsFound >= 5 ? 'medium' : 'low',
          currency: result.currency || 'R',
          sources: result.sources.filter((s: any) => s.count > 0).map((s: any) => s.name),
        }
      });
    } else if (product === 'leads' || product === 'leads_50' || product === 'leads_100') {
      return res.json({
        message: `Sample of 10 verified leads will be emailed to ${email} within 24 hours`
      });
    } else if (product === 'audit') {
      return res.json({
        message: `Sample audit report (5 businesses) will be emailed to ${email} within 24 hours`
      });
    } else {
      return res.status(400).json({ error: 'Invalid product for sample' });
    }

  } catch (error) {
    console.error('Error generating sample:', error);
    res.status(500).json({ error: 'Failed to generate sample' });
  }
});

export default router;
