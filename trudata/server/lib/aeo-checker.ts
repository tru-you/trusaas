import axios from 'axios';
import * as cheerio from 'cheerio';

export interface AeoAuditResult {
  url: string;
  domain: string;
  score: number; // 0 to 100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  crawlers: {
    gptBot: boolean;
    claudeBot: boolean;
    perplexityBot: boolean;
    googleExtended: boolean;
    applebotExtended: boolean;
    robotsTxtFound: boolean;
  };
  llmsTxt: {
    found: boolean;
    fullVersionFound: boolean;
    url?: string;
    contentSnippet?: string;
  };
  schemaLd: {
    found: boolean;
    schemaTypes: string[];
    validCount: number;
    errors: string[];
    warnings: string[];
    rawSchemas: any[];
  };
  recommendations: string[];
  fixSnippet: {
    jsonLdScript: string;
    llmsTxtContent: string;
    robotsTxtRules: string;
  };
}

const AI_BOTS = ['GPTBot', 'ChatGPT-User', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'meta-externalagent'];

export async function auditSiteAeo(targetUrl: string): Promise<AeoAuditResult> {
  const urlObj = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
  const domain = urlObj.hostname;
  const baseUrl = `${urlObj.protocol}//${domain}`;

  const errors: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  let html = '';
  let robotsTxtContent = '';
  let llmsTxtContent = '';

  // 1. Fetch Main Page HTML
  try {
    const res = await axios.get(urlObj.href, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    html = res.data;
  } catch (err: any) {
    errors.push(`Failed to fetch website HTML: ${err.message}`);
  }

  // 2. Fetch robots.txt
  let robotsTxtFound = false;
  let gptBot = true;
  let claudeBot = true;
  let perplexityBot = true;
  let googleExtended = true;
  let applebotExtended = true;

  try {
    const robotsRes = await axios.get(`${baseUrl}/robots.txt`, { timeout: 5000 });
    if (robotsRes.status === 200 && typeof robotsRes.data === 'string') {
      robotsTxtFound = true;
      robotsTxtContent = robotsRes.data;

      if (robotsTxtContent.toLowerCase().includes('disallow: /') && robotsTxtContent.includes('GPTBot')) {
        gptBot = false;
        warnings.push('robots.txt disallows GPTBot (ChatGPT crawler)');
      }
      if (robotsTxtContent.toLowerCase().includes('disallow: /') && robotsTxtContent.includes('ClaudeBot')) {
        claudeBot = false;
        warnings.push('robots.txt disallows ClaudeBot');
      }
      if (robotsTxtContent.toLowerCase().includes('disallow: /') && robotsTxtContent.includes('PerplexityBot')) {
        perplexityBot = false;
        warnings.push('robots.txt disallows PerplexityBot');
      }
    }
  } catch {
    warnings.push('robots.txt not found or unreachable');
  }

  // 3. Fetch llms.txt
  let llmsFound = false;
  let llmsFullFound = false;
  try {
    const llmsRes = await axios.get(`${baseUrl}/llms.txt`, { timeout: 5000 });
    if (llmsRes.status === 200 && typeof llmsRes.data === 'string' && llmsRes.data.trim().length > 10) {
      llmsFound = true;
      llmsTxtContent = llmsRes.data;
    }
  } catch {
    warnings.push('Missing /llms.txt discovery context document');
  }

  try {
    const llmsFullRes = await axios.get(`${baseUrl}/llms-full.txt`, { timeout: 5000 });
    if (llmsFullRes.status === 200 && typeof llmsFullRes.data === 'string') {
      llmsFullFound = true;
    }
  } catch {}

  // 4. Audit JSON-LD Schemas in HTML
  const schemaTypes: string[] = [];
  const rawSchemas: any[] = [];
  let validCount = 0;

  if (html) {
    const $ = cheerio.load(html);
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const text = $(el).html();
        if (!text) return;
        const parsed = JSON.parse(text);
        const list = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);

        for (const item of list) {
          if (item && item['@type']) {
            const typeStr = String(item['@type']);
            schemaTypes.push(typeStr);
            rawSchemas.push(item);

            // Validate mandatory fields based on schema type
            if (['AutoDealer', 'LocalBusiness', 'RealEstateAgent', 'Organization'].includes(typeStr)) {
              if (!item.name) errors.push(`Schema ${typeStr} missing mandatory 'name' property`);
              if (!item.url && !item['@id']) warnings.push(`Schema ${typeStr} missing '@id' or 'url' property`);
              if (!item.address) warnings.push(`Schema ${typeStr} missing 'address' location property`);
              if (item.name && (item.url || item['@id'])) validCount++;
            } else if (['Car', 'Vehicle', 'Product', 'SingleFamilyResidence'].includes(typeStr)) {
              if (!item.name && !item.model) errors.push(`Schema ${typeStr} missing 'name' or 'model'`);
              if (!item.offers) warnings.push(`Schema ${typeStr} missing 'offers' pricing details`);
              if (item.name || item.model) validCount++;
            } else {
              validCount++;
            }
          }
        }
      } catch (err: any) {
        errors.push(`Malformed JSON-LD block: ${err.message}`);
      }
    });
  }

  if (schemaTypes.length === 0) {
    errors.push('No JSON-LD structured data found on main page');
  }

  // 5. Score Calculation
  let score = 0;
  if (html) score += 20;
  if (robotsTxtFound && gptBot && claudeBot && perplexityBot) score += 20;
  if (llmsFound) score += 20;
  if (llmsFullFound) score += 5;
  if (schemaTypes.length > 0) score += 20;
  if (validCount > 0) score += 15;

  // Deduct for errors
  score = Math.max(0, Math.min(100, score - (errors.length * 5)));

  let grade: AeoAuditResult['grade'] = 'F';
  if (score >= 90) grade = 'A+';
  else if (score >= 80) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 60) grade = 'C';
  else if (score >= 40) grade = 'D';

  // 6. Generate Recommendations
  if (!llmsFound) recommendations.push('Create a root /llms.txt file providing clean Markdown context for AI search engines.');
  if (schemaTypes.length === 0) recommendations.push('Add Schema.org JSON-LD structured data (AutoDealer, LocalBusiness, or Organization) to head/body.');
  if (!gptBot || !claudeBot) recommendations.push('Update robots.txt to explicitly allow AI search crawlers (GPTBot, ClaudeBot, PerplexityBot).');

  // Extract page title and site name for fix snippet
  const $ = html ? cheerio.load(html) : null;
  const siteTitle = $ ? ($('title').text().trim() || domain) : domain;
  const siteDesc = $ ? ($('meta[name="description"]').attr('content') || `Official website for ${domain}`) : `Official website for ${domain}`;

  // 7. Generate 1-Click Fix Snippet
  const fixSnippet = {
    jsonLdScript: `<script type="application/ld+json">\n${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      '@id': `${baseUrl}/#organization`,
      'name': siteTitle,
      'url': baseUrl,
      'description': siteDesc,
      'telephone': '+27 11 000 0000',
      'address': {
        '@type': 'PostalAddress',
        'addressCountry': 'ZA',
      },
    }, null, 2)}\n</script>`,

    llmsTxtContent: `# ${siteTitle}\n\n> ${siteDesc}\n\n## Overview\n${siteTitle} operates at ${baseUrl}, providing verified services in South Africa.\n\n## Key Endpoints\n- Main Site: ${baseUrl}\n- Contact: ${baseUrl}/contact\n`,

    robotsTxtRules: `User-agent: *\nAllow: /\n\n# Explicit AI Search Engine Crawlers\nUser-agent: GPTBot\nAllow: /\nUser-agent: ChatGPT-User\nAllow: /\nUser-agent: ClaudeBot\nAllow: /\nUser-agent: PerplexityBot\nAllow: /\nUser-agent: Google-Extended\nAllow: /\nUser-agent: Applebot-Extended\nAllow: /\nUser-agent: CCBot\nAllow: /\nUser-agent: meta-externalagent\nAllow: /\n\nSitemap: ${baseUrl}/sitemap.xml\n`,
  };

  return {
    url: targetUrl,
    domain,
    score,
    grade,
    crawlers: {
      gptBot,
      claudeBot,
      perplexityBot,
      googleExtended,
      applebotExtended,
      robotsTxtFound,
    },
    llmsTxt: {
      found: llmsFound,
      fullVersionFound: llmsFullFound,
      url: llmsFound ? `${baseUrl}/llms.txt` : undefined,
      contentSnippet: llmsTxtContent ? llmsTxtContent.slice(0, 300) : undefined,
    },
    schemaLd: {
      found: schemaTypes.length > 0,
      schemaTypes,
      validCount,
      errors,
      warnings,
      rawSchemas,
    },
    recommendations,
    fixSnippet,
  };
}
