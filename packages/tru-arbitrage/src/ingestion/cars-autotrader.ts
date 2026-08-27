import axios from 'axios';
import * as cheerio from 'cheerio';
import { RawFbListing } from '../types';
import { CONFIG } from '../config';

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-ZA,en;q=0.9',
  'Cache-Control': 'no-cache',
};

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

async function fetchPageWithUnlockerFallback(url: string): Promise<string | null> {
  try {
    const res = await axios.get(url, { headers: DEFAULT_HEADERS, timeout: CONFIG.SCRAPER_TIMEOUT_MS });
    if (res.status === 200 && typeof res.data === 'string') return res.data;
  } catch (err: any) {
    // If blocked (403) and Bright Data key exists, use Unlocker
    if (CONFIG.BRIGHTDATA_API_KEY) {
      try {
        const bdRes = await axios.post(
          'https://api.brightdata.com/request',
          { zone: CONFIG.BRIGHTDATA_UNLOCKER_ZONE, url, format: 'raw', country: 'za' },
          {
            headers: {
              Authorization: `Bearer ${CONFIG.BRIGHTDATA_API_KEY}`,
              'Content-Type': 'application/json',
            },
            timeout: 25000,
          }
        );
        if (bdRes.status === 200) {
          const raw = bdRes.data;
          if (typeof raw === 'string') {
            if (raw.startsWith('{') || raw.startsWith('[')) {
              try {
                const parsed = JSON.parse(raw);
                return parsed?.body ?? parsed?.html ?? parsed?.result ?? raw;
              } catch {
                return raw;
              }
            }
            return raw;
          }
          if (raw && typeof raw === 'object') {
            return raw.body ?? raw.html ?? raw.result ?? JSON.stringify(raw);
          }
        }
      } catch (bdErr: any) {
        console.warn(`[ingestion] Bright Data Unlocker failed on ${url} (Zone: ${CONFIG.BRIGHTDATA_UNLOCKER_ZONE}):`, bdErr?.response?.data || bdErr?.message || bdErr);
      }
    }
  }
  return null;
}


export async function fetchCarsCoZaNewest(): Promise<RawFbListing[]> {
  const url = 'https://www.cars.co.za/usedcars/?P=1&sort=date_desc';
  const out: RawFbListing[] = [];

  const html = await fetchPageWithUnlockerFallback(url);
  if (!html) return out;

  const $ = cheerio.load(html);
  const script = $('script#__NEXT_DATA__').html();
  if (script) {
    try {
      const json = JSON.parse(script);
      const listings =
        json?.props?.pageProps?.listings ||
        json?.props?.pageProps?.searchResults?.listings ||
        [];

      for (const item of listings) {
        const price = num(item.price || item.priceValue);
        if (!price || price < CONFIG.MIN_VEHICLE_PRICE) continue;

        out.push({
          id: `cars_${item.id || item.vehicleId || Math.random()}`,
          source: 'cars_co_za',
          url: item.url ? (item.url.startsWith('http') ? item.url : `https://www.cars.co.za${item.url}`) : url,
          title: `${item.year || ''} ${item.make || ''} ${item.model || ''} ${item.variant || ''}`.trim(),
          description: item.description || `Mileage: ${item.mileage || 'N/A'} km. Location: ${item.location || 'South Africa'}`,
          final_price: price,
          price: price,
          currency: 'ZAR',
          location: item.location || item.city || item.province || 'South Africa',
          seller_name: item.dealerName || item.sellerName || 'Dealer on Cars.co.za',
          images: item.image ? [item.image] : item.images || [],
          date_posted: item.createdDate || item.dateAdded || new Date().toISOString(),
        });
      }
    } catch {}
  }

  return out;
}

export async function fetchAutoTraderNewest(): Promise<RawFbListing[]> {
  const url = 'https://www.autotrader.co.za/cars-for-sale?sort=Date_Descending';
  const out: RawFbListing[] = [];

  const html = await fetchPageWithUnlockerFallback(url);
  if (!html) return out;

  const $ = cheerio.load(html);
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text() || $(el).text();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed) ? parsed : parsed['@graph'] ? parsed['@graph'] : [parsed];
      for (const node of nodes) {
        const offer = node.offers && (Array.isArray(node.offers) ? node.offers[0] : node.offers);
        const price = num(offer?.price ?? node.price);
        if (!price || price < CONFIG.MIN_VEHICLE_PRICE) continue;

        const odo = num(node.mileageFromOdometer?.value ?? node.mileageFromOdometer);
        out.push({
          id: `at_${node.identifier || Math.random()}`,
          source: 'autotrader',
          url: node.url || url,
          title: node.name || `${node.vehicleModelDate || ''} ${node.brand?.name || ''} ${node.model || ''}`,
          description: `Mileage: ${odo || 'N/A'} km. ${node.description || ''}`,
          final_price: price,
          price: price,
          currency: 'ZAR',
          location: 'South Africa',
          seller_name: 'AutoTrader Dealer',
          images: node.image ? [node.image] : [],
          date_posted: new Date().toISOString(),
        });
      }
    } catch {}
  });

  return out;
}

export async function fetchAllClassifiedsNewest(): Promise<RawFbListing[]> {
  const [cars, at] = await Promise.all([
    fetchCarsCoZaNewest(),
    fetchAutoTraderNewest(),
  ]);
  return [...cars, ...at];
}
