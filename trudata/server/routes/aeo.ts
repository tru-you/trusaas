import { Router } from 'express';
import { auditSiteAeo } from '../lib/aeo-checker';
import { burnCredits } from '../lib/credits';

const router = Router();

/**
 * POST /api/aeo/audit
 * AEO & LLM Search Engine Readiness Check (1 Credit)
 * Audits robots.txt AI crawlers, llms.txt, and Schema.org JSON-LD, providing a 1-Click Fix Snippet.
 */
router.post('/audit', async (req, res) => {
  try {
    const { url, userEmail } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing target URL parameter (url)' });
    }

    const email = userEmail || 'guest@trudata.co.za';
    const creditResult = burnCredits(email, 1, `AEO & LLM Search Audit: ${url}`);
    if (!creditResult.success) {
      return res.status(402).json({
        error: 'Insufficient credits',
        required: 1,
        balance: creditResult.balance,
      });
    }

    const audit = await auditSiteAeo(url);
    res.json({
      success: true,
      data: audit,
      wallet: {
        remainingCredits: creditResult.balance,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'AEO Audit failed' });
  }
});

/**
 * POST /api/aeo/preview
 * Free preview AEO Scan (No credits required)
 */
router.post('/preview', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing target URL parameter (url)' });
    }

    const audit = await auditSiteAeo(url);
    res.json({
      success: true,
      preview: {
        domain: audit.domain,
        score: audit.score,
        grade: audit.grade,
        schemaFound: audit.schemaLd.found,
        schemaTypes: audit.schemaLd.schemaTypes,
        llmsTxtFound: audit.llmsTxt.found,
        crawlersAllowed: audit.crawlers.gptBot && audit.crawlers.claudeBot,
        recommendationCount: audit.recommendations.length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'AEO Preview failed' });
  }
});

export default router;
