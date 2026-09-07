import * as cheerio from 'cheerio';
import { DefectItem, TechStackAudit } from './types';

/**
 * Conduct a deep technical audit on a website's HTML & response headers
 */
export function auditWebsite(
  url: string,
  html: string,
  headers: Record<string, string | string[] | undefined>,
  loadTimeMs: number,
  currency: 'R' | '£' = 'R'
): { score: number; defects: DefectItem[]; techStack: TechStackAudit; estimatedPitchValue: string } {
  const $ = cheerio.load(html);
  const defects: DefectItem[] = [];
  let deduction = 0;

  const rawHtml = html.toLowerCase();
  const isHttps = url.startsWith('https://');

  // 1. Mobile Responsiveness Check (Critical)
  const viewport = $('meta[name="viewport"]').attr('content') || '';
  const hasViewportMeta = viewport.includes('width=device-width') || viewport.includes('initial-scale');
  if (!hasViewportMeta) {
    deduction += 35;
    defects.push({
      id: 'NO_VIEWPORT',
      category: 'MOBILE',
      severity: 'CRITICAL',
      title: 'Missing Mobile Viewport Tag (Broken on Mobile)',
      description: 'The website does not declare a responsive viewport. Mobile visitors see a shrunken, non-scrollable desktop page requiring pinch-to-zoom.',
      agencyPitchAngle: 'Over 65% of local commercial search traffic is on mobile. This site is actively losing high-intent client calls every single day.'
    });
  }

  // Check for Table-based layout or frames
  const hasFrames = $('frameset, frame').length > 0;
  const hasFlash = rawHtml.includes('.swf') || $('object, embed').length > 0;
  if (hasFrames || hasFlash) {
    deduction += 25;
    defects.push({
      id: 'OBSOLETE_FRAMES_FLASH',
      category: 'OBSOLETE_TECH',
      severity: 'CRITICAL',
      title: 'Obsolete Legacy Architecture (Frames or Flash)',
      description: 'The site utilizes deprecated HTML frames or Flash elements that are completely blocked by modern iOS, Android, and Chromium browsers.',
      agencyPitchAngle: 'Major browsers refuse to render these components. A modern clean HTML5/React/WordPress rebuild is mandatory.'
    });
  }

  // 2. SSL & Security Check
  if (!isHttps) {
    deduction += 25;
    defects.push({
      id: 'NO_SSL',
      category: 'SECURITY',
      severity: 'CRITICAL',
      title: 'No SSL / Unencrypted HTTP Protocol',
      description: 'The website serves unencrypted HTTP traffic. Google Chrome and Safari flag the domain with an intimidating "Not Secure" warning in the address bar.',
      agencyPitchAngle: 'Visitors immediately bounce when seeing browser security warnings. Immediate trust failure.'
    });
  }

  // 3. CMS & Framework Detection
  let cms = 'Custom HTML / PHP';
  if (rawHtml.includes('/wp-content/') || rawHtml.includes('wp-json')) {
    cms = 'WordPress';
    if (rawHtml.includes('twentyten') || rawHtml.includes('twentyeleven') || rawHtml.includes('wp-content/themes/default')) {
      cms = 'Legacy WordPress (< v4.5)';
      deduction += 15;
      defects.push({
        id: 'LEGACY_WP',
        category: 'OBSOLETE_TECH',
        severity: 'HIGH',
        title: 'Severely Outdated WordPress Installation',
        description: 'Running an obsolete theme and core version with known security vulnerabilities and unpatched CVEs.',
        agencyPitchAngle: 'High vulnerability to automated malware and defacement bots. Urgent upgrade required.'
      });
    }
  } else if (rawHtml.includes('/media/system/js/') || rawHtml.includes('joomla')) {
    cms = 'Joomla (Legacy)';
    deduction += 20;
    defects.push({
      id: 'LEGACY_JOOMLA',
      category: 'OBSOLETE_TECH',
      severity: 'HIGH',
      title: 'Outdated Joomla CMS Architecture',
      description: 'The site is built on an unmaintained legacy Joomla installation that is incompatible with modern PHP 8+ hosting.',
      agencyPitchAngle: 'Host is likely running insecure legacy PHP. Perfect candidate for a high-value redesign.'
    });
  } else if (rawHtml.includes('wix.com') || rawHtml.includes('wixsite')) {
    cms = 'Wix (Basic)';
  } else if (rawHtml.includes('squarespace')) {
    cms = 'Squarespace';
  }

  // Outdated jQuery Check
  const usesOutdatedJQuery = /jquery[.-](1\.[0-8]\.[0-9]+)/i.test(rawHtml);
  if (usesOutdatedJQuery) {
    deduction += 10;
    defects.push({
      id: 'OLD_JQUERY',
      category: 'OBSOLETE_TECH',
      severity: 'MEDIUM',
      title: 'Vulnerable JavaScript Libraries (jQuery 1.x)',
      description: 'Using ancient jQuery versions with cross-site scripting (XSS) vulnerabilities and slow execution.',
      agencyPitchAngle: 'Causes script errors on modern iOS/macOS Safari.'
    });
  }

  // 4. Modern SEO & Schema Audit
  const hasSchemaOrg = $('script[type="application/ld+json"]').length > 0 || $('[itemscope]').length > 0;
  if (!hasSchemaOrg) {
    deduction += 10;
    defects.push({
      id: 'NO_SCHEMA',
      category: 'SEO',
      severity: 'HIGH',
      title: 'Missing Schema.org LocalBusiness Structured Data',
      description: 'The site lacks structured data markup, preventing Google from generating rich snippets, operating hours, and local map highlights.',
      agencyPitchAngle: 'Outranked on Google Maps by local competitors with Schema-optimized pages.'
    });
  }

  const metaDesc = $('meta[name="description"]').attr('content');
  const hasMetaDescription = !!metaDesc && metaDesc.length > 20;
  if (!hasMetaDescription) {
    deduction += 8;
    defects.push({
      id: 'NO_META_DESC',
      category: 'SEO',
      severity: 'MEDIUM',
      title: 'Missing or Broken Meta Description',
      description: 'Search results show messy scrapings of navigation text instead of an engaging, high-converting snippet.',
      agencyPitchAngle: 'Substantial click-through rate (CTR) deficit on Google organic listings.'
    });
  }

  // 5. Speed & Assets Check
  const estimatedLoadSeconds = parseFloat((loadTimeMs / 1000).toFixed(2));
  if (loadTimeMs > 4500) {
    deduction += 15;
    defects.push({
      id: 'SLOW_LCP',
      category: 'PERFORMANCE',
      severity: 'HIGH',
      title: `Slow Page Load Speed (${estimatedLoadSeconds}s)`,
      description: 'Exceeds Google Core Web Vitals threshold (>2.5s). High bounce rate and search rank penalty.',
      agencyPitchAngle: '53% of mobile visits are abandoned if a site takes longer than 3 seconds to load.'
    });
  }

  // Analytics Check
  const hasGoogleAnalyticsOrPixel = rawHtml.includes('gtag') || rawHtml.includes('google-analytics') || rawHtml.includes('fbq(') || rawHtml.includes('googletagmanager');
  if (!hasGoogleAnalyticsOrPixel) {
    deduction += 8;
    defects.push({
      id: 'NO_ANALYTICS',
      category: 'SEO',
      severity: 'MEDIUM',
      title: 'Zero Tracking or Conversion Analytics',
      description: 'The business has no Google Analytics or Meta Pixel tracking, flying blind on marketing ROI.',
      agencyPitchAngle: 'They have no idea where their customers are coming from or which campaigns work.'
    });
  }

  // Calculate Final Score (0 - 100)
  const score = Math.max(15, Math.min(98, 100 - deduction));

  // Determine Estimated Pitch Proposal Value
  let estimatedPitchValue = `${currency} 25,000 - ${currency} 40,000`;
  if (currency === '£') {
    estimatedPitchValue = score < 40 ? '£2,500 - £4,500' : '£1,500 - £2,800';
  } else {
    estimatedPitchValue = score < 40 ? 'R 35,000 - R 55,000' : 'R 22,000 - R 38,000';
  }

  const techStack: TechStackAudit = {
    cms,
    server: (headers['server'] as string) || 'Standard Cloud',
    hasViewportMeta,
    isSslValid: isHttps,
    usesOutdatedJQuery,
    hasFlashOrFrames: hasFrames || hasFlash,
    hasSchemaOrg,
    hasMetaDescription,
    hasGoogleAnalyticsOrPixel,
    estimatedLoadSeconds
  };

  return {
    score,
    defects,
    techStack,
    estimatedPitchValue
  };
}
