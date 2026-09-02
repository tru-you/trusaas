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
