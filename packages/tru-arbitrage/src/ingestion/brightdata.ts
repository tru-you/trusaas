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

  const endpoint = `https://api.brightdata.com/datasets/v3/scrape?dataset_id=${encodeURIComponent(
    datasetId
  )}&include_errors=true&type=discover_new&discover_by=url`;

  const requestBody = {
    input: urls.map((url) => ({ url, country: 'ZA' })),
    limit_per_input: limit,
  };

  try {
    console.log(`[brightdata] Triggering scrape for ${urls.length} SA locations on dataset ${datasetId}...`);
    const res = await axios.post(endpoint, requestBody, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    });

    if (Array.isArray(res.data)) {
      return res.data;
    }

    if (res.data && Array.isArray(res.data.data)) {
      return res.data.data;
    }

    console.warn('[brightdata] Unexpected response structure:', res.data);
    return [];
  } catch (err: any) {
    console.error('[brightdata] Ingestion request failed:', err?.response?.data || err?.message || err);
    throw err;
  }
}
