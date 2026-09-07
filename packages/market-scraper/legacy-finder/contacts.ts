import * as cheerio from 'cheerio';
import { ContactInfo } from './types';

// Blacklist of false-positive emails (assets, libraries, placeholders)
const EMAIL_BLACKLIST = [
  'example.com', 'domain.com', 'email.com', 'yoursite.com', 'company.com',
  'sentry.io', 'wixpress.com', 'wordpress.org', 'cloudflare.com', 'googleapis.com',
  'schema.org', 'w3.org', 'jquery.com', 'bootstrap.com', 'fontawesome.com'
];

/**
 * Normalise and deduplicate phone numbers
 */
export function extractPhones(text: string, html: string, country: 'za' | 'uk' = 'za'): string[] {
  const phones: Set<string> = new Set();

  // 1. Direct tel: links
  const telRegex = /href=["']tel:([^"']+)["']/gi;
  let match;
  while ((match = telRegex.exec(html)) !== null) {
    const raw = match[1].replace(/[\s\-\(\)\.]/g, '');
    if (raw.length >= 9 && raw.length <= 15) {
      phones.add(formatPhone(raw, country));
    }
  }

  // 2. Regex search in body text
  // South Africa format: +27 82 123 4567, 082 123 4567, 012 345 6789, (011) 234-5678
  // UK format: +44 20 7946 0912, 020 7946 0912, 07911 123456
  const zaPattern = /(?:(?:\+27|0027)\s*\(?0?\)?|0)\s*[1-8](?:[\s\-]?[0-9]){8}/g;
  const ukPattern = /(?:(?:\+44|0044)\s*\(?0?\)?|0)\s*[1-9](?:[\s\-]?[0-9]){9}/g;
  const pattern = country === 'uk' ? ukPattern : zaPattern;

  const textMatches = text.match(pattern) || [];
  textMatches.forEach(p => {
    const clean = p.replace(/[\s\-\(\)\.]/g, '');
    if (clean.length >= 9 && clean.length <= 14) {
      phones.add(formatPhone(clean, country));
    }
  });

  return Array.from(phones).slice(0, 6);
}

function formatPhone(phone: string, country: 'za' | 'uk'): string {
  let p = phone.replace(/[^\d+]/g, '');
  if (country === 'za') {
    if (p.startsWith('0') && p.length === 10) {
      return `+27 ${p.slice(1, 3)} ${p.slice(3, 6)} ${p.slice(6)}`;
    }
    if (p.startsWith('27') && p.length === 11) {
      return `+27 ${p.slice(2, 4)} ${p.slice(4, 7)} ${p.slice(7)}`;
    }
    if (p.startsWith('+27') && p.length === 12) {
      return `+27 ${p.slice(3, 5)} ${p.slice(5, 8)} ${p.slice(8)}`;
    }
  } else if (country === 'uk') {
    if (p.startsWith('0') && p.length === 11) {
      return `+44 ${p.slice(1, 5)} ${p.slice(5)}`;
    }
  }
  return p;
}

/**
 * Extract clean, verified corporate email addresses
 */
export function extractEmails(text: string, html: string): string[] {
  const emails: Set<string> = new Set();

  // 1. mailto: links
  const mailtoRegex = /href=["']mailto:([^"'\?]+)/gi;
  let match;
  while ((match = mailtoRegex.exec(html)) !== null) {
    const email = match[1].trim().toLowerCase();
    if (isValidEmail(email)) {
      emails.add(email);
    }
  }

  // 2. Text regex
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const textMatches = text.match(emailPattern) || [];
  textMatches.forEach(e => {
    const email = e.trim().toLowerCase();
    if (isValidEmail(email)) {
      emails.add(email);
    }
  });

  return Array.from(emails).slice(0, 6);
}

function isValidEmail(email: string): boolean {
  if (!email || email.length > 80 || email.length < 5) return false;
  // Exclude image extensions mistaken for emails
  if (/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(email)) return false;
  // Exclude blacklisted domains
  for (const blacklisted of EMAIL_BLACKLIST) {
    if (email.includes(blacklisted)) return false;
  }
  return true;
}

/**
 * Extract WhatsApp direct chat links
 */
export function extractWhatsAppLinks(html: string): string[] {
  const links: Set<string> = new Set();
  const waRegex = /(https?:\/\/(?:api\.whatsapp\.com\/send\?phone=|wa\.me\/)[0-9+]+)/gi;
  let match;
  while ((match = waRegex.exec(html)) !== null) {
    links.add(match[1]);
  }
  return Array.from(links);
}

/**
 * Extract physical address hints and social links
 */
export function parseContactPage($: cheerio.CheerioAPI, country: 'za' | 'uk' = 'za'): ContactInfo {
  const text = $('body').text();
  const html = $.html();

  const phones = extractPhones(text, html, country);
  const emails = extractEmails(text, html);
  const whatsAppLinks = extractWhatsAppLinks(html);

  // Social profiles
  const socialLinks: ContactInfo['socialLinks'] = {};
  $('a[href*="facebook.com"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && !href.includes('sharer') && !socialLinks.facebook) socialLinks.facebook = href;
  });
  $('a[href*="instagram.com"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && !socialLinks.instagram) socialLinks.instagram = href;
  });
  $('a[href*="linkedin.com"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && !socialLinks.linkedin) socialLinks.linkedin = href;
  });
  $('a[href*="google.com/maps"], a[href*="maps.google.com"], a[href*="goo.gl/maps"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && !socialLinks.googleMaps) socialLinks.googleMaps = href;
  });

  // Physical address hint
  let address: string | undefined;
  $('[class*="address"], [class*="location"], [itemprop="address"], address').each((_, el) => {
    const t = $(el).text().trim().replace(/\s+/g, ' ');
    if (t.length > 10 && t.length < 200 && !address) {
      address = t;
    }
  });

  // Contact page links
  const contactPagesFound: string[] = [];
  $('a[href*="contact"], a[href*="about"], a[href*="reach"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && !contactPagesFound.includes(href)) {
      contactPagesFound.push(href);
    }
  });

  return {
    phones,
    whatsAppLinks,
    emails,
    address,
    contactPagesFound: contactPagesFound.slice(0, 4),
    socialLinks
  };
}
