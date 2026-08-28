import axios from 'axios';
import { RawFbListing, NormalizedVehicle } from '../types';
import { CONFIG } from '../config';
import { normalizeViaRegex } from './regex-fastpath';
import { normalizeViaNativeScraper } from './native-scraper';
import { CANONICAL_MAKES } from './make-aliases';

interface GeminiVehicleJson {
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  mileageKm?: number;
  askingPrice?: number;
  isDamagedOrSalvage?: boolean;
  isWantedAd?: boolean;
  confidence?: number;
}

export async function normalizeViaGeminiFlash(raw: RawFbListing): Promise<NormalizedVehicle | null> {
  const combined = `Title: ${raw.title || ''}\nDescription: ${raw.description || ''}\nListed Price: ${raw.final_price ?? raw.price ?? ''}\nLocation: ${raw.location || ''}`;
  
  if (!CONFIG.GEMINI_API_KEY) {
    return null;
  }

  const prompt = `You are a vehicle data extraction assistant in South Africa.
Extract structured vehicle details from this raw Facebook Marketplace post.
Return ONLY valid JSON matching this schema:
{
  "year": number (e.g. 2017),
  "make": string (canonical make, e.g. "Volkswagen", "Toyota", "Ford", "BMW"),
  "model": string (base model, e.g. "Polo", "Hilux", "Ranger", "3 Series"),
  "trim": string or null (e.g. "1.2 TSI Comfortline", "2.8 GD-6 4x4"),
  "mileageKm": number or null (e.g. 140000),
  "askingPrice": number (in South African Rand ZAR, e.g. 135000),
  "isDamagedOrSalvage": boolean (true if non-runner, gearbox problem, code 3/4, accident damaged, or for spares),
  "isWantedAd": boolean (true if buyer looking to buy / swap / wtb),
  "confidence": number (between 0.0 and 1.0)
}

Input:
${combined}`;

  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`,
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      },
      { timeout: 5000 }
    );

    const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed: GeminiVehicleJson = JSON.parse(text);
    if (!parsed.year || !parsed.make || !parsed.model || !parsed.askingPrice) {
      return null;
    }

    const canonical = CANONICAL_MAKES[parsed.make.toLowerCase().trim()] || parsed.make;
    const images = Array.isArray(raw.images)
      ? raw.images
      : typeof raw.images === 'string'
      ? [raw.images]
      : [];

    return {
      rawId: raw.id || raw.item_id || String(Math.random()),
      source: raw.source || 'facebook',
      url: raw.url || '',
      title: raw.title || '',
      year: parsed.year,
      make: canonical,
      model: parsed.model,
      trim: parsed.trim || undefined,
      mileageKm: parsed.mileageKm || null,
      askingPrice: parsed.askingPrice,
      location: raw.location || 'South Africa',
      sellerId: raw.seller_id,
      sellerName: raw.seller_name,
      images,
      isDamagedOrSalvage: !!parsed.isDamagedOrSalvage,
      isWantedAd: !!parsed.isWantedAd,
      confidence: parsed.confidence ?? 0.85,
      normalizedBy: 'gemini_flash',
    };

  } catch (err: any) {
    console.warn('[gemini-normalizer] extraction failed:', err?.message || err);
    return null;
  }
}

export async function normalizeListing(raw: RawFbListing): Promise<NormalizedVehicle | null> {
  // 0. Native structured feed (Flow stock) — typed fields, zero heuristics, zero cost
  const nativeResult = normalizeViaNativeScraper(raw);
  if (nativeResult) return nativeResult;

  // 1. Fast Regex (0ms, $0)
  const regexResult = normalizeViaRegex(raw);
  if (regexResult && regexResult.confidence >= 0.9) {
    return regexResult;
  }

  // 2. Gemini Flash Fallback
  if (CONFIG.GEMINI_API_KEY) {
    const geminiResult = await normalizeViaGeminiFlash(raw);
    if (geminiResult) return geminiResult;
  }

  // 3. Return regex result if it at least got the core fields
  return regexResult;
}
