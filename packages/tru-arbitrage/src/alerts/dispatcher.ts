import axios from 'axios';
import { ArbitrageDeal, DealerBuyBox } from '../types';
import { formatDealAlertText, formatSellerOfferTemplate } from './alert-text';

export function matchesBuyBox(deal: ArbitrageDeal, buyBox: DealerBuyBox): boolean {
  if (!buyBox.active) return false;

  const v = deal.vehicle;

  // 1. Margin threshold check
  if (deal.projectedNetMargin < buyBox.minNetMargin) {
    return false;
  }

  // 2. Max Price check
  if (deal.askingPrice > buyBox.maxPrice) {
    return false;
  }

  // 3. Max Mileage check
  if (buyBox.maxMileageKm && v.mileageKm && v.mileageKm > buyBox.maxMileageKm) {
    return false;
  }

  // 4. Allowed Makes check
  if (buyBox.allowedMakes && buyBox.allowedMakes.length > 0) {
    const makeMatch = buyBox.allowedMakes.some((m) => m.toLowerCase() === v.make.toLowerCase());
    if (!makeMatch) return false;
  }

  // 5. Location / Province check
  if (buyBox.provinces && buyBox.provinces.length > 0) {
    const loc = (v.location || '').toLowerCase();
    const provinceMatch = buyBox.provinces.some((p) => loc.includes(p.toLowerCase()));
    if (!provinceMatch && !loc.includes('south africa')) {
      return false;
    }
  }

  return true;
}

/** Webhook-only dispatch. Alerts reach the dealer's own system (their Flow
 *  instance, CRM, or anything that speaks HTTP) — no channel is owned here. */
export async function dispatchDealAlerts(deal: ArbitrageDeal, subscriptions: DealerBuyBox[]): Promise<number> {
  let alertCount = 0;

  for (const sub of subscriptions) {
    if (!matchesBuyBox(deal, sub)) continue;

    const alertText = formatDealAlertText(deal, sub);
    const offerTemplate = formatSellerOfferTemplate(deal, sub.dealerName);

    console.log(`📢 [ALERT -> ${sub.dealerName}] ${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model} — ${deal.dealCategory}${sub.webhookUrl ? '' : ' (no webhook configured)'}`);

    if (sub.webhookUrl) {
      try {
        await axios.post(
          sub.webhookUrl,
          {
            event: 'arbitrage_deal_matched',
            deal,
            dealer: { id: sub.id, name: sub.dealerName },
            alertText,
            suggestedOffer: offerTemplate,
          },
          { timeout: 5000 }
        );
      } catch (err: any) {
        console.warn(`[dispatcher] Webhook dispatch failed for ${sub.dealerName}:`, err?.message || err);
      }
    }

    alertCount++;
  }

  return alertCount;
}