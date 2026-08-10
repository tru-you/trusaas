import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import type { DMSState, Dealership } from "../src/types";

dotenv.config();

/** The dealership an untagged legacy row is understood to belong to.
 *
 *  Declared here, near the top, rather than beside the public-feed helpers where
 *  it used to live: readState() references it, and readState() is called during
 *  boot by the photo migration — far above the old declaration, which put it in
 *  the temporal dead zone and threw before the server could start.
 *
 *  It is now only ever used to STAMP legacy rows once, in readState. Nothing
 *  compares against it as a fallback any more; see the backfill there. */
const DEFAULT_DEALERSHIP_ID = "d1";

/** The products a dealership can be entitled to.
 *
 *  Adding one here is the whole of the work for a new app: every product
 *  verifies codes against this instance, so a dealer gains access by having the
 *  name ticked on their record rather than by someone editing an environment
 *  variable on that app's service and redeploying it.
 *
 *  Onboarding used to mean creating the dealership here, issuing a code, then
 *  hand-editing TRULENS_DEALER_CODES — a comma-separated "slug:CODE" string
 *  holding every dealer's code in plaintext on the Render dashboard — and
 *  restarting TruLens so it took effect. Once per product, per dealer, and
 *  revoking access meant editing that string and redeploying again. */
export const PRODUCTS = ["lens", "flow", "flow-lite", "inspect", "live", "value", "social"] as const;
export type ProductName = (typeof PRODUCTS)[number];

/** Collections whose rows belong to exactly one dealership.
 *
 *  Anything listed here is scoped on read and stamped on load, so a new
 *  collection that holds dealer data has one place to be registered rather than
 *  a scattering of filters to remember. */
const TENANT_SCOPED_COLLECTIONS = [
  "properties",
  "enquiries",
  "tasks",
  "invoices",
  "agreements",
  "documents",
  "docEvents",
  "expenses",
  "communications",
  "users",
] as const;

type TenantKey = (typeof TENANT_SCOPED_COLLECTIONS)[number];

interface SharedState {
  dealerships: Dealership[];
  settings: DMSState["settings"];
  socialAccounts?: DMSState["socialAccounts"];
  migrations?: Record<string, boolean>;
}

type DealerData = { [K in TenantKey]: any[] };

// Writable state lives under DATA_DIR so it can sit on a mounted Render disk
// and survive deploys/restarts. Unset (local dev) = cwd, i.e. the old paths.
const DATA_DIR = process.env.DATA_DIR || process.cwd();
try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}

const DATA_FILE = path.join(DATA_DIR, "data.json");
// Repo-shipped seed. Used once, only when the disk is still empty — never
// written back to, so a redeploy can't clobber the dealer's real stock.
const SEED_FILE = path.join(process.cwd(), "data.json");

const SHARED_FILE = path.join(DATA_DIR, "shared.json");
const MIGRATED_FLAG = path.join(DATA_DIR, ".per-dealer-migrated");

function dealerFile(id: string): string {
  return path.join(DATA_DIR, `dealer-${id}.json`);
}

/* Every write is serialised before touching disk; if a file's content is
   identical to the last write, the tmp+rename is skipped entirely. writeState()
   rewrites every dealer's file on ANY mutation, so an untouched dealership
   otherwise pays for another dealership's keystroke on every save. The map is
   keyed by file path and only ever records what this process last wrote, so
   anything that changes the file externally (manual edit, restore of a backup)
   simply fails the compare and rewrites. */
const lastSerialized = new Map<string, string>();

function writeFileIfChanged(target: string, content: string): void {
  if (lastSerialized.get(target) === content) return;
  const tmp = target + ".tmp";
  fs.writeFileSync(tmp, content, "utf-8");
  fs.renameSync(tmp, target);
  lastSerialized.set(target, content);
}

function readShared(): SharedState {
  if (fs.existsSync(SHARED_FILE)) {
    return JSON.parse(fs.readFileSync(SHARED_FILE, "utf-8"));
  }
  return {
    dealerships: DEFAULT_MOCK_STATE.dealerships,
    settings: DEFAULT_MOCK_STATE.settings,
    socialAccounts: [],
    migrations: {},
  };
}

