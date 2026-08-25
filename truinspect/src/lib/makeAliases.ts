/**
 * Client-safe make normalisation — forwarded to the shared market-scraper.
 * Must never import node built-ins (used by the browser TradeInValuation).
 */
export { CANONICAL_MAKES, urlMake } from "../../../packages/market-scraper";
