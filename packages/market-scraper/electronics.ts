import { serperSearch } from './serper';

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
  const clean = val.replace(/[^0-9.,]/g, '').trim();
  if (!clean) return null;

  if (clean.includes(',') && clean.includes('.')) {
    if (clean.indexOf(',') < clean.indexOf('.')) {
      const n = parseFloat(clean.replace(/,/g, ''));
      return Number.isFinite(n) ? n : null;
    } else {
      const n = parseFloat(clean.replace(/\./g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    }
  }

  if (clean.includes(',')) {
    const parts = clean.split(',');
    if (parts[1] && parts[1].length === 2) {
      const n = parseFloat(parts[0] + '.' + parts[1]);
      return Number.isFinite(n) ? n : null;
    }
    const n = parseFloat(clean.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  const n = parseFloat(clean);
  return Number.isFinite(n) ? n : null;
}

export async function fetchElectronicsValuation(
  query: string,
  category?: string
): Promise<ElectronicsValuationResult> {
  const searchTerm = `${query.trim()} buy South Africa price`;
  const rawSerper = await serperSearch(searchTerm, { gl: 'za', num: 30 });

  const items: ShoppingItem[] = [];

  const rawShopping = (rawSerper as any)?.shopping || [];
  if (Array.isArray(rawShopping)) {
    for (const s of rawShopping) {
      const p = parsePrice(s.price);
      if (p && p >= 10 && p <= 1_000_000) {
        items.push({
          title: String(s.title || '').trim(),
          price: Math.round(p),
          source: String(s.source || s.merchant || 'Retail Merchant').trim(),
          link: String(s.link || s.url || '#'),
          rating: Number(s.rating) || undefined,
          ratingCount: Number(s.ratingCount) || undefined,
          delivery: String(s.delivery || '').trim() || undefined,
          imageUrl: String(s.imageUrl || s.thumbnail || '').trim() || undefined,
        });
      }
    }
  }

  const organic = (rawSerper as any)?.organic || [];
  if (Array.isArray(organic)) {
    for (const o of organic) {
      const p = parsePrice(o.snippet || o.title);
      if (p && p >= 10 && p <= 1_000_000 && !items.some((i) => i.link === o.link)) {
        let sourceName = 'Google Market';
        try {
          sourceName = new URL(o.link).hostname.replace(/^www\./, '');
        } catch {}

        items.push({
          title: String(o.title || '').trim(),
          price: Math.round(p),
          source: sourceName,
          link: String(o.link || '#'),
        });
      }
    }
  }

  if (items.length === 0) {
    return {
      query,
      category,
      count: 0,
      median: 0,
      low: 0,
      high: 0,
      currency: 'R',
      confidence: 'none',
      sources: [],
      listings: [],
    };
  }

  items.sort((a, b) => a.price - b.price);
  const prices = items.map((i) => i.price);
  const count = prices.length;
  const low = prices[0];
  const high = prices[count - 1];

  let median = 0;
  if (count % 2 === 1) {
    median = prices[Math.floor(count / 2)];
  } else {
    const mid = count / 2;
    median = Math.round((prices[mid - 1] + prices[mid]) / 2);
  }

  const sourceCounts: Record<string, { count: number; total: number }> = {};
  for (const item of items) {
    const src = item.source || 'Other';
    if (!sourceCounts[src]) sourceCounts[src] = { count: 0, total: 0 };
    sourceCounts[src].count++;
    sourceCounts[src].total += item.price;
  }

  const sources = Object.entries(sourceCounts).map(([source, data]) => ({
    source,
    count: data.count,
    avg: Math.round(data.total / data.count),
  }));

  let confidence: 'high' | 'medium' | 'low' | 'none' = 'low';
  if (count >= 8) confidence = 'high';
  else if (count >= 3) confidence = 'medium';

  return {
    query,
    category,
    count,
    median,
    low,
    high,
    currency: 'R',
    confidence,
    sources,
    listings: items.slice(0, 20),
  };
}
