import fs from "fs";
import { loadEnv, toCsv, writeScraperStore, writeCrmLeadsDirect, pushLeadsToCrm, findCrmDataDir } from "./core";
import { searchJobs, JOB_COLUMNS, DEFAULT_JOB_ROLES, type JobSearchParams } from "./verticals/jobs";
import { searchDealers, DEALER_COLUMNS, SA_MAJOR_DEALER_CITIES } from "./verticals/dealers";
import { searchProperty, PROPERTY_COLUMNS } from "./verticals/property";

loadEnv();

function printHelp() {
  console.log(`
┌─────────────────────────────────────────────────────────────┐
│  TruSaaS Lead Scraper & CRM Importer CLI                   │
└─────────────────────────────────────────────────────────────┘

Usage:
  npx tsx cli.ts <vertical> [options]

Verticals:
  jobs       Hiring companies (UK, US, SA) for talent placement / Pipeline South
  dealers    Automotive dealerships (South Africa) for TruDealer
  property   Real estate agencies (South Africa) for TruProperty

Options:
  --push [url]       Zero-curl push straight into TruCRM (default: http://localhost:3000)
  --upload           Save into TruCRM's scraper store (data/<workspace>_scraper-leads.json)
  --direct           Directly inject into TruCRM's live pipeline (data/<workspace>_leads.json)
  --workspace <name> Target CRM workspace (default: pipeline-south for jobs, default for dealers)
  --location <city>  City name, list of cities, or "all" (for dealers / property)
  --country <codes>  Comma-separated country codes (e.g. "gb,us,za" for jobs)
  --limit <num>      Max total leads to collect (default: 30 for single city, 100 for all)
  --per-role <num>   Target leads per role (for jobs, default: 15)
  --enrich <num>     Number of leads to enrich with emails/phones/LinkedIn (default: all)
  --no-enrich        Skip website contact and SERP enrichment for maximum speed

Examples:
  # 1. Scrape hiring companies & push straight into TruCRM (Pipeline South):
  npx tsx cli.ts jobs --push

  # 2. Scrape dealerships across SA & push straight into TruCRM:
  npx tsx cli.ts dealers --location all --limit 50 --push

  # 3. Direct inject into TruCRM database without running a web server:
  npx tsx cli.ts dealers --location johannesburg --direct
`);
}

function getArg(flag: string, alias?: string): string | null {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag || (alias && args[i] === alias)) {
      const next = args[i + 1];
      if (next && !next.startsWith("--")) return next;
      return "true";
    }
    if (args[i].startsWith(`${flag}=`)) {
      return args[i].slice(flag.length + 1);
    }
  }
  return null;
}

const hasFlag = (flag: string, alias?: string) =>
  process.argv.slice(2).some((a) => a === flag || (alias && a === alias) || a.startsWith(`${flag}=`));

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const vertical = args[0] || "jobs";

  if (hasFlag("--help", "-h") || vertical === "help") {
    printHelp();
    return;
  }

  const t0 = Date.now();

  const limit = Number(getArg("--limit")) || (getArg("--location") === "all" ? 100 : 30);
  const perRole = Number(getArg("--per-role")) || 15;
  const noEnrich = hasFlag("--no-enrich");
  const enrichCount = hasFlag("--enrich-all") ? 999 : Number(getArg("--enrich")) || limit;
  const customLocation = getArg("--location") || undefined;
  const customCountries = getArg("--country")?.split(",").map((c) => c.trim().toLowerCase()) || undefined;

  let leads: any[] = [];
  let cols: string[] = [];
  let defaultWs = "default";

  console.log(`\n🚀 [lead-scraper] Running vertical "${vertical}" (limit: ${limit}, enrich: ${!noEnrich})...`);

  if (vertical === "jobs") {
    defaultWs = "pipeline-south";
    leads = await searchJobs({
      roles: DEFAULT_JOB_ROLES,
      countries: customCountries || ["gb", "us"],
      where: customLocation,
      maxDaysOld: 30,
      excludeAgencies: true,
      resultsPerRole: perRole,
      enrich: !noEnrich,
      maxEnrich: enrichCount,
      concurrency: 6,
    });
    cols = JOB_COLUMNS;
  } else if (vertical === "dealers") {
    defaultWs = "default";
    leads = await searchDealers({
      location: customLocation || "all",
      maxDealers: limit,
      concurrency: 6,
      enrich: !noEnrich,
    });
    cols = DEALER_COLUMNS;
  } else if (vertical === "property") {
    defaultWs = "truproperty";
    leads = await searchProperty({
      location: customLocation || "all",
      maxAgencies: limit,
      concurrency: 6,
      enrich: !noEnrich,
    });
    cols = PROPERTY_COLUMNS;
  } else {
    console.error(`❌ Unknown vertical "${vertical}". Available: jobs | dealers | property`);
    printHelp();
    process.exit(1);
  }

  const targetWs = getArg("--workspace") || defaultWs;

  // 1) Write local CSV
  const out = `${vertical}-leads.csv`;
  fs.writeFileSync(out, toCsv(leads, cols), "utf-8");

  const withPhone = leads.filter((l) => (Array.isArray(l.phones) && l.phones.length > 0) || l.phone).length;
  const withEmail = leads.filter((l) => (Array.isArray(l.emails) && l.emails.length > 0) || l.email).length;
  const withWeb = leads.filter((l) => Boolean(l.website)).length;

  console.log(`\n✅ [lead-scraper:${vertical}] Scraped ${leads.length} valid leads in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`   📞 Phones: ${withPhone} | ✉️ Emails: ${withEmail} | 🌐 Websites: ${withWeb} → saved to ${out}`);

  // 2) --upload: write to TruCRM scraper store
  if (hasFlag("--upload")) {
    const file = writeScraperStore(leads, undefined, targetWs);
    console.log(`   💾 Scraper store synced: ${file}`);
  }

  // 3) --direct: inject directly into TruCRM's live leads database
  if (hasFlag("--direct")) {
    const res = writeCrmLeadsDirect(leads, targetWs);
    console.log(`   📥 Direct CRM injection: ${res.added} new leads added to ${res.file} (Total in workspace: ${res.total})`);
  }

  // 4) --push: push over HTTP to /api/leads/import
  if (hasFlag("--push")) {
    let pushUrl = getArg("--push");
    if (!pushUrl || pushUrl === "true") {
      pushUrl = process.env.CRM_URL || process.env.TRUCRM_URL || "http://localhost:3000";
    }
    console.log(`   🌐 Pushing leads to TruCRM at ${pushUrl} [Workspace: ${targetWs}]...`);
    const pushRes = await pushLeadsToCrm(leads, { url: pushUrl, workspace: targetWs });
    if (pushRes.ok) {
      console.log(`   🎉 ${pushRes.message}`);
    } else {
      console.log(`   ⚠️ ${pushRes.message}`);
      console.log(`      (Hint: Start the TruCRM server with 'npm run dev' or use '--direct' for instant file write)`);
    }
  }

  // Preview top 5 leads
  console.log(`\n📋 Lead Preview:`);
  for (const l of leads.slice(0, 6)) {
    const ph = Array.isArray(l.phones) ? l.phones[0] : l.phone;
    const em = Array.isArray(l.emails) ? l.emails[0] : l.email;
    console.log(` • \x1b[36m${l.name}\x1b[0m ${l.title ? "— " + l.title : ""} | 📞 ${ph || "No direct phone"} | ✉️ ${em || "No direct email"} | 🌐 ${l.website || "No site"}`);
  }
}

main().catch((e) => {
  console.error("\n❌ [lead-scraper] Failed:", e?.message || e);
  process.exit(1);
});
