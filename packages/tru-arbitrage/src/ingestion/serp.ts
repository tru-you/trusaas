import axios from 'axios';
import { RawFbListing } from '../types';
import { CONFIG } from '../config';

const PRICE_SCAN_RE = /R\s?(\d{1,3}(?:[ ,]\d{3})+|\d{5,7})/i;

function extractPrice(text: string): number | null {
  const m = text.match(PRICE_SCAN_RE);
  if (!m) return null;
  const val = parseInt(m[1].replace(/[^\d]/g, ''), 10);
  return val >= CONFIG.MIN_VEHICLE_PRICE && val <= CONFIG.MAX_VEHICLE_PRICE ? val : null;
}

export async function fetchDealerWebsitesViaSerp(query?: string): Promise<RawFbListing[]> {
  if (!CONFIG.SERP_API_KEY) {
    console.log('[serp-ingestion] No SERP_API_KEY configured, skipping Google SERP dealer scrape.');
    return [];
  }

  const q = query || 'site:*.co.za "used cars" "for sale" "Johannesburg" price R';
  const out: RawFbListing[] = [];

  try {
    let json: any = null;

    if (CONFIG.SERP_PROVIDER === 'brightdata') {
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(q)}&gl=za&hl=en&num=20&brd_json=1`;
      const res = await axios.post(
        CONFIG.SERP_API_URL || 'https://api.brightdata.com/request',
        { zone: CONFIG.SERP_ZONE, url: googleUrl, format: 'raw' },
        {
          headers: {
            Authorization: `Bearer ${CONFIG.SERP_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: CONFIG.SERP_TIMEOUT_MS,
        }
      );
      if (res.status === 200) {
        json = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      }
    } else {

      // SerpApi fallback
      const base = CONFIG.SERP_API_URL || 'https://serpapi.com/search.json';
      const url = `${base}?engine=google&google_domain=google.co.za&gl=za&hl=en&num=30&q=${encodeURIComponent(
        q
      )}&api_key=${encodeURIComponent(CONFIG.SERP_API_KEY)}`;
      const res = await axios.get(url, { timeout: CONFIG.SERP_TIMEOUT_MS });
      json = res.data;
    }

    const organic = json?.organic_results || json?.organic || [];
    for (const r of Array.isArray(organic) ? organic : []) {
      const title = String(r?.title || '');
      const snippet = String(r?.snippet || r?.description || '');
      const combined = `${title} ${snippet}`;
      const price = r?.extracted_price || extractPrice(combined);
      const link = r?.link || r?.url;

      if (!price || !link || link.includes('google.') || link.includes('youtube.')) continue;

      let hostname = 'unknown';
      try { hostname = new URL(link).hostname.replace('www.', ''); } catch {}

      out.push({
        id: `serp_${Buffer.from(link).toString('base64').slice(0, 16)}`,
        source: 'dealer_direct',
        url: link,
        title,
        description: snippet,
        final_price: price,
        price,
        currency: 'ZAR',
        location: snippet.includes('Cape Town') ? 'Cape Town' : snippet.includes('Pretoria') ? 'Pretoria' : 'Johannesburg, Gauteng',
        seller_name: hostname,
        images: [],
        date_posted: new Date().toISOString(),
      });
    }
  } catch (err: any) {
    const detail = err?.response?.data ? JSON.stringify(err.response.data) : (err?.message || err);
    console.warn('[serp-ingestion] Google SERP query failed:', detail);
  }

  return out;
}
