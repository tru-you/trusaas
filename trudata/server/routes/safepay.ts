import { Router } from 'express';
import { bankAvs, getImagin8Opts } from '../lib/imagin8';

const router = Router();

// POST /api/safepay/verify — Bank account verification
router.post('/verify', async (req, res) => {
  try {
    const { bankAccount, branchCode, idNumber, initials, surname } = req.body;

    if (!bankAccount || !branchCode || !idNumber) {
      return res.status(400).json({
        error: 'Missing required fields: bankAccount, branchCode, idNumber',
      });
    }

    const opts = getImagin8Opts();
    if (!opts) {
      return res.status(503).json({
        error: 'Bank verification service is not configured. Contact support.',
      });
    }

    const result = await bankAvs(
      bankAccount,
      branchCode,
      idNumber,
      initials || '',
      surname || '',
      opts,
    );

    // Build the 8-point verification summary
    const checks = [
      { label: 'Account Exists', passed: result.accountExists },
      { label: 'Account Open', passed: result.accountOpen },
      { label: 'ID Number Match', passed: result.idMatch },
      { label: 'Name Match', passed: result.nameMatch },
      { label: 'Accepts Credits', passed: result.acceptsCredits },
      { label: 'Accepts Debits', passed: result.acceptsDebits },
      { label: 'Account Age > 3 Months', passed: result.accountAge ? parseInt(result.accountAge) > 3 : false },
      { label: 'Overall Verification', passed: result.valid },
    ];

    const passedCount = checks.filter(c => c.passed).length;

    res.json({
      verified: result.valid,
      score: `${passedCount}/8`,
      checks,
      accountType: result.accountType,
      verifiedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[SafePay] Verification error:', err?.message || err);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

export default router;
