/**
 * Alert + offer text formatting — TruRadar.
 *
 * WhatsApp is retired as a delivery channel — alerts reach dealers via the
 * dashboard and webhook only. This module produces the plain-text payload that
 * rides inside the webhook body (dealers' systems decide how to surface it)
 * and the suggested seller-offer text a dealer can act on from the card.
 */
import { ArbitrageDeal, DealerBuyBox } from '../types';

const SOURCE_LABELS: Record<string, string> = {
  facebook: 'Facebook Marketplace',
  cars_co_za: 'Cars.co.za Dealer Listing',
  autotrader: 'AutoTrader SA',
  dealer_direct: 'Independent Dealer Site (Google SERP)',
  gumtree: 'Gumtree Private',
  webuycars: 'WeBuyCars Wholesale',
};

const CATEGORY_BADGES: Record<string, string> = {
  underpriced_arbitrage: '⚡ UNDERPRICED ARBITRAGE',
  stale_floorplan_distress: `🔥 STALE FLOORPLAN DISTRESS`,
  price_drop_velocity: '📉 MAJOR PRICE DROP VELOCITY',
};

/** Plain-text deal alert for the webhook payload (no channel-specific markup). */
export function formatDealAlertText(deal: ArbitrageDeal, dealer: DealerBuyBox): string {
  const v = deal.vehicle;
  const kmFormatted = v.mileageKm ? `${v.mileageKm.toLocaleString('en-ZA')} km` : 'Unspecified km';

  const sourceLabel = SOURCE_LABELS[deal.source] || 'Private Market';
  const categoryBadge = CATEGORY_BADGES[deal.dealCategory] || '⭐ HIGH-MARGIN OPPORTUNITY';

  return `[TruRadar] ${categoryBadge} — for ${dealer.dealerName}
━━━━━━━━━━━━━━━━━━━━
${v.year} ${v.make} ${v.model} ${v.trim ? `(${v.trim})` : ''}
Location: ${v.location}
Source: ${sourceLabel}
Days on Market: ${deal.daysOnMarket} (Urgency: ${deal.urgencyScore}/100)
Mileage: ${kmFormatted}

FINANCIAL BENCHMARK:
• Listed asking price: R${deal.askingPrice.toLocaleString('en-ZA')}
• Live market retail: R${deal.marketRetailPrice.toLocaleString('en-ZA')} (based on ${deal.sampleCompsCount} comps)
• Gross margin: R${deal.projectedGrossMargin.toLocaleString('en-ZA')}
• Recon & safety buffer: -R${deal.reconBuffer.toLocaleString('en-ZA')}
PROJECTED NET PROFIT: R${deal.projectedNetMargin.toLocaleString('en-ZA')} (+${deal.marginPercentage}%)

View listing: ${v.url}
Seller / Dealer: ${v.sellerName || 'Direct Seller'}`;
}

/** Suggested offer text — the dealer-initiated message to a seller. */
export function formatSellerOfferTemplate(deal: ArbitrageDeal, dealerName: string): string {
  const v = deal.vehicle;
  const isDealer = deal.source === 'cars_co_za' || deal.source === 'autotrader' || deal.source === 'dealer_direct';
  const offerPrice = Math.round(deal.askingPrice * 0.93);

  if (isDealer) {
    return `Hi ${v.sellerName || 'Trade Desk'}, I'm following up on your ${v.year} ${v.make} ${v.model} listed on your floor.

We are looking for dealer-to-dealer wholesale stock for ${dealerName}. Can you do a trade release at R${offerPrice.toLocaleString('en-ZA')} on floorplan settlement? Instant payment available today.`;
  }

  return `Hi ${v.sellerName || 'there'}, I saw your ${v.year} ${v.make} ${v.model} listed for sale.

I'm a verified buyer with ${dealerName}. If the vehicle is still available and papers are in order, we can make an immediate cash offer of R${offerPrice.toLocaleString('en-ZA')}, handle all the roadworthy and transfer paperwork, and pay via instant EFT today.

Are you available for a quick viewing/inspection?`;
}