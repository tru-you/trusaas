import { Router } from 'express';
import { serperSearch } from '../lib/serper';

const router = Router();

export interface ShoppingItem {
  title: string;
  price: number;
  source: string;
  link: string;
  rating?: number;
  ratingCount?: number;
  delivery?: string;
  imageUrl?: string;
}

export interface ElectronicsValuationResult {
  query: string;
  category?: string;
  count: number;
  median: number;
  low: number;
  high: number;
  currency: string;
  confidence: 'high' | 'medium' | 'low' | 'none';
  sources: { source: string; count: number; avg: number }[];
  listings: ShoppingItem[];
}

function parsePrice(val: any): number | null {
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (!val || typeof val !== 'string') return null;
  // Match digits with optional comma/dot decimals e.g. "R 12,397.00" or "R 12 397,00"
  const clean = val.replace(/[^0-9.,]/g, '').trim();
  if (!clean) return null;

  // If contains comma and dot, e.g. 12,397.00 or 12.397,00
  if (clean.includes(',') && clean.includes('.')) {
    if (clean.indexOf(',') < clean.indexOf('.')) {
      // 12,397.00
      const n = parseFloat(clean.replace(/,/g, ''));
      return Number.isFinite(n) ? n : null;
    } else {
      // 12.397,00
      const n = parseFloat(clean.replace(/\./g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    }
  }

  // If only comma: in SA "12 397,00" or "12,999"
  if (clean.includes(',')) {
    const parts = clean.split(',');
    if (parts[parts.length - 1].length === 2) {
      // decimal comma e.g. 12397,50
      const n = parseFloat(parts.slice(0, -1).join('') + '.' + parts[parts.length - 1]);
      return Number.isFinite(n) ? n : null;
    }
    const n = parseFloat(clean.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  const n = parseFloat(clean);
  return Number.isFinite(n) ? n : null;
}

// POST /api/electronics/valuation
router.post('/valuation', async (req, res) => {
  try {
    const { query, category } = req.body;
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return res.status(400).json({ error: 'Missing or invalid query parameter' });
    }

    const cleanQuery = query.trim();
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'Valuation search service not configured' });
    }

    const items: ShoppingItem[] = [];

    // 1. Query Serper Google Shopping for South Africa
    try {
      const shopRes = await fetch('https://google.serper.dev/shopping', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: cleanQuery,
          gl: 'za',
          hl: 'en',
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (shopRes.ok) {
        const shopJson = await shopRes.json();
        const rawItems = shopJson.shopping || [];
        for (const item of rawItems) {
          const price = parsePrice(item.price);
          if (price && price > 50 && price < 1_000_000) {
            items.push({
              title: item.title || cleanQuery,
              price: Math.round(price),
              source: item.source || 'Online Store',
              link: item.link || '',
              rating: item.rating ? Number(item.rating) : undefined,
              ratingCount: item.ratingCount ? Number(item.ratingCount) : undefined,
              delivery: item.delivery || undefined,
              imageUrl: item.imageUrl || undefined,
            });
          }
        }
      }
    } catch (err: any) {
      console.warn('[ElectronicsAPI] Shopping search fallback to organic:', err.message);
    }

    // 2. Fallback / supplement with Organic search if few shopping results
    if (items.length < 5) {
      try {
        const serp = await serperSearch(`${cleanQuery} price South Africa takealot OR incredible OR makro`, {
          gl: 'za',
          hl: 'en',
          num: 15,
        });

        for (const org of serp.organic) {
          const text = `${org.title} ${org.snippet}`;
          // Look for price patterns e.g. R 12,999 or R14999
          const priceMatch = text.match(/R\s?([0-9]{1,3}(?:[ ,][0-9]{3})*(?:\.[0-9]{2})?|[0-9]{3,7})/i);
          if (priceMatch) {
            const p = parsePrice(priceMatch[1]);
            if (p && p > 50 && p < 1_000_000) {
              let domain = 'Google Search';
              try {
                domain = new URL(org.link).hostname.replace(/^www\./, '');
              } catch {}
              items.push({
                title: org.title,
                price: Math.round(p),
                source: domain,
                link: org.link,
              });
            }
          }
        }
      } catch (err: any) {
        console.warn('[ElectronicsAPI] Organic price extraction error:', err.message);
      }
    }

    if (!items.length) {
      return res.json({
        query: cleanQuery,
        category,
        count: 0,
        median: 0,
        low: 0,
        high: 0,
        currency: 'R',
        confidence: 'none',
        sources: [],
        listings: [],
        message: 'No live prices found for this item.',
      });
    }

    // Deduplicate & sort prices
    const prices = items.map(i => i.price).sort((a, b) => a - b);
    
    // Filter extreme outliers: trim bottom 5% and top 5% if sample > 8
    let trimmedPrices = prices;
    if (prices.length >= 8) {
      const trimCount = Math.floor(prices.length * 0.08);
      trimmedPrices = prices.slice(trimCount, prices.length - trimCount);
    }

    const midIdx = Math.floor(trimmedPrices.length / 2);
    const median = trimmedPrices.length % 2 === 0
      ? Math.round((trimmedPrices[midIdx - 1] + trimmedPrices[midIdx]) / 2)
      : trimmedPrices[midIdx];

    const low = trimmedPrices[0];
    const high = trimmedPrices[trimmedPrices.length - 1];

    // Source aggregations
    const sourceMap: Record<string, { count: number; sum: number }> = {};
    for (const item of items) {
      const s = item.source || 'Other';
      if (!sourceMap[s]) sourceMap[s] = { count: 0, sum: 0 };
      sourceMap[s].count++;
      sourceMap[s].sum += item.price;
    }

    const sources = Object.entries(sourceMap).map(([source, stats]) => ({
      source,
      count: stats.count,
      avg: Math.round(stats.sum / stats.count),
    })).sort((a, b) => b.count - a.count);

    const confidence = items.length >= 15 ? 'high'
                     : items.length >= 5  ? 'medium'
                     : 'low';

    const result: ElectronicsValuationResult = {
      query: cleanQuery,
      category,
      count: items.length,
      median,
      low,
      high,
      currency: 'R',
      confidence,
      sources,
      listings: items.slice(0, 20), // Top 20 listings
    };

    res.json(result);
  } catch (error: any) {
    console.error('[ElectronicsAPI] Valuation error:', error?.message || error);
    res.status(500).json({ error: 'Failed to value electronics asset' });
  }
});

export default router;
