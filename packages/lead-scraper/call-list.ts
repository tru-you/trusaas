import fs from "fs";
import { loadEnv, toCsv, writeScraperStore, writeCrmLeadsDirect, pushLeadsToCrm } from "./core";
import { searchJobs, DEFAULT_JOB_ROLES } from "./verticals/jobs";
import { searchDealers } from "./verticals/dealers";
import type { Lead } from "./types";

loadEnv();

function toRowCsv(rows: Record<string, string>[], cols: string[]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c] || "")).join(","))].join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const doPush = args.includes("--push");
  const doUpload = args.includes("--upload");
  const doDirect = args.includes("--direct");
  const targetWs = args.find((a) => a.startsWith("--workspace="))?.split("=")[1] || "default";

  console.log("🚀 [call-list] Generating high-yield verified calling list across Hiring & Dealerships...\n");
  const t0 = Date.now();
  const allLeads: Lead[] = [];

  // 1) Hiring companies (UK, US, SA) — verified active employer roles with contact enrichment
  console.log("💼 [1/2] Scraping hiring companies (active job posts, non-agencies)...");
  const jobs = await searchJobs({
    roles: DEFAULT_JOB_ROLES.slice(0, 8),
    countries: ["gb", "us", "za"],
    maxDaysOld: 30,
    excludeAgencies: true,
    resultsPerRole: 8,
    enrich: true,
    maxEnrich: 30,
    concurrency: 6,
  });
  allLeads.push(...jobs);
  console.log(`   → Gathered ${jobs.length} hiring employer leads.`);

  // 2) Dealerships (SA, UK, US) — verified dealer phones, addresses, websites
  console.log("🚗 [2/2] Scraping dealerships (SA & UK & US hubs with phone & contact enrichment)...");
  const dealers = await searchDealers({
    location: "all",
    countries: ["za", "gb", "us"],
    maxDealers: 45,
    concurrency: 6,
    enrich: true,
  });
  allLeads.push(...dealers);
  console.log(`   → Gathered ${dealers.length} dealership leads.`);

  // Flatten into call list rows
  const rows: Record<string, string>[] = allLeads.map((l) => {
    const phone = Array.isArray(l.phones) && l.phones.length > 0 ? l.phones[0] : "";
    const email = Array.isArray(l.emails) && l.emails.length > 0 ? l.emails[0] : "";
    return {
      business: l.name,
      phone,
      email,
      location: l.location || l.country?.toUpperCase() || "",
      type: l.vertical === "jobs" ? "Hiring Employer" : "Car Dealership",
      website: l.website || (l as any).applyUrl || "",
      context: l.context || (l as any).title || (l as any).address || "",
      source: l.source,
    };
  });

  // Dedupe by business name
  const seen = new Set<string>();
  const dedupedRows = rows.filter((r) => {
    const k = r.business.toLowerCase().trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const cols = ["business", "phone", "email", "location", "type", "website", "context", "source"];
  const out = "call-list.csv";
  fs.writeFileSync(out, toRowCsv(dedupedRows, cols), "utf-8");

  const withPhone = dedupedRows.filter((r) => r.phone).length;
  const withEmail = dedupedRows.filter((r) => r.email).length;
  const withSite = dedupedRows.filter((r) => r.website).length;

  console.log(`\n✅ [call-list] ${dedupedRows.length} total businesses generated in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${out}`);
  console.log(`   📞 Direct phones: ${withPhone} | ✉️ Direct emails: ${withEmail} | 🌐 Websites: ${withSite}`);

  // Automated CRM integrations
  if (doUpload) {
    const storePath = writeScraperStore(allLeads, undefined, targetWs);
    console.log(`   💾 Scraper store synced: ${storePath}`);
  }

  if (doDirect) {
    const directRes = writeCrmLeadsDirect(allLeads, targetWs);
    console.log(`   📥 Direct CRM injection: ${directRes.added} leads added to ${directRes.file} (Total: ${directRes.total})`);
  }

  if (doPush) {
    const pushUrl = process.env.CRM_URL || process.env.TRUCRM_URL || "http://localhost:3000";
    console.log(`   🌐 Pushing call list to TruCRM at ${pushUrl} [Workspace: ${targetWs}]...`);
    const pushRes = await pushLeadsToCrm(allLeads, { url: pushUrl, workspace: targetWs });
    if (pushRes.ok) {
      console.log(`   🎉 ${pushRes.message}`);
    } else {
      console.log(`   ⚠️ ${pushRes.message}`);
    }
  }

  console.log(`\n📞 Call List Ready to Dial (Top 8):`);
  for (const r of dedupedRows.slice(0, 8)) {
    console.log(` • \x1b[36m${r.business}\x1b[0m [${r.type}] | 📞 \x1b[32m${r.phone || "Lookup needed"}\x1b[0m | ✉️ ${r.email || "—"} | 📍 ${r.location}`);
  }
}

main().catch((e) => {
  console.error("\n❌ [call-list] Failed:", e?.message || e);
  process.exit(1);
});
