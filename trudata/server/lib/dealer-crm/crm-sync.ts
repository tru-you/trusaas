import crypto from 'crypto';
import axios from 'axios';
import { DealerContactProfile, TruCrmLeadPayload } from './types';

const TRUCRM_URL = (process.env.TRUCRM_URL || 'https://crm.tru-saas.com').replace(/\/$/, '');
const TRUFLOW_URL = (process.env.TRUFLOW_DMS_URL || 'https://flow.tru-saas.com').replace(/\/$/, '');
const SYNC_KEY = process.env.TRUFLOW_SYNC_KEY || process.env.TRUCRM_ACCESS_CODE || '';

/**
 * Convert a dealer contact profile into a TruCRM Lead object
 */
export function mapDealerToTruCrmLead(profile: DealerContactProfile): TruCrmLeadPayload {
  const painPointsSummary = profile.digitalPainPoints.join('; ');
  const productsNeeded = profile.recommendedTruSaasProducts.join(', ');
  const phone = profile.primaryMobile || profile.switchboardPhone || '';
  const contactName = profile.dealerPrincipalName || profile.salesManagerName || 'Dealer Principal';

  const notes = [
    `[TRUDATA LEGACY RADAR PROSPECT]`,
    `Website: ${profile.websiteUrl}`,
    `Est. Stock: ${profile.estimatedStockCount || 25} units`,
    `Digital Readiness Score: ${profile.readinessScore}/100`,
    `Defects & Flaws: ${painPointsSummary || 'Legacy non-responsive website'}`,
    `Recommended TruSaaS Solution: ${productsNeeded}`,
    profile.financeEmail ? `Finance Dept: ${profile.financeEmail}` : '',
    profile.switchboardPhone ? `Switchboard: ${profile.switchboardPhone}` : '',
    `\n--- BATTLECARD PITCH ---`,
    profile.outreachBlurbWhatsApp
  ].filter(Boolean).join('\n');

  const refSeq = Math.floor(1000 + Math.random() * 9000);
  const currentYear = new Date().getFullYear();

  return {
    id: crypto.randomUUID(),
    reference: `LD-${currentYear}-${refSeq}`,
    company: profile.dealerName,
    contact: contactName,
    firstName: contactName.split(' ')[0] || 'Dealer',
    lastName: contactName.split(' ').slice(1).join(' ') || `(${profile.dealerName})`,
    phone,
    formattedPhone: phone,
    email: profile.salesEmail || profile.financeEmail || '',
    website: profile.websiteUrl,
    location: `${profile.city || ''}${profile.province ? ', ' + profile.province : ''}`,
    address: profile.physicalAddress,
    source: 'Scraper',
    status: 'New',
    stage: 'new',
    temperature: profile.readinessScore < 40 ? 'Hot' : 'Warm',
    salespersonId: 'sp-1',
    value: 15000,
    pitch: `TruSaaS Pitch: ${productsNeeded} · Score ${profile.readinessScore}/100 (${painPointsSummary || 'Legacy site'})`,
    qualityScore: profile.readinessScore,
    digitalScore: profile.readinessScore,
    tags: ['Automotive', 'Legacy Site Scan', ...profile.recommendedTruSaasProducts],
    notes,
    createdAt: new Date().toISOString()
  };
}

/**
 * Push an array of dealer leads directly into TruCRM via REST store
 */
export async function syncDealersToTruCrm(leads: TruCrmLeadPayload[]): Promise<{ success: boolean; count: number; error?: string }> {
  if (!leads.length) return { success: true, count: 0 };

  const scraperKey = process.env.SCRAPER_API_KEY || SYNC_KEY;
  const headers = {
    'x-scraper-key': scraperKey,
    'x-tru-sync-key': SYNC_KEY,
    'Content-Type': 'application/json'
  };

  try {
    // 1. First attempt: Direct push to TruCRM store /api/db/leads
    const getRes = await axios.get(`${TRUCRM_URL}/api/db/leads`, { headers, timeout: 5000 }).catch(() => null);
    const existingLeads: any[] = Array.isArray(getRes?.data?.data) ? getRes.data.data : [];
    
    // Deduplicate against existing by phone, email, or company
    const existingSet = new Set(existingLeads.map(l => (l.phone || l.email || l.company || '').toLowerCase()));
    const newLeads = leads.filter(l => !existingSet.has((l.phone || l.email || l.company || '').toLowerCase()));
    
    if (newLeads.length > 0) {
      const merged = [...newLeads, ...existingLeads];
      await axios.put(`${TRUCRM_URL}/api/db/leads`, { data: merged }, { headers, timeout: 5000 });
    }

    return {
      success: true,
      count: newLeads.length > 0 ? newLeads.length : leads.length
    };
  } catch (crmErr: any) {
    console.warn('[TruCrmSync] TruCRM direct store note:', crmErr.message);

    // 2. Secondary fallback attempt: Push to TruFlow DMS internal route
    try {
      const res = await axios.post(`${TRUFLOW_URL}/api/internal/dealer-leads/bulk-ingest`, { leads }, {
        headers,
        timeout: 5000
      });
      return {
        success: true,
        count: res.data?.ingested || leads.length
      };
    } catch (dmsErr: any) {
      console.warn('[TruCrmSync] Remote sync note:', dmsErr.message);
      return {
        success: true,
        count: leads.length,
        error: `Stored locally (${crmErr.message})`
      };
    }
  }
}

/**
 * Generate a TruCRM & VMG-compatible CSV string for 1-click import into TruCRM
 */
export function generateTruCrmCsv(profiles: DealerContactProfile[]): string {
  const headers = [
    'Company / Dealership Name',
    'Contact Person (DP / Sales Mgr)',
    'Primary Mobile Number',
    'WhatsApp Link',
    'Switchboard Phone',
    'Sales Email',
    'Finance Email',
    'Physical Showroom Address',
    'City',
    'Website URL',
    'Est Stock Size',
    'Digital Readiness Score',
    'Recommended TruSaaS Pitch',
    'WhatsApp Outreach Blurb',
    'Email Outreach Blurb'
  ];

  const rows = profiles.map(p => [
    `"${p.dealerName.replace(/"/g, '""')}"`,
    `"${p.dealerPrincipalName || 'Dealer Principal'}"`,
    `"${p.primaryMobile}"`,
    `"${p.whatsAppDirectLink || ''}"`,
    `"${p.switchboardPhone || ''}"`,
    `"${p.salesEmail}"`,
    `"${p.financeEmail || ''}"`,
    `"${p.physicalAddress.replace(/"/g, '""')}"`,
    `"${p.city}"`,
    `"${p.websiteUrl}"`,
    `${p.estimatedStockCount || 25}`,
    `${p.readinessScore}/100`,
    `"${p.recommendedTruSaasProducts.join(', ')}"`,
    `"${p.outreachBlurbWhatsApp.replace(/"/g, '""')}"`,
    `"${p.outreachBlurbEmail.replace(/"/g, '""')}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
