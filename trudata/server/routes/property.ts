import { Router } from 'express';

const router = Router();

/**
 * POST /api/property/comps
 * Live suburb property benchmarks + direct private seller radar
 */
router.post('/comps', async (req, res) => {
  try {
    const { suburb = 'Camps Bay', city = 'Cape Town', country = 'za' } = req.body;
    
    // Try to load real scraper if available
    try {
      const scraper = require('../lib/scraper/markets/housing');
      if (scraper && scraper.getComps) {
        const realData = await scraper.getComps(suburb, city, country);
        if (realData) {
          return res.json(realData);
        }
      }
    } catch (e) {
      // Scraper not available or failed to load
    }

    // No real data available
    return res.json({ 
      noData: true, 
      message: 'Live property data not yet available for this suburb', 
      suburb 
    });

  } catch (err: any) {
    console.error('[PropertyAPI] Error:', err.message);
    res.status(500).json({ error: 'Property valuation query failed' });
  }
});

export default router;