function writeShared(shared: SharedState): void {
  writeFileIfChanged(SHARED_FILE, JSON.stringify(shared, null, 2));
}

function readDealerData(id: string): DealerData {
  const f = dealerFile(id);
  if (fs.existsSync(f)) {
    return JSON.parse(fs.readFileSync(f, "utf-8"));
  }
  const empty: any = {};
  for (const k of TENANT_SCOPED_COLLECTIONS) empty[k] = [];
  return empty;
}

function writeDealerData(id: string, data: DealerData): void {
  writeFileIfChanged(dealerFile(id), JSON.stringify(data, null, 2));
}

function allDealerIds(): string[] {
  const ids: string[] = [];
  for (const f of fs.readdirSync(DATA_DIR)) {
    const m = f.match(/^dealer-(.+)\.json$/);
    if (m) ids.push(m[1]);
  }
  return ids;
}

function isPerDealerMode(): boolean {
  return fs.existsSync(MIGRATED_FLAG);
}

function migrateToPerDealerFiles(): void {
  if (fs.existsSync(MIGRATED_FLAG)) return;
  if (!fs.existsSync(DATA_FILE)) return;

  console.log("[migration] Splitting data.json into per-dealer files...");
  const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));

  const shared: SharedState = {
    dealerships: raw.dealerships || [],
    settings: raw.settings || {},
    socialAccounts: raw.socialAccounts || [],
    migrations: raw.migrations || {},
  };

  const buckets = new Map<string, DealerData>();
  for (const key of TENANT_SCOPED_COLLECTIONS) {
    const rows: any[] = raw[key] || [];
    for (const row of rows) {
      const did = row.dealershipId || "orphan";
      if (did === "orphan") {
        console.warn(`[migration] Orphan row in ${key}: ${row.id}`);
      }
      if (!buckets.has(did)) {
        const empty: any = {};
        for (const k of TENANT_SCOPED_COLLECTIONS) empty[k] = [];
        buckets.set(did, empty);
      }
      buckets.get(did)![key].push(row);
    }
  }

  writeShared(shared);
  buckets.forEach((data, id) => {
    writeDealerData(id, data);
    const count = TENANT_SCOPED_COLLECTIONS.reduce((n, k) => n + (data[k] || []).length, 0);
    console.log(`[migration] dealer-${id}.json — ${count} rows`);
  });

  fs.writeFileSync(MIGRATED_FLAG, new Date().toISOString(), "utf-8");
  console.log("[migration] Done. Old data.json kept as backup.");
}

// Clean initial state — no demo data, no seed vehicles or enquiries.
// Dealerships are config (they map dealer slugs to websites) so they stay.
const DEFAULT_MOCK_STATE: DMSState = {
  dealerships: [
    { id: 'd1', name: 'MKR Properties', location: 'Johannesburg', slug: 'mkr-properties', websiteUrl: 'https://mkrproperties.co.za' },
    { id: 'd2', name: 'Caledon Estates', location: 'Kariega, Eastern Cape', slug: 'caledon-estates', websiteUrl: 'https://www.caledonestates.co.za' },
  ],
  properties: [],
  enquiries: [],
  tasks: [],
  invoices: [],
  agreements: [],
  documents: [] as any[],
  users: [],
  communications: [],
  expenses: [],
  settings: {
    tier: 'premium',
    truLens: true,
    truInspect: true,
    websitePortal: true,
    multiPortalSync: true,
    trueAI: true,
    smartLedger: true,
    chatbot: true,
    liveReceptionist: true,
    seoAeo: true,
    syndication: true,
    truSocial: false,
  }
};

// State Helper Functions

