import { ArbitrageDeal, DealerBuyBox } from '../types';

export function formatDealerWhatsAppAlert(deal: ArbitrageDeal, dealer: DealerBuyBox): string {
  const v = deal.vehicle;
  const kmFormatted = v.mileageKm ? `${v.mileageKm.toLocaleString('en-ZA')} km` : 'Unspecified km';
  const priceFormatted = `R${deal.askingPrice.toLocaleString('en-ZA')}`;
  const retailFormatted = `R${deal.marketRetailPrice.toLocaleString('en-ZA')}`;
  const netMarginFormatted = `R${deal.projectedNetMargin.toLocaleString('en-ZA')}`;
  const grossMarginFormatted = `R${deal.projectedGrossMargin.toLocaleString('en-ZA')}`;

  const sourceLabels: Record<string, string> = {
    facebook: 'Facebook Marketplace',
    cars_co_za: 'Cars.co.za Dealer Listing',
    autotrader: 'AutoTrader SA',
    dealer_direct: 'Independent Dealer Site (Google SERP)',
    gumtree: 'Gumtree Private',
    webuycars: 'WeBuyCars Wholesale',
  };

  const categoryBadges: Record<string, string> = {
    underpriced_arbitrage: '⚡ UNDERPRICED ARBITRAGE',
    stale_floorplan_distress: `🔥 STALE FLOORPLAN DISTRESS (${deal.daysOnMarket}d on floor)`,
    price_drop_velocity: '📉 MAJOR PRICE DROP VELOCITY',
  };

  const sourceLabel = sourceLabels[deal.source] || 'Private Market';
  const categoryBadge = categoryBadges[deal.dealCategory] || '⭐ HIGH-MARGIN OPPORTUNITY';

  return `🚨 *TRUARBITRAGE RADAR ALERT* [${categoryBadge}]
━━━━━━━━━━━━━━━━━━━━
🚗 *${v.year} ${v.make} ${v.model}* ${v.trim ? `(${v.trim})` : ''}
📍 *Location:* ${v.location}
🌐 *Source:* ${sourceLabel}
⏱ *Days on Market:* ${deal.daysOnMarket} days (Urgency: ${deal.urgencyScore}/100)
🛣 *Mileage:* ${kmFormatted}

💰 *FINANCIAL BENCHMARK:*
• *Listed Asking Price:* ${priceFormatted}
• *Live Market Retail:* ${retailFormatted} (Based on ${deal.sampleCompsCount} comps)
• *Gross Margin:* ${grossMarginFormatted}
• *Recon & Safety Buffer:* -R${deal.reconBuffer.toLocaleString('en-ZA')}
⭐ *PROJECTED NET PROFIT: ${netMarginFormatted}* (+${deal.marginPercentage}%)

━━━━━━━━━━━━━━━━━━━━
👉 *View Listing:* ${v.url}
💬 *Seller / Dealer:* ${v.sellerName || 'Direct Seller'}
`;
}

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
