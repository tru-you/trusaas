import axios from 'axios';
import { RawFbListing } from '../types';
import { CONFIG } from '../config';
import { SA_MOCK_FB_LISTINGS } from './mock-payloads';

export interface BrightDataScrapeOptions {
  cityUrls?: string[];
  limitPerCity?: number;
  useMockIfNoKey?: boolean;
}

const DEFAULT_SA_CITIES = [
  'https://www.facebook.com/marketplace/johannesburg/vehicles',
  'https://www.facebook.com/marketplace/capetown/vehicles',
  'https://www.facebook.com/marketplace/durban/vehicles',
  'https://www.facebook.com/marketplace/pretoria/vehicles',
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchFacebookMarketplaceListings(
  options: BrightDataScrapeOptions = {}
): Promise<RawFbListing[]> {
  const apiKey = CONFIG.BRIGHTDATA_API_KEY;
  const datasetId = CONFIG.BRIGHTDATA_DATASET_ID;

  if (!apiKey) {
    if (options.useMockIfNoKey !== false) {
      console.log('[brightdata] No BRIGHTDATA_API_KEY found, returning South African mock dataset.');
      return SA_MOCK_FB_LISTINGS;
    }
    throw new Error('BRIGHTDATA_API_KEY is not configured.');
  }

  const urls = options.cityUrls || DEFAULT_SA_CITIES;
  const limit = options.limitPerCity || 20;

  // Use trigger endpoint which returns snapshot_id immediately
  const triggerEndpoint = `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${encodeURIComponent(
    datasetId
  )}&include_errors=true&type=discover_new&discover_by=url`;

  const requestBody = {
    input: urls.map((url) => ({ url, country: 'ZA' })),
    limit_per_input: limit,
  };

  try {
    console.log(`[brightdata] Triggering scrape for ${urls.length} SA locations on dataset ${datasetId}...`);
    
    // 1. Trigger collection
    const triggerRes = await axios.post(triggerEndpoint, requestBody, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    const snapshotId = triggerRes.data?.snapshot_id;
    if (snapshotId) {
      console.log(`[brightdata] Collection started. Snapshot ID: ${snapshotId}. Polling for results...`);
      return await pollSnapshotResults(snapshotId, apiKey);
    }

    // If direct data array returned
    if (Array.isArray(triggerRes.data)) {
      return triggerRes.data;
    }

    if (triggerRes.data && Array.isArray(triggerRes.data.data)) {
      return triggerRes.data.data;
    }

    console.warn('[brightdata] Trigger response did not contain snapshot_id or array:', triggerRes.data);
    return [];
  } catch (err: any) {
    console.warn('[brightdata] Trigger failed, falling back to /scrape endpoint:', err?.message || err);
    return await fallbackScrape(apiKey, datasetId, urls, limit);
  }
}

async function pollSnapshotResults(snapshotId: string, apiKey: string): Promise<RawFbListing[]> {
  const pollUrl = `https://api.brightdata.com/datasets/v3/snapshot/${encodeURIComponent(snapshotId)}?format=json`;
  const maxAttempts = 24; // 24 * 5s = 120s max wait

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await sleep(5000);
    try {
      const res = await axios.get(pollUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 15000,
      });

      if (Array.isArray(res.data)) {
        console.log(`[brightdata] Snapshot ${snapshotId} ready! Collected ${res.data.length} listings.`);
        return res.data;
      }

      if (res.data?.status === 'running' || res.data?.status === 'collecting') {
        console.log(`[brightdata] Snapshot status: ${res.data.status} (attempt ${attempt}/${maxAttempts})...`);
        continue;
      }

      if (res.data?.status === 'ready' && res.data?.snapshot_url) {
        const downloadRes = await axios.get(res.data.snapshot_url, { timeout: 30000 });
        if (Array.isArray(downloadRes.data)) return downloadRes.data;
      }
    } catch (pollErr: any) {
      console.warn(`[brightdata] Poll error (attempt ${attempt}):`, pollErr?.message || pollErr);
    }
  }

  console.warn(`[brightdata] Snapshot ${snapshotId} still processing in background.`);
  return [];
}

async function fallbackScrape(apiKey: string, datasetId: string, urls: string[], limit: number): Promise<RawFbListing[]> {
  const scrapeEndpoint = `https://api.brightdata.com/datasets/v3/scrape?dataset_id=${encodeURIComponent(
    datasetId
  )}&include_errors=true&type=discover_new&discover_by=url`;

  const requestBody = {
    input: urls.map((url) => ({ url, country: 'ZA' })),
    limit_per_input: limit,
  };

  try {
    const res = await axios.post(scrapeEndpoint, requestBody, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 180000, // 3 minutes for synchronous collection
    });

    if (Array.isArray(res.data)) return res.data;
    if (res.data && Array.isArray(res.data.data)) return res.data.data;
    return [];
  } catch (e: any) {
    console.error('[brightdata] Fallback /scrape failed:', e?.message || e);
    return [];
  }
}
