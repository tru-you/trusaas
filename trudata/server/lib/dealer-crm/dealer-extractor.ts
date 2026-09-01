import axios from 'axios';
import * as cheerio from 'cheerio';
import { DealerContactProfile } from './types';
import { extractPhones, extractEmails, extractWhatsAppLinks } from '../legacy-finder/contacts';

/**
 * Scan a Used Car Dealership website and extract complete sales & CRM contact intelligence
 */
export async function extractDealerProfile(
  domain: string,
  rawName: string,
  city: string,
  country: 'za' | 'uk' = 'za'
): Promise<DealerContactProfile | null> {
  const url = `https://${domain}`;
  let html = '';
  let finalUrl = url;

  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 7000,
      maxRedirects: 3
    });
    html = res.data;
    finalUrl = res.request?.res?.responseUrl || url;
  } catch (e) {
    try {
      const httpRes = await axios.get(`http://${domain}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 6000
      });
      html = httpRes.data;
      finalUrl = `http://${domain}`;
    } catch {
      return null;
    }
  }

  if (!html || typeof html !== 'string' || html.length < 200) {
    return null;
  }

  const $ = cheerio.load(html);
  const rawText = $('body').text();
  const rawHtml = html.toLowerCase();

  // 1. Dealer Name Cleanup
  let dealerName = $('title').text().trim().split(/[-|–•]/)[0].trim() || rawName || domain;
  dealerName = dealerName.replace(/(used cars|dealership|motor group|motors|auto sales)/gi, '').trim() + ' Auto Sales';
  if (dealerName.length > 50) dealerName = dealerName.slice(0, 50);

  // 2. Extract Phones, WhatsApp, and Emails
  const phones = extractPhones(rawText, html, country);
  const emails = extractEmails(rawText, html);
  const whatsAppLinks = extractWhatsAppLinks(html);

  let primaryMobile = phones.find(p => p.includes('82') || p.includes('83') || p.includes('84') || p.includes('71') || p.includes('72') || p.includes('79')) || phones[0] || '';
  let switchboard = phones.find(p => p.includes('11') || p.includes('12') || p.includes('21') || p.includes('31') || p.includes('41')) || '';
  let whatsApp = whatsAppLinks[0] || (primaryMobile ? `https://wa.me/${primaryMobile.replace(/[^\d]/g, '')}` : '');

  // Separate sales vs finance emails
  let salesEmail = emails.find(e => e.includes('sales') || e.includes('info') || e.includes('enquir')) || emails[0] || `sales@${domain}`;
  let financeEmail = emails.find(e => e.includes('finance') || e.includes('fandi') || e.includes('accounts'));
  let adminEmail = emails.find(e => e.includes('admin') || e.includes('manager') || e.includes('dp'));

  // 3. Physical Address Extraction
  let physicalAddress = `${city}, Gauteng, South Africa`;
  $('[class*="address"], [class*="location"], [itemprop="address"], address').each((_, el) => {
    const t = $(el).text().trim().replace(/\s+/g, ' ');
    if (t.length > 10 && t.length < 180) {
      physicalAddress = t;
    }
  });

  // 4. Dealership Tech & Stock Analysis
  const hasOnlineFinanceForm = rawHtml.includes('finance') || rawHtml.includes('apply-online') || $('a[href*="finance"]').length > 0;
  const hasMobileVir = rawHtml.includes('inspection') || rawHtml.includes('condition report') || rawHtml.includes('vir');
  const hasLiveChat = rawHtml.includes('livechat') || rawHtml.includes('tawk.to') || rawHtml.includes('intercom') || rawHtml.includes('zendesk');
  const hasViewport = $('meta[name="viewport"]').length > 0;

  // Estimate Stock Count (looking for vehicle grid cards)
  let estimatedStockCount = 25;
  const carCards = $('[class*="vehicle-card"], [class*="car-item"], [class*="stock-item"], [class*="listing-item"]').length;
  if (carCards > 0) {
    estimatedStockCount = Math.max(carCards, 18);
  }

  // Calculate Readiness & Pain Points
  const painPoints: string[] = [];
  const recommendedProducts: ('TruFlow DMS' | 'TruLens Studio' | 'TruInspect VIR' | 'TruLive Video' | 'TruTrade')[] = [];
  let score = 75;

  if (!hasViewport) {
    painPoints.push('Website is broken on smartphones (missing mobile viewport)');
    score -= 30;
    recommendedProducts.push('TruFlow DMS');
  }
  if (!hasMobileVir) {
    painPoints.push('No digital vehicle inspection or condition reports on stock listings');
    score -= 15;
    recommendedProducts.push('TruInspect VIR');
  }
  if (rawHtml.includes('iframe') || !rawHtml.includes('360')) {
    painPoints.push('Static flat vehicle photos without 360 spin studio or damage hot-spots');
    score -= 15;
    recommendedProducts.push('TruLens Studio');
  }
  if (!hasOnlineFinanceForm) {
    painPoints.push('No automated OTP or digital finance application capture');
    score -= 10;
    recommendedProducts.push('TruTrade');
  }

  if (recommendedProducts.length === 0) {
    recommendedProducts.push('TruFlow DMS', 'TruLens Studio');
  }

  // Pre-generate tailored outreach message blurbs
  const outreachBlurbWhatsApp = `Hi ${dealerName} Team, saw your showroom in ${city} with ~${estimatedStockCount} vehicles in stock. We help independent dealers boost mobile sales and automate vehicle condition reports with TruSaaS. Would love to send a quick 2-min demo for your dealership.`;
  const outreachBlurbEmail = `Subject: Upgrading ${dealerName}'s online showroom & stock turnover\n\nHi Dealer Principal / Sales Manager,\n\nWe noticed your dealership in ${city} has an active stock inventory of approximately ${estimatedStockCount} vehicles. We help dealerships like yours streamline DMS operations, shoot interactive 360 photos in 5 minutes with TruLens, and issue digital condition reports with TruInspect.\n\nCould we share a free demo tailored for ${dealerName} this week?`;

  return {
    dealerName,
    websiteUrl: finalUrl,
    city,
    physicalAddress,
    primaryMobile: primaryMobile || '+27 82 000 0000',
    secondaryMobile: phones[1],
    switchboardPhone: switchboard,
    whatsAppDirectLink: whatsApp,
    salesEmail,
    financeEmail,
    adminEmail,
    estimatedStockCount,
    hasOnlineFinanceForm,
    hasMobileVir,
    hasLiveChat,
    readinessScore: Math.max(20, Math.min(85, score)),
    digitalPainPoints: painPoints,
    recommendedTruSaasProducts: recommendedProducts,
    outreachBlurbWhatsApp,
    outreachBlurbEmail
  };
}
