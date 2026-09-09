import axios from 'axios';
import * as cheerio from 'cheerio';
import { renderViaWorker, renderViaUnlocker } from './engine';
import { extractPhones, extractEmails } from '../legacy-finder/contacts';

export interface UniversalExtractOptions {
  extractType?: 'all' | 'cards' | 'tables' | 'contacts' | 'jsonld';
  targetSelector?: string;
  maxItems?: number;
  useAi?: boolean;
  timeoutMs?: number;
}

export interface ExtractedCard {
  title?: string;
  price?: number | null;
  priceFormatted?: string;
  link?: string;
  image?: string;
  description?: string;
  badge?: string;
  metadata?: Record<string, string>;
}

export interface ExtractedTable {
  headers: string[];
  rows: Record<string, string>[];
}

export interface UniversalExtractResult {
  ok: boolean;
  url: string;
  title: string;
  renderMethod: 'worker' | 'unlocker' | 'http';
  executionTimeMs: number;
  metadata: {
    title: string;
    description?: string;
    canonical?: string;
    ogImage?: string;
    siteName?: string;
    favicon?: string;
  };
  cards: ExtractedCard[];
  tables: ExtractedTable[];
  contacts: {
    phones: string[];
    emails: string[];
    socials: { platform: string; url: string }[];
  };
  jsonLd: any[];
  error?: string;
}

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-ZA,en-GB,en;q=0.9',
  'Cache-Control': 'no-cache',
};

