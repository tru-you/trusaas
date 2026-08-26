/**
 * Netlify Function — /api/markets + /api/valuation.
 * Bundled inline (esbuild) so it needs no runtime node_modules.
 * Keys are set per-site via Netlify env vars (BRIGHTDATA_API_KEY, SERP_API_KEY, …).
 */
import { fetchValuation, markets } from "../../index";

const LABELS: Record<string, string> = {
  za: "South Africa — cars",
  us: "United States — cars",
  uk: "United Kingdom — cars",
  housingZa: "South Africa — property",
};

const json = (statusCode: number, body: any) => ({
  statusCode,
  headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function handler(event: any) {
  const path = (event.rawPath || event.path || "").replace(/\/+$/, "");
  const method = event.httpMethod || event.requestContext?.http?.method || "GET";

  if (path === "/api/markets") {
    return json(200, Object.keys(markets).map((id) => ({ id, label: LABELS[id] || id })));
  }

  if (path === "/api/valuation" && method === "POST") {
    let body: any = {};
    try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Invalid JSON" }); }
    const { make, model, year, mileage, market, location } = body;
    if (!make || !model || !year) return json(400, { error: "make, model, and year are required" });
    try {
      const cfg = markets[market || "za"] || markets.za;
      const m = cfg.id === "housingZa" ? (location || make) : make;
      const data = await fetchValuation(String(m), String(model), String(year), {
        mileage: Number(mileage) || undefined,
      }, cfg);
      return json(200, data);
    } catch (err: any) {
      return json(502, { error: err?.message || "Valuation failed" });
    }
  }

  return json(404, { error: "Not found" });
}
