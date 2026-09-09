import { Router } from 'express';
import { extractFromUrl } from '../lib/scraper/universal';
import { getWallet, burnCredits } from '../lib/credits';

const router = Router();

// Free preview or full extraction endpoint (1 Credit for full report)
router.post('/', async (req, res) => {
  try {
    const { url, extractType, targetSelector, maxItems, email } = req.body;

    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: 'Valid URL starting with http:// or https:// is required.' });
    }

    // If an account email is supplied, check/deduct 1 credit for full crawl
    if (email) {
      const wallet = getWallet(String(email));
      if (!wallet || wallet.balance < 1) {
        return res.status(402).json({
          error: 'Insufficient credits. 1 credit required to extract full website data.',
          balance: wallet ? wallet.balance : 0,
        });
      }
      burnCredits(String(email), 'extract');
    }

    const result = await extractFromUrl(url, {
      extractType: extractType || 'all',
      targetSelector: targetSelector ? String(targetSelector) : undefined,
      maxItems: maxItems ? Math.min(100, Math.max(1, Number(maxItems))) : 50,
    });

    if (!result.ok) {
      return res.status(422).json({ error: result.error || 'Failed to extract content from webpage' });
    }

    res.json(result);
  } catch (err: any) {
    console.error('[universal:extract] Error:', err?.message || err);
    res.status(500).json({ error: 'Extraction failed. Please check the URL and try again.' });
  }
});

// Quick free scan preview (zero credits)
router.post('/preview', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: 'Valid URL is required.' });
    }

    const result = await extractFromUrl(url, { maxItems: 3 });
    if (!result.ok) {
      return res.status(422).json({ error: result.error || 'Failed to scan webpage' });
    }

    res.json({
      ok: true,
      url: result.url,
      title: result.title,
      metadata: result.metadata,
      previewCards: result.cards.slice(0, 3),
      totalCardsFound: result.cards.length,
      tablesFound: result.tables.length,
      contacts: {
        phoneCount: result.contacts.phones.length,
        emailCount: result.contacts.emails.length,
        socialCount: result.contacts.socials.length,
      },
      renderMethod: result.renderMethod,
      executionTimeMs: result.executionTimeMs,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Preview scan failed' });
  }
});

export default router;
