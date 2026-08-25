/**
 * Market-value scraper — forwards to the shared market-scraper package.
 *
 * This file is now a thin re-export so TruFlow Premium and every other app run
 * the SAME market-agnostic engine (packages/market-scraper). Behaviour for the
 * SA market is identical to the old in-app scraper; swap markets via
 * fetchValuation(..., market) or a MarketConfig for US/UK/housing.
 */
export * from "../../../packages/market-scraper";
export { fetchValuation } from "../../../packages/market-scraper";