// SSRF Safety Check
function isSafeUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function resolveUrl(base: string, relative?: string): string | undefined {
  if (!relative) return undefined;
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

/**
 * Universal Web Extraction Engine (Browse.ai Parity)
 * Turns any URL into structured data: cards, tables, prices, contacts, and metadata.
 */
export async function extractFromUrl(
  targetUrl: string,
  options: UniversalExtractOptions = {}
): Promise<UniversalExtractResult> {
  const startTs = Date.now();
  const trimmedUrl = String(targetUrl || '').trim();

  if (!isSafeUrl(trimmedUrl)) {
    return {
      ok: false,
      url: trimmedUrl,
      title: '',
      renderMethod: 'http',
      executionTimeMs: 0,
      metadata: { title: '' },
      cards: [],
      tables: [],
      contacts: { phones: [], emails: [], socials: [] },
      jsonLd: [],
      error: 'Invalid or forbidden URL. Only public HTTP/HTTPS URLs are supported.',
    };
  }

  let html: string | null = null;
  let renderMethod: 'worker' | 'unlocker' | 'http' = 'http';

  // 1. Try Dedicated Hetzner Headless Worker (scraper.tru-saas.com)
  try {
    html = await renderViaWorker(trimmedUrl, options.timeoutMs || 20000);
    if (html && html.length > 300) {
      renderMethod = 'worker';
    }
  } catch (err: any) {
    console.warn(`[universal] worker render error for ${trimmedUrl}:`, err?.message);
  }

  // 2. Fallback to Bright Data Unlocker (if available and worker didn't succeed)
  if (!html) {
    try {
      html = await renderViaUnlocker(trimmedUrl, 'za', options.timeoutMs || 15000);
      if (html && html.length > 300) {
        renderMethod = 'unlocker';
      }
    } catch (err: any) {
      console.warn(`[universal] unlocker render error for ${trimmedUrl}:`, err?.message);
    }
  }

  // 3. Fallback to direct HTTP fetch
  if (!html) {
    try {
      const res = await axios.get(trimmedUrl, {
        headers: DEFAULT_HEADERS,
        timeout: options.timeoutMs || 10000,
        maxRedirects: 5,
      });
      html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      renderMethod = 'http';
    } catch (err: any) {
      return {
        ok: false,
        url: trimmedUrl,
        title: '',
        renderMethod,
        executionTimeMs: Date.now() - startTs,
        metadata: { title: '' },
        cards: [],
        tables: [],
        contacts: { phones: [], emails: [], socials: [] },
        jsonLd: [],
        error: `Could not fetch webpage: ${err?.message || err}`,
      };
    }
  }

  const $ = cheerio.load(html);

  // A. Extract Page Metadata
  const pageTitle = $('title').first().text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    $('h1').first().text().trim() ||
    trimmedUrl;

  const description = $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    undefined;

  const canonical = $('link[rel="canonical"]').attr('href') || trimmedUrl;
  const ogImage = resolveUrl(trimmedUrl, $('meta[property="og:image"]').attr('content'));
  const siteName = $('meta[property="og:site_name"]').attr('content');
  const favicon = resolveUrl(trimmedUrl, $('link[rel*="icon"]').attr('href'));

  // B. Extract JSON-LD Blocks
  const jsonLd: any[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).contents().text() || $(el).text();
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) jsonLd.push(...parsed);
        else jsonLd.push(parsed);
      }
    } catch {}
  });

  // C. Extract Semantic Cards / Repeating Items (Browse.ai Core)
  const cards: ExtractedCard[] = [];
  const maxItems = options.maxItems || 50;

  // Potential card container selectors
  const cardSelectors = options.targetSelector
    ? [options.targetSelector]
    : [
        'article',
        '[class*="card"]',
        '[class*="product"]',
        '[class*="listing"]',
        '[class*="tile"]',
        '[class*="result-item"]',
        '[class*="item-card"]',
        'li[class*="item"]',
        'li[class*="product"]',
        'div[data-testid*="product"]',
        'div[data-testid*="card"]',
      ];

  const priceRegex = /(?:R|\$|£|€)\s?([0-9]{1,3}(?:[ ,][0-9]{3})+|[0-9]{2,7})/i;

  for (const selector of cardSelectors) {
    const elements = $(selector);
    if (elements.length >= 2) {
      elements.each((_, el) => {
        if (cards.length >= maxItems) return;
        const $el = $(el);
        const text = $el.text().replace(/\s+/g, ' ').trim();
        if (text.length < 8) return;

        // Title: find heading or prominent anchor
        const titleEl = $el.find('h1, h2, h3, h4, h5, [class*="title"], [class*="name"]').first();
        const title = titleEl.text().trim() || $el.find('a').first().text().trim();
        if (!title || title.length < 3) return;

        // Link
        const rawLink = $el.is('a') ? $el.attr('href') : $el.find('a').first().attr('href');
        const link = resolveUrl(trimmedUrl, rawLink);

        // Image
        const imgEl = $el.find('img').first();
        const rawImg = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-lazy-src');
        const image = resolveUrl(trimmedUrl, rawImg);

        // Price
        let price: number | null = null;
        let priceFormatted: string | undefined = undefined;
        const priceMatch = text.match(priceRegex);
        if (priceMatch) {
          priceFormatted = priceMatch[0].trim();
          const cleanNum = parseFloat(priceMatch[1].replace(/[^\d.]/g, ''));
          if (Number.isFinite(cleanNum)) price = cleanNum;
        }

        // Badge / Tag
        const badgeEl = $el.find('[class*="badge"], [class*="tag"], [class*="label"]').first();
        const badge = badgeEl.length ? badgeEl.text().trim() : undefined;

        // Snippet description
        const pEl = $el.find('p, [class*="desc"], [class*="snippet"]').first();
        const description = pEl.length ? pEl.text().trim().slice(0, 200) : undefined;

        cards.push({
          title: title.slice(0, 150),
          price,
          priceFormatted,
          link,
          image,
          description,
          badge,
        });
      });

      if (cards.length >= 2) break; // Found strong repeating structure
    }
  }

  // D. Extract Tables
  const tables: ExtractedTable[] = [];
  $('table').each((_, tbl) => {
    const $tbl = $(tbl);
    const headers: string[] = [];
    $tbl.find('thead th, tr th').each((i, th) => {
      const hText = $(th).text().trim() || `Column ${i + 1}`;
      headers.push(hText);
    });

    const rows: Record<string, string>[] = [];
    $tbl.find('tbody tr, tr').each((_, tr) => {
      const cells: string[] = [];
      $(tr).find('td').each((_, td) => {
        cells.push($(td).text().trim());
      });
      if (cells.length > 0) {
        const rowObj: Record<string, string> = {};
        cells.forEach((cell, idx) => {
          const colKey = headers[idx] || `col_${idx + 1}`;
          rowObj[colKey] = cell;
        });
        rows.push(rowObj);
      }
    });

    if (rows && rows.length > 0) {
      tables.push({ headers, rows: rows.slice(0, 100) });
    }
  });

  // E. Extract Contact & Social Information
  const fullText = $('body').text().replace(/\s+/g, ' ');
  const rawHtml = $('body').html() || '';
  const phones = extractPhones(fullText, rawHtml);
  const emails = extractEmails(fullText, rawHtml);

  // Social Links
  const socials: { platform: string; url: string }[] = [];
  const socialPatterns = [
    { platform: 'LinkedIn', regex: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-z0-9_\-]+/i },
    { platform: 'Facebook', regex: /https?:\/\/(?:www\.)?facebook\.com\/[a-z0-9_\-\.]+/i },
    { platform: 'Instagram', regex: /https?:\/\/(?:www\.)?instagram\.com\/[a-z0-9_\-\.]+/i },
    { platform: 'Twitter/X', regex: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[a-z0-9_]+/i },
    { platform: 'YouTube', regex: /https?:\/\/(?:www\.)?youtube\.com\/(?:@|channel|user)\/[a-z0-9_\-]+/i },
    { platform: 'WhatsApp', regex: /https?:\/\/(?:api\.whatsapp\.com|wa\.me)\/[0-9]+/i },
  ];

  $('a[href]').each((_, a) => {
    const href = $(a).attr('href') || '';
    for (const s of socialPatterns) {
      if (s.regex.test(href) && !socials.some(item => item.url === href)) {
        socials.push({ platform: s.platform, url: href });
      }
    }
  });

  return {
    ok: true,
    url: trimmedUrl,
    title: pageTitle,
    renderMethod,
    executionTimeMs: Date.now() - startTs,
    metadata: {
      title: pageTitle,
      description,
      canonical,
      ogImage,
      siteName,
      favicon,
    },
    cards,
    tables,
    contacts: {
      phones,
      emails,
      socials,
    },
    jsonLd,
  };
}
