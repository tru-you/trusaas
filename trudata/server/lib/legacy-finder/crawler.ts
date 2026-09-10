import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { CrawlRequest, CrawlResult, LegacySiteTarget } from './types';
import { auditWebsite } from './detector';
import { parseContactPage } from './contacts';
import { serperSearch } from '../serper';

// Common directories and portals to exclude from target candidate lists
const DIRECTORY_DOMAINS = [
  'google.com', 'google.co.za', 'facebook.com', 'instagram.com', 'linkedin.com',
  'yellowpages.co.za', 'snupit.co.za', 'sayellow.com', 'gumtree.co.za', 'property24.com',
  'privateproperty.co.za', 'autotrader.co.za', 'cars.co.za', 'yell.com', 'checkatrade.com',
  'wikipedia.org', 'tripadvisor.co.za', 'hellopeter.com', 'cylex.net.za'
];

/**
 * Execute a complete Legacy Site Crawl & Technical Defect Audit
 */
export async function crawlLegacySites(request: CrawlRequest): Promise<CrawlResult> {
  const { city, industry, country = 'za', maxResults = 10 } = request;
  const currency = country === 'uk' ? '£' : 'R';
  const query = `${industry} in ${city}`;

  console.log(`[LegacyFinder] Starting crawl for: "${query}" (${country.toUpperCase()})`);

  // 1. Discover Candidate Domains via SERP Search
  const candidateDomains = await discoverBusinessDomains(industry, city, country, maxResults * 3);
  console.log(`[LegacyFinder] Discovered ${candidateDomains.length} candidate business domains.`);

  const targets: LegacySiteTarget[] = [];

  // 2. Audit candidate domains in parallel (10 concurrent)
  const CONCURRENCY = 10;
  const candidates = candidateDomains.slice(0, maxResults * 3);
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    if (targets.length >= maxResults) break;
    const batch = candidates.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(domainInfo =>
        auditDomain(
          domainInfo.domain,
          domainInfo.title,
          city,
          industry,
          currency,
          country,
          domainInfo.phone,
          domainInfo.address
        )
      )
    );
    for (const r of results) {
      if (targets.length >= maxResults) break;
      if (r.status === 'fulfilled' && r.value) {
        targets.push(r.value);
      }
    }
  }



  const criticalDefectsFound = targets.reduce((sum, t) => sum + t.defects.filter(d => d.severity === 'CRITICAL').length, 0);
  const avgScore = targets.length > 0
    ? Math.round(targets.reduce((sum, t) => sum + t.readinessScore, 0) / targets.length)
    : 35;

  return {
    query,
    city,
    industry,
    totalFound: targets.length,
    criticalDefectsFound,
    averageReadinessScore: avgScore,
    targets,
    scannedAt: new Date().toISOString()
  };
}

/**
 * Discover business domains via Bright Data SERP / Google Search
 */
