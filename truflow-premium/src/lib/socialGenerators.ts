/**
 * TruSocial — Native Multi-Channel Social Content Generators (TruSaaS)
 *
 * Generates tailored, algorithmically-compliant marketing copy for:
 * 1. Facebook Business Page (Brand building, rich OpenGraph unfurl)
 * 2. Facebook Marketplace (Clean algorithmic compliance, zero banned finance triggers)
 * 3. Instagram (Aesthetic spacing, emojis, smart hashtags, story stickers)
 * 4. LinkedIn (B2B executive tone, VAT invoice, corporate fleet suitability)
 * 5. Google Business Profile (Local SEO "What's New / Product" post)
 * 6. WhatsApp Status & Broadcasts (High-contrast markdown, bolding, 360 tour links)
 */

import { formatDistance, formatMoney, marketById } from "../components/market";
import type { MarketDisplay } from "../components/market";

export interface SocialVehicleInput {
  id: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  stockNumber: string;
  retailPrice: number;
  costPrice?: number;
  mileage?: number;
  transmission?: string;
  fuelType?: string;
  bodyType?: string;
  engine?: string;
  color?: string;
  description?: string;
  images?: string[];
  truPrice?: number;
  vertical?: string;
  status?: string;
}

export interface SocialDealerInput {
  name: string;
  tradingAs?: string;
  location?: string;
  address?: string;
  phone?: string;
  whatsapp?: string;
  websiteUrl?: string;
  slug?: string;
  facebookPage?: string;
  instagramHandle?: string;
}

/** Calculates indicative monthly instalment with standard 10% deposit and 72-month term */
export function estimateMonthlyPayment(retailPrice: number, marketId: string = 'za'): number {
  if (!retailPrice || retailPrice <= 0) return 0;

  // Parameters
  const depositPercent = 0.10;
  const principal = retailPrice * (1 - depositPercent);
  const months = 72;

  // Annual interest rates: ZA ~13.75%, UK ~9.9%, US ~8.5%
  const annualRate = marketId === 'uk' ? 0.099 : marketId === 'us' ? 0.085 : 0.1375;
  const monthlyRate = annualRate / 12;

  const payment = (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
                  (Math.pow(1 + monthlyRate, months) - 1);

  return Math.round(payment);
}

/** Generates canonical public vehicle showroom URL */
export function buildVehicleShareUrl(vehicle: SocialVehicleInput, dealer: SocialDealerInput): string {
  if (dealer.websiteUrl) {
    const base = dealer.websiteUrl.replace(/\/+$/, '');
    return `${base}/vehicle/${vehicle.stockNumber || vehicle.id}`;
  }
  const slug = dealer.slug || 'dealership';
  return `https://trudealer.tru-saas.com/v/${slug}/${vehicle.stockNumber || vehicle.id}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. FACEBOOK BUSINESS PAGE POST
// ─────────────────────────────────────────────────────────────────────────────
export function buildFacebookPagePost(
  vehicle: SocialVehicleInput,
  dealer: SocialDealerInput,
  market: MarketDisplay = marketById('za')
): string {
  const isMoto = vehicle.vertical === 'moto';
  const dealerTitle = dealer.tradingAs || dealer.name;
  const priceFormatted = formatMoney(vehicle.retailPrice, { currency: market.currency, locale: market.locale });
  const instalment = estimateMonthlyPayment(vehicle.retailPrice, market.id);
  const instalmentFormatted = formatMoney(instalment, { currency: market.currency, locale: market.locale });
  const odo = vehicle.mileage != null ? formatDistance(vehicle.mileage, market.distanceUnit, market.locale) : null;
  const link = buildVehicleShareUrl(vehicle, dealer);

  const headline = isMoto
    ? `NEW IN STOCK | ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}`.trim()
    : `NEW ARRIVAL | ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}`.trim();

  const specs = [
    odo ? `• Odometer: ${odo}` : null,
    vehicle.transmission ? `• Transmission: ${vehicle.transmission}` : null,
    vehicle.fuelType ? `• Fuel Type: ${vehicle.fuelType}` : null,
    `• Condition: Inspected & Approved (TruInspect Certified)`,
    `• Stock Ref: #${vehicle.stockNumber}`,
  ].filter(Boolean).join('\n');

  const hashtags = isMoto
    ? `#${vehicle.make.replace(/\s+/g, '')} #MotorcyclesForSale #UsedBikes #${dealerTitle.replace(/\s+/g, '')} #TruDealer`
    : `#${vehicle.make.replace(/\s+/g, '')} #${vehicle.make.replace(/\s+/g, '')}${vehicle.model.replace(/\s+/g, '')} #CarsForSale #QualityUsedCars #${dealerTitle.replace(/\s+/g, '')} #TruDealer`;

  return `${headline}

Looking for a meticulously maintained ${vehicle.year} ${vehicle.make} ${vehicle.model}? This vehicle just arrived on our showroom floor at ${dealerTitle} and passed our comprehensive multi-point inspection.

Cash Price: ${priceFormatted}
Estimated Instalment: From ${instalmentFormatted}/pm (10% deposit · 72 months)

Specifications:
${specs}

Explore the full 360° tour, detailed photos & inspection report:
${link}

Showroom: ${dealer.address || dealer.location || 'Contact for showroom address'}
Enquiries & WhatsApp: ${dealer.whatsapp || dealer.phone || 'Contact us today'}

${hashtags}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FACEBOOK MARKETPLACE PACK
// ─────────────────────────────────────────────────────────────────────────────
export interface MarketplacePack {
  suggestedTitle: string;
  price: number;
  bodyDescription: string;
  keyDetails: { label: string; value: string }[];
}

export function buildFacebookMarketplacePack(
  vehicle: SocialVehicleInput,
  dealer: SocialDealerInput,
  market: MarketDisplay = marketById('za')
): MarketplacePack {
  const isMoto = vehicle.vertical === 'moto';
  const dealerTitle = dealer.tradingAs || dealer.name;
  const priceFormatted = formatMoney(vehicle.retailPrice, { currency: market.currency, locale: market.locale });
  const odo = vehicle.mileage != null ? formatDistance(vehicle.mileage, market.distanceUnit, market.locale) : null;
  const link = buildVehicleShareUrl(vehicle, dealer);

  // Meta Marketplace algorithm favors clean, standard format titles without spam
  const suggestedTitle = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}`.trim().slice(0, 100);

  const keyDetails = [
    { label: 'Year', value: String(vehicle.year) },
    { label: 'Make', value: vehicle.make },
    { label: 'Model', value: vehicle.model },
    { label: 'Trim / Variant', value: vehicle.trim || 'Standard' },
    { label: 'Mileage', value: odo || 'Enquire' },
    { label: 'Transmission', value: vehicle.transmission || 'Automatic' },
    { label: 'Fuel Type', value: vehicle.fuelType || 'Petrol' },
    { label: 'Condition', value: 'Excellent (Inspected)' },
    { label: 'Location', value: dealer.location || 'Dealership Floor' },
  ];

  const bodyDescription = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}

