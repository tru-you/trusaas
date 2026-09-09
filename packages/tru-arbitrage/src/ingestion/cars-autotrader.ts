import * as cheerio from 'cheerio';
import { RawFbListing } from '../types';
import { CONFIG } from '../config';
import { fetchHtmlWithFallback } from '../engine/fetch-html';

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export async function fetchCarsCoZaNewest(): Promise<RawFbListing[]> {
  const url = 'https://www.cars.co.za/usedcars/?P=1&sort=date_desc';
  const out: RawFbListing[] = [];

  const html = await fetchHtmlWithFallback(url);
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
          id: `cars_${item.id || item.vehicleId || Buffer.from(item.url || url).toString('base64').slice(0, 16)}`,
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

  const html = await fetchHtmlWithFallback(url);
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
        // Full URL as the id — a base64-prefix slice collides for listing URLs
        // that share a long prefix (the last path segment is the discriminator).
        out.push({
          id: `at_${node.url || node.identifier || Buffer.from(node.url || '').toString('base64').slice(0, 16)}`,
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

  // AutoTrader is a SPA: the JSON-LD pass above usually finds nothing because the
  // result set is in a client-rendered card grid (a[class*=result-tile] with an
  // e-price__ + N-km summary). Fall back to the card scan so the feed isn't empty.
  if (out.length === 0) {
    const seen = new Set<string>();
    $('a[class*="result-tile"], a[class*="listing"]').each((_, el) => {
      const $c = $(el);
      const titleEl = $c.find('[class*="highlight-title"], [class*="result-title"], h2, h3').first();
      const title = (titleEl.length ? titleEl.text() : $c.text()).replace(/\s+/g, ' ').trim();
      if (!title) return;
      
      // Extract price from [class*="price"] or raw text
      const rawPriceText = $c.find('[class*="price"]').first().text() || $c.text();
      const priceMatch = rawPriceText.match(/R\s?(\d{1,3}(?:[ ,]\d{3}){1,2}|\d{5,7})(?!\s?\d)/i);
      const price = priceMatch ? parseInt(priceMatch[1].replace(/[^\d]/g, ''), 10) : null;
      if (price == null || price < CONFIG.MIN_VEHICLE_PRICE) return;

      const odoMatch = $c.text().match(/(\d{1,3}(?:[ ,]\d{3})?)\s?km/i);
      const odo = odoMatch ? parseInt(odoMatch[1].replace(/[\s,]/g, ''), 10) : null;
      const href = $c.attr('href') || '';
      const id = `at_${encodeURIComponent(href || title)}`;
      if (seen.has(id)) return;
      seen.add(id);
      out.push({
        id,
        source: 'autotrader',
        url: href ? (href.startsWith('http') ? href : `https://www.autotrader.co.za${href}`) : url,
        title,
        description: `Mileage: ${odo || 'N/A'} km. AutoTrader`,
        final_price: price,
        price: price,
        currency: 'ZAR',
        location: 'South Africa',
        seller_name: 'AutoTrader Dealer',
        images: [],
        date_posted: new Date().toISOString(),
      });
    });
  }

  return out;
}

export async function fetchAllClassifiedsNewest(): Promise<RawFbListing[]> {
  const [cars, at] = await Promise.all([
    fetchCarsCoZaNewest(),
    fetchAutoTraderNewest(),
  ]);
  return [...cars, ...at];
}
