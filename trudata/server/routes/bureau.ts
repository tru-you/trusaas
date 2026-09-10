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

    const item = API_PRICING_CATALOG['lexisnexis_cipc'];
    const isTruCars = prodType === 'truflow' || prodType === 'trucars' || prodType === 'trulens' || prodType === 'truinspect';
    const retail = isTruCars ? item.wholesaleCost : item.truDataRetailPrice;

    res.json({
      success: true,
      data: result,
      billing: {
        wholesaleCost: item.wholesaleCost,
        markupPct: isTruCars ? 0 : Math.round(((retail - item.wholesaleCost) / item.wholesaleCost) * 100),
        retailPrice: retail,
        marketBenchmarkRetail: item.marketBenchmarkRetail,
        billingCycleCutoff: '25th of month',
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

    const item = API_PRICING_CATALOG['lexisnexis_deeds_property'];
    const isTruCars = prodType === 'truflow' || prodType === 'trucars' || prodType === 'trulens' || prodType === 'truinspect';
    const retail = isTruCars ? item.wholesaleCost : (prodType === 'truproperty' ? item.truPropertyRetailPrice : item.truDataRetailPrice);

    res.json({
      success: true,
      data: result,
      billing: {
        wholesaleCost: item.wholesaleCost,
        markupPct: isTruCars ? 0 : Math.round(((retail - item.wholesaleCost) / item.wholesaleCost) * 100),
        retailPrice: retail,
        marketBenchmarkRetail: item.marketBenchmarkRetail,
        billingCycleCutoff: '25th of month',
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

    const item = API_PRICING_CATALOG['lexisnexis_id_verify'];
    const isTruCars = prodType === 'truflow' || prodType === 'trucars' || prodType === 'trulens' || prodType === 'truinspect';
    const retail = isTruCars ? item.wholesaleCost : item.truDataRetailPrice;

    res.json({
      success: true,
      data: result,
      billing: {
        wholesaleCost: item.wholesaleCost,
        markupPct: isTruCars ? 0 : Math.round(((retail - item.wholesaleCost) / item.wholesaleCost) * 100),
        retailPrice: retail,
        marketBenchmarkRetail: item.marketBenchmarkRetail,
        billingCycleCutoff: '25th of month',
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

export default router;
