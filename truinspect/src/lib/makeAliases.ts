/**
 * Client-safe make normalisation — imported by BOTH the server scraper
 * (src/lib/scraper.ts loads it through Node with fs/path) and the browser UI
 * (TradeInValuation). This module must never import node built-ins.
 */

export const CANONICAL_MAKES: Record<string, string> = {
  vw: 'Volkswagen',
  volkswagen: 'Volkswagen',
  'mercedes-benz': 'Mercedes-Benz',
  mercedes: 'Mercedes-Benz',
  'land rover': 'Land Rover',
  landrover: 'Land Rover',
  'alfa romeo': 'Alfa Romeo',
  alfa: 'Alfa Romeo',
};

/** Classifieds/search sites key makes by their canonical spelling — AutoTrader
 *  knows "Volkswagen", not "VW", and returns an empty page otherwise. */
export function urlMake(make: string): string {
  return CANONICAL_MAKES[String(make).toLowerCase().trim()] || String(make);
}