async function discoverBusinessDomains(
  industry: string,
  city: string,
  country: 'za' | 'uk',
  limit: number
): Promise<{ domain: string; title: string }[]> {
  const domains: { domain: string; title: string; phone?: string; address?: string }[] = [];
  const queryVariations = [
    `${industry} in ${city}`,
    `used ${industry} ${city}`,
    `${industry} companies ${city}`
  ];
  const gl = country === 'uk' ? 'gb' : 'za';
  const pages = limit > 20 ? [1, 2, 3, 4] : [1, 2];

  // 1. Primary: Serper.dev Multi-Page Search + Google Places Discovery
  const apiKey = process.env.SERPER_API_KEY;
  if (apiKey) {
    try {
      const searchPromises: Promise<any>[] = [];

      // A. Paginated organic web search
      for (const q of queryVariations) {
        for (const page of pages) {
          searchPromises.push(
            fetch('https://google.serper.dev/search', {
              method: 'POST',
              headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({ q, gl, page })
            }).then(r => r.json()).catch(() => ({ organic: [] }))
          );
        }
      }

      // B. Paginated Google Places (Local Maps Business listings)
      for (const page of [1, 2, 3]) {
        searchPromises.push(
          fetch('https://google.serper.dev/places', {
            method: 'POST',
            headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: `${industry} in ${city}`, gl, page })
          }).then(r => r.json()).catch(() => ({ places: [] }))
        );
      }

      const results = await Promise.all(searchPromises);

      for (const res of results) {
        // Organic web results
        for (const r of res.organic || []) {
          if (domains.length >= limit) break;
          if (r.link && r.link.startsWith('http')) {
            try {
              const u = new URL(r.link);
              const domain = u.hostname.replace(/^www\./, '').toLowerCase();
              const isDirectory = DIRECTORY_DOMAINS.some(d => domain.includes(d));
              if (!isDirectory && !domains.some(d => d.domain === domain)) {
                domains.push({ domain, title: r.title || domain });
              }
            } catch {}
          }
        }
        // Places / Maps results
        for (const p of res.places || []) {
          if (domains.length >= limit) break;
          if (p.website && p.website.startsWith('http')) {
            try {
              const u = new URL(p.website);
              const domain = u.hostname.replace(/^www\./, '').toLowerCase();
              const isDirectory = DIRECTORY_DOMAINS.some(d => domain.includes(d));
              if (!isDirectory && !domains.some(d => d.domain === domain)) {
                domains.push({
                  domain,
                  title: p.title || domain,
                  phone: p.phoneNumber,
                  address: p.address
                });
              }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      console.warn('[LegacyFinder] Serper.dev discovery error:', err.message);
    }
  }

  // 2. Fallback: Bright Data SERP (when Serper returned few results or is unset)
  const serpApiKey = process.env.SERP_API_KEY || process.env.BRIGHTDATA_API_KEY || '';
  const serpZone = process.env.SERP_ZONE || 'serp_api1';
  const googleDomain = country === 'uk' ? 'google.co.uk' : 'google.co.za';
  const glParam = country === 'uk' ? 'gl=gb' : 'gl=za';

  if (domains.length < limit && serpApiKey) {
    try {
      const googleUrl = `https://www.${googleDomain}/search?q=${encodeURIComponent(`${industry} ${city} contact`)}&${glParam}&num=50&brd_json=1`;

      const res = await axios.post('https://api.brightdata.com/request', {
        zone: serpZone,
        url: googleUrl,
        format: 'raw'
      }, {
        headers: {
          'Authorization': `Bearer ${serpApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 12000
      });

      const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      const organic = body?.organic_results || body?.organic || [];

      for (const r of Array.isArray(organic) ? organic : []) {
        if (domains.length >= limit) break;
        const link = String(r?.link || r?.url || '');
        const title = String(r?.title || '');
        if (link.startsWith('http')) {
          try {
            const u = new URL(link);
            const domain = u.hostname.replace(/^www\./, '').toLowerCase();
            const isDirectory = DIRECTORY_DOMAINS.some(d => domain.includes(d));
            if (!isDirectory && !domains.some(d => d.domain === domain)) {
              domains.push({ domain, title: title || domain });
            }
          } catch {}
        }
      }
    } catch (err: any) {
      console.warn('[LegacyFinder] Bright Data SERP note:', err.message);
    }
  }

  // 2. Secondary fallback if SERP returned few results
  if (domains.length < 3) {
    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(queryStr)}`;
      const res = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 6000
      });

      const $ = cheerio.load(res.data);
      $('.result__body, .result').each((_, el) => {
        if (domains.length >= limit) return;
        const title = $(el).find('.result__title, a.result__url').text().trim();
        let rawUrl = $(el).find('a.result__url, .result__title a').attr('href') || '';

        if (rawUrl.includes('uddg=')) {
          const match = rawUrl.match(/uddg=([^&]+)/);
          if (match) rawUrl = decodeURIComponent(match[1]);
        }

        try {
          if (rawUrl.startsWith('http')) {
            const u = new URL(rawUrl);
            const domain = u.hostname.replace(/^www\./, '').toLowerCase();
            const isDirectory = DIRECTORY_DOMAINS.some(d => domain.includes(d));
            if (!isDirectory && !domains.some(d => d.domain === domain)) {
              domains.push({ domain, title: title || domain });
            }
          }
        } catch (e) {}
      });
    } catch (err: any) {
      console.warn('[LegacyFinder] HTML search fallback note:', err.message);
    }
  }

  return domains;
}

/**
 * Fetch and audit a single candidate domain
 */
async function auditDomain(
  domain: string,
  rawTitle: string,
  city: string,
  industry: string,
  currency: 'R' | '£',
  country: 'za' | 'uk',
  seedPhone?: string,
  seedAddress?: string
): Promise<LegacySiteTarget | null> {
  const t0 = Date.now();
  let activeUrl = `https://${domain}`;

  let html = '';
  let headers: Record<string, any> = {};
  let loadTimeMs = 2500;

  try {
    const res = await axios.get(activeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 7000,
      maxRedirects: 3
    });
    html = res.data;
    headers = res.headers;
    loadTimeMs = Date.now() - t0;
  } catch (err: any) {
    // If HTTPS fails, try HTTP and update activeUrl
    try {
      const httpUrl = `http://${domain}`;
      const res = await axios.get(httpUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 7000
      });
      activeUrl = httpUrl;
      html = res.data;
      headers = res.headers;
      loadTimeMs = Date.now() - t0;
    } catch (e) {
      // Domain unreachable
      return null;
    }
  }

  if (!html || typeof html !== 'string' || html.length < 200) {
    return null;
  }

  const $ = cheerio.load(html);

  // Clean business name from title
  let businessName = $('title').text().trim().split(/[-|–•]/)[0].trim() || rawTitle || domain;
  if (businessName.length > 50) businessName = businessName.slice(0, 50);

  // Extract contact details
  const contacts = parseContactPage($, country);

  // Perform technical defect audit
  const audit = auditWebsite(activeUrl, html, headers, loadTimeMs, currency);

  // If no phone found on homepage, attempt to crawl first contact page
  if (contacts.phones.length === 0 && contacts.contactPagesFound.length > 0) {
    try {
      const contactUrl = new URL(contacts.contactPagesFound[0], activeUrl).toString();
      const contactRes = await axios.get(contactUrl, { timeout: 4000 });
      if (typeof contactRes.data === 'string') {
        const $c = cheerio.load(contactRes.data);
        const contactPageInfo = parseContactPage($c, country);
        if (contactPageInfo.phones.length > 0) contacts.phones = contactPageInfo.phones;
        if (contactPageInfo.emails.length > 0) contacts.emails = contactPageInfo.emails;
        if (contactPageInfo.address && !contacts.address) contacts.address = contactPageInfo.address;
      }
    } catch (e) {}
  }

  // Fallback to Google Places phone and address if site had no contact info
  if (contacts.phones.length === 0 && seedPhone) {
    contacts.phones.push(seedPhone);
  }
  if (!contacts.address && seedAddress) {
    contacts.address = seedAddress;
  }

  return {
    id: crypto.randomUUID(),
    domain,
    url: activeUrl,
    businessName,
    city,
    industry,
    readinessScore: audit.score,
    defects: audit.defects,
    techStack: audit.techStack,
    contacts,
    estimatedPitchValue: audit.estimatedPitchValue,
    discoveredAt: new Date().toISOString()
  };
}


