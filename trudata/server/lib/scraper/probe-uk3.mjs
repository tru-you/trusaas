/* Dump the worker's AutoTrader UK HTML and hunt for the results layer:
 * embedded JSON state, XHR/API endpoints, result containers. */
const AT = "https://www.autotrader.co.uk/car-search?make=Ford&model=Fiesta&year-from=2021&year-to=2021";
const WORKER = "https://trusaas-crm-scraper.onrender.com";
const fs = await import("fs");

const res = await fetch(`${WORKER}/scrape`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: AT }), signal: AbortSignal.timeout(60000),
});
const body = await res.json();
const html = body?.html || "";
fs.writeFileSync(".tmp/at-uk-worker.html", html);
console.log("saved", html.length, "bytes → .tmp/at-uk-worker.html");

const hits = {
  scripts: (html.match(/<script[^>]*src="([^"]+)"/g) || []).slice(0, 20),
  apiHints: [...new Set((html.match(/["'`](\/[a-z-]*api[a-z-]*\/[^"'`\s]{3,80}|https?:\/\/[^"'`\s]*api[^"'`\s]{3,80})/gi) || []))].slice(0, 15),
  graphql: html.includes("graphql"),
  searchResultsWord: (html.match(/search[-_ ]?results?/gi) || []).length,
  dataAttrs: [...new Set((html.match(/data-(?:test|component|tracking)="[^"]+"/g) || []))].slice(0, 20),
  classNames: [...new Set((html.match(/class="[^"]*(?:result|listing|vehicle|card)[^"]*"/gi) || []))].slice(0, 15),
  nextOrRemix: html.includes("__NEXT_DATA__") || html.includes("__remixContext") || html.includes("window.__"),
  windowVars: [...new Set((html.match(/window\.__[A-Z_]+/g) || []))].slice(0, 10),
};
console.log(JSON.stringify(hits, null, 2));
