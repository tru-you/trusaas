/**
 * Market-value scraper — forwards to the shared market-scraper package.
 *
 * Thin re-export so TruLens and every other app run the SAME market-agnostic
 * engine (packages/market-scraper). SA behaviour is identical; swap markets via
 * fetchValuation(..., market) or a MarketConfig for US/UK/housing.
 */
export * from "../../../packages/market-scraper";
export { fetchValuation } from "../../../packages/market-scraper";