function backfillShared(shared: SharedState): SharedState {
  shared.settings = { ...DEFAULT_MOCK_STATE.settings, ...(shared.settings || {}) };

  if (!Array.isArray(shared.dealerships) || !shared.dealerships.length) {
    shared.dealerships = DEFAULT_MOCK_STATE.dealerships;
  } else {
    shared.dealerships = shared.dealerships.map((d: any) => {
      const seed = DEFAULT_MOCK_STATE.dealerships.find((x: any) => x.id === d.id);
      return seed ? { ...d, ...seed } : d;
    });
    const existingIds = new Set(shared.dealerships.map((d: any) => d.id));
    for (const seed of DEFAULT_MOCK_STATE.dealerships) {
      if (!existingIds.has(seed.id)) shared.dealerships.push({ ...seed });
    }
  }

  shared.migrations = shared.migrations || {};
  if (!shared.migrations.prunedSeedDealers) {
    const retired = new Set(["d3", "demo"]);
    shared.dealerships = shared.dealerships.filter((d: any) => !retired.has(d.id));
    shared.migrations.prunedSeedDealers = true;
  }

  for (const d of shared.dealerships || []) {
    if (!Array.isArray((d as any).products) || !(d as any).products.length) {
      (d as any).products = [...PRODUCTS];
    }
  }

  return shared;
}

function backfillVehicles(properties: any[]): void {
  for (const v of properties) {
    if (!v.images) v.images = [];
    if (!v.maintenanceTasks) v.maintenanceTasks = [];
    if (typeof v.showOnWebsite !== "boolean") v.showOnWebsite = true;
    if (v.images.length === 0 && v.source === "trulens" && Array.isArray(v.extrasPhotos) && v.extrasPhotos.length > 0) {
      v.images = v.extrasPhotos.slice();
      v.extrasPhotos = [];
    }
  }
}

/** A private copy of the seed.
 *
 *  `readState()` falls back to the seed when a data file cannot be read, and it
 *  used to hand back DEFAULT_MOCK_STATE itself. Every write handler then
 *  mutated that module-level object in place and `writeState` persisted it — so
 *  one unreadable dealer file turned the seed into the live data, and each
 *  later request in the same process compounded the damage against it.
 *
 *  Returning a clone keeps the fallback read-only in practice: a request may do
 *  whatever it likes to its own copy without the next one inheriting it. */
function freshDefaultState(): DMSState {
  return structuredClone(DEFAULT_MOCK_STATE);
}
export { freshDefaultState };

/* readState() is on 80+ request paths and reads, backfills and merges every
   dealer file on every call. A short TTL keeps burst reads off the disk while
   writeState() invalidates immediately so a write is never hidden. Callers
   mutate the returned state before handing it to writeState(), so cache hits
   are always served as a deep clone. */
let stateCache: { data: any; at: number } | null = null;
const STATE_CACHE_TTL_MS = 2000;

