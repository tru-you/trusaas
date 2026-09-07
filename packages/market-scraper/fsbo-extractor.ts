/**
 * TruData Private Sellers (FSBO - For Sale By Owner) Intelligence Engine
 * 
 * Ingests and extracts verified direct property sellers with zero agent mandates
 * across South African portals (Gumtree Property, Private Property Private Sellers, SERP).
 */

import axios from 'axios';
import crypto from 'crypto';

export interface FsboLead {
  id: string;
  headline: string;
  suburb: string;
  city: string;
  askingPrice: number;
  formattedPrice: string;
  ownerName: string;
  phone: string;
  whatsAppUrl: string;
  daysListed: number | null;
  portalSource: 'Gumtree Private' | 'Private Property (Direct)' | 'Direct Classifieds';
  sourceUrl: string;
  propertyType: string;
  bedrooms?: number;
  bathrooms?: number;
  source: string;
}

export interface FsboResponse {
  suburb: string;
  city: string;
  count: number;
  leads: FsboLead[];
  averageAskingPrice: number;
  scannedAt: string;
}

function formatZar(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0
  }).format(amount);
}



/**
 * Discover and extract active Private Seller (FSBO) property leads
 */
export async function extractFsboLeads(suburb: string, city: string = '', maxResults: number = 8): Promise<FsboResponse> {
  const cleanSuburb = suburb.split(',')[0].trim();
  const serpApiKey = process.env.SERP_API_KEY || process.env.BRIGHTDATA_API_KEY || '';
  const serpZone = process.env.SERP_ZONE || 'serp';

  const liveLeads: FsboLead[] = [];

  // 1. Primary: Serper.dev
  if (process.env.SERPER_API_KEY && liveLeads.length < maxResults) {
    try {
      const { serperSearch } = await import('./serper');
      const queries = [
        `${cleanSuburb} property for sale private seller`,
        `${cleanSuburb} property for sale owner Gumtree`,
        `${cleanSuburb} house for sale private seller South Africa`
      ];
      
      for (const q of queries) {
        if (liveLeads.length >= maxResults) break;
        const result = await serperSearch(q, { gl: 'za', num: 20 });
        for (const r of result.organic) {
          if (liveLeads.length >= maxResults) break;
          const title = String(r.title || '');
          const snippet = String(r.snippet || '');
          const link = String(r.link || '');

          const priceMatch = `${title} ${snippet}`.match(/R\s?(\d{1,3}(?:[ ,]\d{3})+|\d{5,8})/i);
          if (!priceMatch) continue;

          const rawPrice = parseInt(priceMatch[1].replace(/[^\d]/g, ''), 10);
          if (rawPrice < 150_000 || rawPrice > 100_000_000) continue;

          const isGumtree = link.includes('gumtree.co.za');
          const isPrivateProp = link.includes('privateproperty.co.za');
          const portal: FsboLead['portalSource'] = isGumtree 
            ? 'Gumtree Private' 
            : isPrivateProp 
              ? 'Private Property (Direct)' 
              : 'Direct Classifieds';
          
          const phoneMatch = `${title} ${snippet}`.match(/(?:\+?27|0)\s?(?:[678]\d{1})\s?\d{3}\s?\d{4}/);
          const phone = phoneMatch ? phoneMatch[0] : 'Inquire via portal';
          const cleanPhone = phoneMatch ? phoneMatch[0].replace(/[^\d]/g, '').replace(/^0/, '27') : '';
          const whatsAppUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : link;

          // Deduplicate by link or headline
          if (liveLeads.some(l => l.sourceUrl === link || l.headline === title)) continue;

          liveLeads.push({
            id: `live-fsbo-${crypto.randomUUID().slice(0, 8)}`,
            headline: title.replace(/[-|]\s*(Gumtree|Private Property|Property24).*$/i, '').trim(),
            suburb: cleanSuburb,
            city: city || 'South Africa',
            askingPrice: rawPrice,
            formattedPrice: formatZar(rawPrice),
            ownerName: 'Private Seller',
            phone,
            whatsAppUrl,
            daysListed: null,
            portalSource: portal,
            sourceUrl: link,
            propertyType: /apartment|flat/i.test(title) ? 'Apartment' : 'House / Property',
            source: 'serp'
          });
        }
      }
    } catch (err: any) {
      console.warn('[FSBO-Extractor] Serper.dev note:', err?.message || err);
    }
  }

  // 2. Fallback: Bright Data SERP (if Serper returned 0 leads or is not configured)
  if (liveLeads.length < maxResults && serpApiKey) {
    try {
      const q = `"${cleanSuburb}" property for sale "private seller" OR "by owner"`;
      const googleUrl = `https://www.google.co.za/search?q=${encodeURIComponent(q)}&gl=za&hl=en&num=15&brd_json=1`;
      
      const res = await axios.post('https://api.brightdata.com/request', {
        zone: serpZone,
        url: googleUrl,
        format: 'raw'
      }, {
        headers: {
          Authorization: `Bearer ${serpApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      const organic = body?.organic_results || body?.organic || [];

      for (const item of Array.isArray(organic) ? organic : []) {
        if (liveLeads.length >= maxResults) break;
        const title = String(item?.title || '');
        const snippet = String(item?.snippet || item?.description || '');
        const link = String(item?.link || item?.url || '');

        const priceMatch = `${title} ${snippet}`.match(/R\s?(\d{1,3}(?:[ ,]\d{3})+|\d{5,8})/i);
        if (!priceMatch) continue;

        const rawPrice = parseInt(priceMatch[1].replace(/[^\d]/g, ''), 10);
        if (rawPrice < 250_000 || rawPrice > 100_000_000) continue;

        const isGumtree = link.includes('gumtree.co.za');
        const portal: FsboLead['portalSource'] = isGumtree ? 'Gumtree Private' : 'Private Property (Direct)';
        
        const phoneMatch = snippet.match(/(?:\+?27|0)\s?(?:[678]\d{1})\s?\d{3}\s?\d{4}/);
        const phone = phoneMatch ? phoneMatch[0] : 'Contact via portal';
        const cleanPhone = phoneMatch ? phoneMatch[0].replace(/[^\d]/g, '').replace(/^0/, '27') : '';
        const whatsAppUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : link;

        liveLeads.push({
          id: `live-fsbo-${crypto.randomUUID().slice(0, 8)}`,
          headline: title.replace(/[-|]\s*(Gumtree|Private Property).*$/i, '').trim(),
          suburb: cleanSuburb,
          city: city || 'South Africa',
          askingPrice: rawPrice,
          formattedPrice: formatZar(rawPrice),
          ownerName: 'Private Seller',
          phone,
          whatsAppUrl,
          daysListed: null,
          portalSource: portal,
          sourceUrl: link,
          propertyType: /apartment|flat/i.test(title) ? 'Apartment' : 'House / Property',
          source: 'serp'
        });
      }
    } catch (err: any) {
      console.warn('[FSBO-Extractor] SERP search note:', err?.message || err);
    }
  }

  const finalLeads = liveLeads.slice(0, maxResults);

  const avgPrice = finalLeads.length > 0
    ? Math.round(finalLeads.reduce((acc, l) => acc + l.askingPrice, 0) / finalLeads.length)
    : 0;

  return {
    suburb: cleanSuburb,
    city: city || 'South Africa',
    count: finalLeads.length,
    leads: finalLeads,
    averageAskingPrice: avgPrice,
    scannedAt: new Date().toISOString()
  };
}
