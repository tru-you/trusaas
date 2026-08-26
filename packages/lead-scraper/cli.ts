/**
 * lead-scraper CLI — run one vertical, write a CSV.
 *
 *   npx tsx cli.ts jobs
 *   npx tsx cli.ts dealers
 *   npx tsx cli.ts property
 *
 * Keys come from env (or a .env in cwd): ADZUNA_APP_ID/KEY, BRIGHTDATA_API_KEY,
 * BRIGHTDATA_SERP_ZONE (default "tds"), BRIGHTDATA_UNLOCKER_ZONE (default "tds2").
 */

import fs from "fs";
import { loadEnv, toCsv, writeScraperStore, httpPost } from "./core";
import { searchJobs, JOB_COLUMNS, type JobSearchParams } from "./verticals/jobs";
import { searchDealers, DEALER_COLUMNS } from "./verticals/dealers";
import { searchProperty, PROPERTY_COLUMNS } from "./verticals/property";

loadEnv();

const JOBS_DEFAULTS: JobSearchParams = {
  roles: [
    { name: "Appointment Setting", what: "appointment setter" },
    { name: "SDR", what: "sales development representative" },
    { name: "BDR", what: "business development representative" },
    { name: "SEO / AEO", what: "seo specialist" },
    { name: "AEO", what: "answer engine optimization" },
    { name: "PPC", what: "ppc specialist" },
    { name: "Media Buying", what: "media buyer" },
    { name: "AI Automation", what: "ai automation" },
    { name: "Development", what: "software developer" },
  ],
  countries: ["gb", "us"],
  maxDaysOld: 30,
  excludeAgencies: true,
  remoteOnly: false,
  resultsPerRole: 12,
  enrich: true,
  maxEnrich: 15,
};

async function main() {
  const vertical = process.argv[2] || "jobs";
  const t0 = Date.now();

  let leads: any[] = [];
  let cols: string[] = [];
  if (vertical === "jobs") {
    leads = await searchJobs(JOBS_DEFAULTS);
    cols = JOB_COLUMNS;
  } else if (vertical === "dealers") {
    leads = await searchDealers({ countries: ["za"] });
    cols = DEALER_COLUMNS;
  } else if (vertical === "property") {
    leads = await searchProperty({ countries: ["za"] });
    cols = PROPERTY_COLUMNS;
  } else {
    console.error(`unknown vertical "${vertical}" — jobs | dealers | property`);
    process.exit(1);
  }

  const out = `${vertical}-leads.csv`;
  fs.writeFileSync(out, toCsv(leads, cols), "utf-8");
  const enriched = leads.filter((l) => l.website || l.emails.length || l.phones.length).length;
  console.log(`\n[lead-scraper:${vertical}] ${leads.length} leads → ${out} in ${((Date.now() - t0) / 1000).toFixed(1)}s (enriched: ${enriched})`);

  if (process.argv.includes("--upload")) {
    const dataDir = process.env.CRM_DATA_DIR || process.env.DATA_DIR || "data";
    const ws = vertical === "jobs" ? "pipeline-south" : vertical === "dealers" ? "default" : "truproperty";
    const file = writeScraperStore(leads, dataDir, ws);
    console.log(`  → CRM store: ${file} (merged + deduped by id)`);
  }

  // --push <url>  → POST leads to the CRM's /api/leads/import (automation).
  const pushIdx = process.argv.indexOf("--push");
  const pushUrl = pushIdx !== -1 ? process.argv[pushIdx + 1] : "";
  if (pushUrl) {
    const key = process.env.SCRAPER_API_KEY || "";
    try {
      const { status, text } = await httpPost(
        `${pushUrl.replace(/\/$/, "")}/api/leads/import`,
        { leads },
        key ? { "x-scraper-key": key } : {}
      );
      if (status === 200) {
        const body = JSON.parse(text);
        console.log(`  → pushed to CRM: ${body.imported} imported, ${body.skipped} skipped`);
      } else {
        console.log(`  → push failed (HTTP ${status}): ${text.slice(0, 200)}`);
      }
    } catch (e: any) {
      console.log(`  → push failed: ${e?.message || e}`);
    }
  }
  for (const l of leads.slice(0, 10)) {
    console.log(`  ${l.name}${l.title ? " — " + l.title : ""}${l.website ? " | " + l.website : ""}${l.emails?.length ? " | " + l.emails[0] : ""}`);
  }
}

main().catch((e) => {
  console.error("[lead-scraper] failed:", e?.message || e);
  process.exit(1);
});
