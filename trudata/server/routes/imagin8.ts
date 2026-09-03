import { Router } from 'express';
import { getStaticInfo, getModels, getValues, regCheck, accidentReport } from '../lib/imagin8';

const router = Router();

// Platform options (environment variables)
function getPlatformOpts() {
  return {
    apiKey: process.env.IMAGIN8_API_KEY as string,
    customerId: process.env.IMAGIN8_CUSTOMER_ID as string,
    userName: process.env.IMAGIN8_USERNAME as string,
    password: process.env.IMAGIN8_PASSWORD as string,
    appName: process.env.IMAGIN8_APP_NAME || 'Flow',
    sandbox: process.env.IMAGIN8_SANDBOX === 'true'
  };
}

// Check configuration before processing any routes
router.use((req, res, next) => {
  const { apiKey, customerId, userName, password } = getPlatformOpts();
  if (!apiKey || !customerId || !userName || !password) {
    return res.status(503).json({ error: 'Imagin8 not configured' });
  }
  next();
});

// API key gating for external consumers
router.use((req, res, next) => {
  if (req.path === '/static' || req.path === '/models') {
    return next();
  }
  // Allow same-origin web UI / development requests
  const isSameOrigin = req.headers['sec-fetch-site'] === 'same-origin' || req.headers['x-trudata-client'] === 'trudata-spa' || process.env.NODE_ENV === 'development';
  if (isSameOrigin) {
    return next();
  }
  const expectedKey = process.env.TRUDATA_API_KEY;
  if (expectedKey) {
    const providedKey = req.headers['x-trudata-key'] || req.query.key;
    if (providedKey !== expectedKey) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
  }
  next();
});

/**
 * GET /api/imagin8/static
 * Free / unlimited flat-fee M&M specs
 */
router.get('/static', async (req, res) => {
  try {
    const { mmCode } = req.query;
    if (!mmCode || typeof mmCode !== 'string') {
      return res.status(400).json({ error: 'Missing mmCode query parameter' });
    }
    const info = await getStaticInfo(mmCode, getPlatformOpts());
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error fetching static info' });
  }
});

/**
 * GET /api/imagin8/models
 * Free / unlimited flat-fee live models search
 */
router.get('/models', async (req, res) => {
  try {
    const { make } = req.query;
    if (!make || typeof make !== 'string') {
      return res.status(400).json({ error: 'Missing make query parameter' });
    }
    const models = await getModels(make, getPlatformOpts());
    res.json(models);
  } catch (err: any) {
    res.status(502).json({ error: 'Failed to load models from TransUnion', details: err.message });
  }
});

/**
 * POST /api/imagin8/valuation
 * TransUnion eValue8 official valuation
 */
router.post('/valuation', async (req, res) => {
  try {
    const { mmCode, year, mileage } = req.body;
    if (!mmCode || !year) {
      return res.status(400).json({ error: 'Missing mmCode or year' });
    }

    try {
      const values = await getValues(mmCode, Number(year), mileage ? Number(mileage) : undefined, getPlatformOpts());
      return res.json(values);
    } catch (apiErr: any) {
      return res.status(502).json({ error: 'TransUnion lookup failed', details: apiErr.message });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error executing TransUnion valuation' });
  }
});

/**
 * POST /api/imagin8/regcheck
 * TransUnion Police Stolen & Bank Finance Interest Verification
 */
router.post('/regcheck', async (req, res) => {
  try {
    const { identifier, type = 'VIN' } = req.body;
    if (!identifier) {
      return res.status(400).json({ error: 'Missing vehicle identifier (VIN or Reg)' });
    }

    try {
      const result = await regCheck(identifier, type as any, getPlatformOpts());
      return res.json(result);
    } catch (apiErr: any) {
      return res.status(502).json({ error: 'TransUnion lookup failed', details: apiErr.message });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error executing RegCheck' });
  }
});

/**
 * POST /api/imagin8/accident-report
 * TransUnion Accident & Insurance Claims History
 */
router.post('/accident-report', async (req, res) => {
  try {
    const { vin } = req.body;
    if (!vin) {
      return res.status(400).json({ error: 'Missing VIN number' });
    }

    try {
      const result = await accidentReport(vin, getPlatformOpts());
      return res.json(result);
    } catch (apiErr: any) {
      return res.status(502).json({ error: 'TransUnion lookup failed', details: apiErr.message });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error executing Accident Report' });
  }
});

export default router;
