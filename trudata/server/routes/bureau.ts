import { Router } from 'express';
import { searchCipcCompany, searchDeedsProperty, verifyIdNumber } from '../../../packages/lexisnexis';
import { getMonthlyStatement, API_PRICING_CATALOG } from '../../../packages/billing-ledger';

const router = Router();

/**
 * POST /api/bureau/cipc
 * CIPC Company & Director Search
 */
router.post('/cipc', async (req, res) => {
  try {
    const { query, tenantId, product } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Missing company name or registration number (query)' });
    }

    const tenant = tenantId || (req.headers['x-tenant-id'] as string) || 'trudata-client';
    const prodType = product || 'trudata';
    const result = await searchCipcCompany(query, {
      tenantId: tenant,
      product: prodType,
    });

    res.json({
      success: true,
      data: result,
      billing: {
        creditsBurned: 3,
        service: 'CIPC Company & Director Dossier',
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'CIPC search failed' });
  }
});

/**
 * POST /api/bureau/deeds
 * Deeds Office Property Search
 */
router.post('/deeds', async (req, res) => {
  try {
    const { query, province, tenantId, product } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Missing township or erf query' });
    }

    const tenant = tenantId || (req.headers['x-tenant-id'] as string) || 'trudata-client';
    const prodType = product || 'truproperty';
    const result = await searchDeedsProperty(query, province || 'Gauteng', {
      tenantId: tenant,
      product: prodType,
    });

    res.json({
      success: true,
      data: result,
      billing: {
        creditsBurned: 3,
        service: 'Deeds Office Property Title & Transfer',
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Deeds Office search failed' });
  }
});

/**
 * POST /api/bureau/id-verify
 * Home Affairs SA ID Verification (FICA Check)
 */
router.post('/id-verify', async (req, res) => {
  try {
    const { idNumber, tenantId, product } = req.body;
    if (!idNumber) {
      return res.status(400).json({ error: 'Missing ID number' });
    }

    const tenant = tenantId || (req.headers['x-tenant-id'] as string) || 'trudata-client';
    const prodType = product || 'truflow';
    const result = await verifyIdNumber(idNumber, {
      tenantId: tenant,
      product: prodType,
    });

    res.json({
      success: true,
      data: result,
      billing: {
        creditsBurned: 3,
        service: 'Home Affairs SA ID Verification',
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'ID verification failed' });
  }
});

/**
 * GET /api/bureau/statement
 * Get Monthly API Usage Statement for a Tenant (Due 25th)
 */
router.get('/statement', async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) || (req.headers['x-tenant-id'] as string) || 'trudata-client';
    const cycle = req.query.cycle as string | undefined;

    const statement = getMonthlyStatement(tenantId, cycle);
    res.json(statement);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch statement' });
  }
});

/**
 * POST /api/bureau/regcheck
 * Standalone SAPS Police Stolen & Bank Finance Interest Verification
 */
import { regCheck, accidentReport, getImagin8Opts } from '../lib/imagin8';

router.post('/regcheck', async (req, res) => {
  try {
    const { identifier, type = 'reg' } = req.body;
    if (!identifier || typeof identifier !== 'string') {
      return res.status(400).json({ error: 'Missing vehicle identifier (Registration Number or VIN)' });
    }

    const cleanId = identifier.trim().replace(/\s+/g, '');
    const idType = type.toLowerCase() === 'vin' || cleanId.length === 17 ? 'vin' : 'reg';

    const opts = getImagin8Opts();
    if (!opts) {
      return res.status(503).json({ error: 'Vehicle bureau verification service not configured' });
    }

    const result = await regCheck(cleanId, idType, opts);
    res.json({
      success: true,
      identifier: cleanId,
      type: idType,
      data: result,
      billing: {
        creditsBurned: 3,
        service: 'Vehicle Stolen & Bank Finance Verification',
      },
    });
  } catch (err: any) {
    console.error('[bureau:regcheck] Error:', err);
    res.status(500).json({ error: err.message || 'Vehicle RegCheck failed' });
  }
});

/**
 * POST /api/bureau/accident
 * Standalone Vehicle Insurance Claims & Accident History Report
 */
router.post('/accident', async (req, res) => {
  try {
    const { vin } = req.body;
    if (!vin || typeof vin !== 'string') {
      return res.status(400).json({ error: 'Missing VIN identifier' });
    }

    const cleanVin = vin.trim().toUpperCase().replace(/\s+/g, '');
    const opts = getImagin8Opts();
    if (!opts) {
      return res.status(503).json({ error: 'Accident report service not configured' });
    }

    const result = await accidentReport(cleanVin, opts);
    res.json({
      success: true,
      vin: cleanVin,
      data: result,
      billing: {
        creditsBurned: 3,
        service: 'Vehicle Accident & Insurance Claims History',
      },
    });
  } catch (err: any) {
    console.error('[bureau:accident] Error:', err);
    res.status(500).json({ error: err.message || 'Accident report failed' });
  }
});

export default router;