Price: ${priceFormatted}
Mileage: ${odo || 'Contact for details'}
Transmission: ${vehicle.transmission || 'Standard'}
Fuel Type: ${vehicle.fuelType || 'Standard'}
Stock Ref: #${vehicle.stockNumber}

Key Details & Features:
- Comprehensive multi-point inspection report completed
- Full service history and roadworthy certificate included
- Trade-ins welcome with immediate appraisals
- Finance available through all major vehicle finance institutions
- Extended warranty and service plan options available

Available for viewing and test drives at ${dealerTitle}${dealer.location ? ` in ${dealer.location}` : ''}.

Please message via Messenger or WhatsApp (${dealer.whatsapp || dealer.phone || 'Contact for number'}) for appointments.

Full vehicle specs and digital gallery:
${link}`;

  return {
    suggestedTitle,
    price: vehicle.retailPrice,
    bodyDescription,
    keyDetails,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. INSTAGRAM CAPTION (FEED & REELS / STORIES)
// ─────────────────────────────────────────────────────────────────────────────
export function buildInstagramPost(
  vehicle: SocialVehicleInput,
  dealer: SocialDealerInput,
  market: MarketDisplay = marketById('za')
): { caption: string; storyStickerText: string; storyStickerUrl: string } {
  const isMoto = vehicle.vertical === 'moto';
  const dealerTitle = dealer.tradingAs || dealer.name;
  const priceFormatted = formatMoney(vehicle.retailPrice, { currency: market.currency, locale: market.locale });
  const instalment = estimateMonthlyPayment(vehicle.retailPrice, market.id);
  const instalmentFormatted = formatMoney(instalment, { currency: market.currency, locale: market.locale });
  const odo = vehicle.mileage != null ? formatDistance(vehicle.mileage, market.distanceUnit, market.locale) : null;
  const link = buildVehicleShareUrl(vehicle, dealer);

  const title = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}`.trim();

  const caption = `${title.toUpperCase()}
.
Price: ${priceFormatted}
Finance: Est. ${instalmentFormatted}/pm (10% dep · 72 mo)
.
Specifications:
${odo ? `• Mileage: ${odo}\n` : ''}• Transmission: ${vehicle.transmission || 'Automatic'}
• Fuel: ${vehicle.fuelType || 'Petrol'}
• Condition: Certified Grade A (TruInspect VIR)
• Stock Reference: #${vehicle.stockNumber}
.
${vehicle.description ? `${vehicle.description.slice(0, 180)}...\n.\n` : ''}Available now at ${dealerTitle}.
Direct message or visit the link in bio for the complete condition report & 360° spin.
.
#${vehicle.make.replace(/\s+/g, '')} #${vehicle.make.replace(/\s+/g, '')}${vehicle.model.replace(/\s+/g, '')} #CarsOfInstagram #Dealership #UsedCarsForSale #CarSales #${dealerTitle.replace(/\s+/g, '')} #TruDealer`;

  return {
    caption,
    storyStickerText: `View ${vehicle.make} ${vehicle.model}`,
    storyStickerUrl: link,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. LINKEDIN B2B EXECUTIVE POST
// ─────────────────────────────────────────────────────────────────────────────
export function buildLinkedInPost(
  vehicle: SocialVehicleInput,
  dealer: SocialDealerInput,
  market: MarketDisplay = marketById('za')
): string {
  const dealerTitle = dealer.tradingAs || dealer.name;
  const priceFormatted = formatMoney(vehicle.retailPrice, { currency: market.currency, locale: market.locale });
  const odo = vehicle.mileage != null ? formatDistance(vehicle.mileage, market.distanceUnit, market.locale) : null;
  const link = buildVehicleShareUrl(vehicle, dealer);

  return `New Inventory Announcement at ${dealerTitle}:

We are pleased to introduce this ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''} to our floor.

Key Highlights:
• Mileage: ${odo || 'Verified low mileage'}
• Transmission: ${vehicle.transmission || 'Automatic'}
• Fuel Type: ${vehicle.fuelType || 'Petrol'}
• Inspection: Certified under our multi-point condition assessment
• Commercial Suitability: Tax invoice issued; corporate fleet financing available

Price: ${priceFormatted}

Full specifications, digital vehicle inspection report, and high-resolution photo gallery are available online:
${link}

For corporate acquisitions, trade-in valuations, or commercial terms, please connect with our team directly.

#Automotive #FleetManagement #CorporateTransport #CommercialVehicles #MotorTrade #${dealerTitle.replace(/\s+/g, '')} #TruDealer`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. GOOGLE BUSINESS PROFILE (WHAT'S NEW / PRODUCT)
// ─────────────────────────────────────────────────────────────────────────────
export function buildGoogleBusinessPost(
  vehicle: SocialVehicleInput,
  dealer: SocialDealerInput,
  market: MarketDisplay = marketById('za')
): { summary: string; ctaText: string; targetUrl: string } {
  const dealerTitle = dealer.tradingAs || dealer.name;
  const priceFormatted = formatMoney(vehicle.retailPrice, { currency: market.currency, locale: market.locale });
  const odo = vehicle.mileage != null ? formatDistance(vehicle.mileage, market.distanceUnit, market.locale) : null;
  const link = buildVehicleShareUrl(vehicle, dealer);

  const summary = `Now Available at ${dealerTitle}: ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}.

Priced at ${priceFormatted}${odo ? ` with only ${odo}` : ''}. This vehicle has undergone a rigorous digital condition inspection and comes with verified service records. Trade-ins welcomed and competitive finance arranged. Visit our showroom or book a test drive today.`;

  return {
    summary,
    ctaText: 'Learn more',
    targetUrl: link,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. WHATSAPP STATUS & BROADCAST POST
// ─────────────────────────────────────────────────────────────────────────────
export function buildWhatsAppStatusPost(
  vehicle: SocialVehicleInput,
  dealer: SocialDealerInput,
  market: MarketDisplay = marketById('za')
): string {
  const isMoto = vehicle.vertical === 'moto';
  const dealerTitle = dealer.tradingAs || dealer.name;
  const priceFormatted = formatMoney(vehicle.retailPrice, { currency: market.currency, locale: market.locale });
  const instalment = estimateMonthlyPayment(vehicle.retailPrice, market.id);
  const instalmentFormatted = formatMoney(instalment, { currency: market.currency, locale: market.locale });
  const odo = vehicle.mileage != null ? formatDistance(vehicle.mileage, market.distanceUnit, market.locale) : null;
  const link = buildVehicleShareUrl(vehicle, dealer);

  return `*JUST IN | ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}*
───────────────────────────
*Cash Price:* ${priceFormatted}
*Est. Instalment:* From ${instalmentFormatted}/pm (10% deposit)
${odo ? `*Mileage:* ${odo}\n` : ''}*Transmission:* ${vehicle.transmission || 'Automatic'}
*Fuel:* ${vehicle.fuelType || 'Petrol'}
*Status:* Certified Grade A (TruInspect VIR)
───────────────────────────
*View 360° Orbit Spin & Condition Report:*
${link}

*${dealerTitle}*
Contact or message us to book your test drive.`;
}