export function readState(): DMSState {
  if (stateCache && Date.now() - stateCache.at < STATE_CACHE_TTL_MS) {
    return structuredClone(stateCache.data);
  }

  if (isPerDealerMode()) {
    try {
      const shared = backfillShared(readShared());
      const merged: any = {
        ...shared,
      };
      for (const key of TENANT_SCOPED_COLLECTIONS) merged[key] = [];

      for (const id of allDealerIds()) {
        const dd = readDealerData(id);
        for (const key of TENANT_SCOPED_COLLECTIONS) {
          merged[key].push(...(dd[key] || []));
        }
      }

      backfillVehicles(merged.properties);
      /* Store a clone so mutations a caller makes to the returned object
         (without a following writeState) can never leak into later reads —
         exactly the semantics of re-reading the files every call. */
      stateCache = { data: structuredClone(merged), at: Date.now() };
      return merged;
    } catch (err) {
      console.error("Error reading per-dealer state:", err);
      return freshDefaultState();
    }
  }

  // Legacy monolithic path (pre-migration)
  try {
    const src = fs.existsSync(DATA_FILE) ? DATA_FILE : SEED_FILE;
    if (fs.existsSync(src)) {
      const parsed = JSON.parse(fs.readFileSync(src, "utf-8"));
      if (!parsed.expenses) parsed.expenses = DEFAULT_MOCK_STATE.expenses;
      parsed.settings = { ...DEFAULT_MOCK_STATE.settings, ...(parsed.settings || {}) };
      if (!parsed.documents) parsed.documents = [];

      if (!Array.isArray(parsed.dealerships) || !parsed.dealerships.length) {
        parsed.dealerships = DEFAULT_MOCK_STATE.dealerships;
      } else {
        parsed.dealerships = parsed.dealerships.map((d: any) => {
          const seed = DEFAULT_MOCK_STATE.dealerships.find((x: any) => x.id === d.id);
          return seed ? { ...d, ...seed } : d;
        });
        const existingIds = new Set(parsed.dealerships.map((d: any) => d.id));
        for (const seed of DEFAULT_MOCK_STATE.dealerships) {
          if (!existingIds.has(seed.id)) parsed.dealerships.push({ ...seed });
        }
      }

      parsed.migrations = parsed.migrations || {};
      if (!parsed.migrations.prunedSeedDealers) {
        const retired = new Set(["d3", "demo"]);
        parsed.dealerships = parsed.dealerships.filter((d: any) => !retired.has(d.id));
        parsed.properties = (parsed.properties || []).filter((v: any) => !retired.has(v.dealershipId));
        parsed.migrations.prunedSeedDealers = true;
      }

      backfillVehicles(parsed.properties || []);

      for (const d of parsed.dealerships || []) {
        if (!Array.isArray(d.products) || !d.products.length) {
          d.products = [...PRODUCTS];
        }
      }

      for (const key of TENANT_SCOPED_COLLECTIONS) {
        const rows = (parsed as any)[key];
        if (!Array.isArray(rows)) continue;
        for (const row of rows) {
          if (row && typeof row === "object" && !row.dealershipId) {
            row.dealershipId = DEFAULT_DEALERSHIP_ID;
          }
        }
      }

      stateCache = { data: structuredClone(parsed), at: Date.now() };
      return parsed;
    }
  } catch (err) {
    console.error("Error reading data file:", err);
  }
  return freshDefaultState();
}

export function writeState(state: any) {
  if (isPerDealerMode()) {
    try {
      const shared: SharedState = {
        dealerships: state.dealerships || [],
        settings: state.settings || {},
        socialAccounts: state.socialAccounts || [],
        migrations: state.migrations || {},
      };
      writeShared(shared);

      const buckets = new Map<string, DealerData>();
      for (const key of TENANT_SCOPED_COLLECTIONS) {
        for (const row of (state[key] || [])) {
          const did = row.dealershipId || "orphan";
          if (!buckets.has(did)) {
            const empty: any = {};
            for (const k of TENANT_SCOPED_COLLECTIONS) empty[k] = [];
            buckets.set(did, empty);
          }
          buckets.get(did)![key].push(row);
        }
      }

      // Write each dealer file that has data in this state.
      // Also write empty files for dealers that had data before but don't now
      // (e.g. all vehicles deleted).
      const existingIds = allDealerIds();
      buckets.forEach((data, id) => {
        writeDealerData(id, data);
        const idx = existingIds.indexOf(id);
        if (idx !== -1) existingIds.splice(idx, 1);
      });
      // Dealers with no rows left still get an empty file so they aren't lost
      for (const id of existingIds) {
        const empty: any = {};
        for (const k of TENANT_SCOPED_COLLECTIONS) empty[k] = [];
        writeDealerData(id, empty);
      }
      stateCache = null;
    } catch (err) {
      console.error("Error writing per-dealer state:", err);
    }
    return;
  }

  // Legacy monolithic path — a wholesale rewrite of the single state file, so
  // the per-file write cache is meaningless here and must not leak into later
  // per-dealer comparisons.
  try {
    lastSerialized.clear();
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");
    stateCache = null;
  } catch (err) {
    console.error("Error writing data file:", err);
  }
}

// Boot: migrate to per-dealer files if still on monolithic, then seed if needed
if (!isPerDealerMode()) {
  if (fs.existsSync(DATA_FILE)) {
    migrateToPerDealerFiles();
  } else if (fs.existsSync(SEED_FILE)) {
    // First boot: copy seed to data.json, then migrate
    fs.copyFileSync(SEED_FILE, DATA_FILE);
    migrateToPerDealerFiles();
  } else {
    // No data at all — write defaults and migrate
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_MOCK_STATE, null, 2), "utf-8");
    migrateToPerDealerFiles();
  }
}
