#!/usr/bin/env node
/**
 * Builds the True Cars demo showroom catalogue.
 *
 * Pulls published stock from Paul's own dealer tenants, anonymises it into
 * TC-1xx demo units, copies the photos and TruOrbit frames into the site, and
 * writes assets/js/catalog.js in the exact public-stock-feed shape so every
 * widget and stock-bridge treat it like a live feed.
 *
 * Run manually when the demo stock should be refreshed (donor cars sell):
 *   node tools/build-true-cars-catalog.mjs
 *
 * Requires Node 18+ (global fetch). No dependencies. Never ships to the site.
 */

import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(ROOT, "case-sites", "tru-cars-flagship-deploy");
const STOCK_DIR = join(SITE, "assets", "stock");
const CATALOG_JS = join(SITE, "assets", "js", "catalog.js");
const MANIFEST = join(ROOT, "tools", "catalog-manifest.json");

const FEED_HOSTS = [
  "https://premium.tru-saas.com",
  "https://flow.tru-saas.com",
  "https://trusaas-premium.onrender.com",
];
const LENS_HOST = "https://lens.tru-saas.com";
const DONORS = ["cars-on-caledon", "mkr-autosales", "your-car-guy"];

const MAX_PHOTOS = 10;
// A TruLens capture has ~27 slots; 12-13 of them are exterior and form the
// orbit. Anything under 8 exterior frames scrubs badly, so skip the orbit.
const MIN_ORBIT_FRAMES = 8;
const DEMO_DEALER = "true-cars";

/* ── deterministic pseudo-random, seeded per stock number ────────────────── */
function seeded(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

/* ── fetch helpers ───────────────────────────────────────────────────────── */
async function getJson(url, timeoutMs = 30000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function fetchDonorStock(slug) {
  for (const host of FEED_HOSTS) {
    const data = await getJson(`${host}/api/public/stock?dealer=${slug}`);
    if (data?.success && Array.isArray(data.vehicles)) {
      return { host, vehicles: data.vehicles };
    }
  }
  return { host: null, vehicles: [] };
}

async function fetchLensStock(slug) {
  const data = await getJson(`${LENS_HOST}/api/public/stock?dealer=${slug}`);
  return data?.success && Array.isArray(data.vehicles) ? data.vehicles : [];
}

async function fetchWeb3d(stockNumber) {
  const data = await getJson(
    `${LENS_HOST}/api/public/web3d/${encodeURIComponent(stockNumber)}`
  );
  const frames = data?.package?.frames;
  return Array.isArray(frames) && frames.length >= MIN_ORBIT_FRAMES ? data.package : null;
}

async function download(url, dest) {
  // Re-runs reuse photos already on disk; pass --refresh-images to force.
  if (!process.argv.includes("--refresh-images")) {
    try {
      if ((await stat(dest)).size > 1024) return true;
    } catch { /* not cached */ }
  }
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 45000);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1024) return false; // guard against error pages
    await writeFile(dest, buf);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

/* ── anonymisation ───────────────────────────────────────────────────────── */
const VIN_CHARS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"; // no I, O, Q

function demoVin(rand) {
  let vin = "TRU";
  for (let i = 0; i < 14; i++) {
    vin += VIN_CHARS[Math.floor(rand() * VIN_CHARS.length)];
  }
  return vin;
}

const ADVISORIES = [
  { area: "Front bumper", severity: "minor", note: "Light stone chipping, touched up." },
  { area: "Rear alloy", severity: "minor", note: "Kerb mark on the near-side rear rim." },
  { area: "Boot lid", severity: "minor", note: "Small scuff, paint intact." },
];

const CONDITION_NOTES = [
  "Full service history, books and two keys.",
  "One previous owner, agent-serviced from new.",
  "Recently serviced with new tyres all round.",
  "Well looked after, non-smoker vehicle.",
];
// Only claimed on cars young enough for it to still be true.
const WARRANTY_NOTE = "Balance of factory warranty still applies.";
const WARRANTY_MAX_AGE = 5;

function demoDescription(v, rand) {
  const title = `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`.replace(/\s+/g, " ").trim();
  const km = Number(v.mileage) ? `${Number(v.mileage).toLocaleString("en-ZA")} km` : "low mileage";
  const age = new Date().getFullYear() - Number(v.year);
  const note =
    age <= WARRANTY_MAX_AGE && rand() < 0.5
      ? WARRANTY_NOTE
      : CONDITION_NOTES[Math.floor(rand() * CONDITION_NOTES.length)];
  return `${title} finished in ${(v.color || "a popular colour").toLowerCase()}, ${v.transmission?.toLowerCase() || "manual"} ${v.fuelType?.toLowerCase() || "petrol"}, showing ${km}. ${note} Inspected and photographed with TruLens — every panel documented before it went on the floor.`;
}

/* Donor records are hand-typed: stray spaces, internal codes, common typos. */
const TYPOS = { metalic: "metallic", siver: "silver", gray: "grey", blk: "black" };

function cleanText(s) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .replace(/^\w+\s+\d+\s+-\s+/, "")
    .trim()
    .split(" ")
    .map((w) => TYPOS[w.toLowerCase()] || w)
    .join(" ");
}

/* Donor records are typed by hand, so casing is inconsistent ("Polo vivo",
 * "a3"). Title-case for the showroom, but keep known all-caps model codes. */
const KEEP_UPPER = new Set([
  "GT", "GTI", "GTD", "TSI", "TDI", "GD6", "RS", "AMG", "GLS", "GLE", "SE", "XLE",
  "BMW", "VW", "GWM", "MG", "DS", "JMC", "BAIC", "GAC", "CX", "SUV", "4X4", "TDCI",
]);

function titleCase(s) {
  const word = (w) => {
    const up = w.toUpperCase();
    if (KEEP_UPPER.has(up)) return up;
    if (/^\d/.test(w)) return up;          // 2.0, 1.8, 4x4
    if (/^[a-z]\d+$/i.test(w)) return up;  // a3 -> A3, x3 -> X3
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  };
  return cleanText(s)
    .split(" ")
    .map((w) => w.split("-").map(word).join("-")) // T-cross -> T-Cross
    .join(" ");
}

function normaliseBody(body) {
  const b = cleanText(body).toLowerCase();
  if (b.includes("bakkie") || b.includes("truck")) return "Bakkie";
  if (b.includes("suv") || b.includes("crossover")) return "SUV";
  if (b.includes("hatch")) return "Hatchback";
  if (b.includes("sedan") || b.includes("saloon")) return "Sedan";
  if (b.includes("coupe")) return "Coupe";
  if (b.includes("wagon") || b.includes("estate")) return "Wagon";
  return cleanText(body) || "Hatchback";
}

const BODY_ORDER = ["Bakkie", "SUV", "Hatchback", "Sedan", "Coupe", "Wagon"];

/* ── main ────────────────────────────────────────────────────────────────── */
async function main() {
  console.log("Collecting donor stock…");

  const byStock = new Map();
  for (const slug of DONORS) {
    const { host, vehicles } = await fetchDonorStock(slug);
    const lens = await fetchLensStock(slug);
    console.log(`  ${slug}: ${vehicles.length} via ${host ?? "no host"}, ${lens.length} via lens`);

    for (const v of [...vehicles, ...lens]) {
      const key = String(v.stockNumber || v.id || "").trim();
      if (!key) continue;
      const existing = byStock.get(key);
      // Keep whichever record carries more photos; merge image sets.
      if (!existing) {
        byStock.set(key, { ...v, donorSlug: slug });
      } else {
        const merged = new Set([...(existing.images || []), ...(v.images || [])]);
        existing.images = [...merged];
        if (!existing.vir && v.vir) existing.vir = v.vir;
      }
    }
  }

  const donors = [...byStock.values()].filter(
    (v) => Array.isArray(v.images) && v.images.length > 0 && Number(v.price) > 0
  );

  if (donors.length === 0) {
    console.error(
      "\nNo donor stock available from any tenant. Nothing written.\n" +
        "Check that at least one of these dealers has published stock: " +
        DONORS.join(", ")
    );
    process.exit(1);
  }

  // Deterministic ordering: body type group, then price ascending.
  donors.sort((a, b) => {
    const ai = BODY_ORDER.indexOf(normaliseBody(a.bodyType));
    const bi = BODY_ORDER.indexOf(normaliseBody(b.bodyType));
    if (ai !== bi) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    return Number(a.price) - Number(b.price);
  });

  console.log(`\nBuilding ${donors.length} demo units…`);
  await mkdir(STOCK_DIR, { recursive: true });

  const manifest = [];
  const out = [];
  let seq = 101;

  for (const donor of donors) {
    const tc = `TC-${seq}`;
    const rand = seeded(donor.stockNumber || donor.id || tc);
    const dir = join(STOCK_DIR, tc);
    await mkdir(dir, { recursive: true });

    // Photos
    const images = [];
    const sources = [...new Set(donor.images)].slice(0, MAX_PHOTOS);
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      const ext = (src.match(/\.(jpe?g|png|webp)(?:\?|$)/i)?.[1] || "jpg").toLowerCase();
      const name = `${i + 1}.${ext}`;
      if (await download(src, join(dir, name))) {
        images.push(`/assets/stock/${tc}/${name}`);
      }
    }
    if (images.length === 0) {
      console.log(`  ${tc}: skipped (no photos downloaded)`);
      await rm(dir, { recursive: true, force: true });
      continue;
    }

    // TruOrbit frames — real capture packages only; frame count comes from the
    // capture itself (typically 8-10 slots), never a fixed synthetic spin.
    let web3d;
    const pkg = await fetchWeb3d(donor.stockNumber);
    if (pkg) {
      const frameDir = join(dir, "orbit");
      await mkdir(frameDir, { recursive: true });
      const frames = [];
      for (let i = 0; i < pkg.frames.length; i++) {
        const f = pkg.frames[i];
        const src = f.image || f.url;
        if (!src) continue;
        const ext = (src.match(/\.(jpe?g|png|webp)(?:\?|$)/i)?.[1] || "jpg").toLowerCase();
        const name = `${i + 1}.${ext}`;
        if (await download(src, join(frameDir, name))) {
          frames.push({
            index: frames.length,
            name: cleanText(f.name) || `View ${frames.length + 1}`,
            azimuth: typeof f.azimuth === "number" ? f.azimuth : Math.round((360 / pkg.frames.length) * i),
            image: `/assets/stock/${tc}/orbit/${name}`,
          });
        }
      }
      if (frames.length >= 4) {
        web3d = { version: 1, mode: "spin-frames", background: "original", frames };
      } else {
        await rm(frameDir, { recursive: true, force: true });
      }
    }

    const price = Number(donor.price);
    const hasTruPrice = rand() < 0.5;
    const make = titleCase(donor.make);
    const model = titleCase(donor.model);

    const unit = {
      id: tc,
      stockNumber: tc,
      year: Number(donor.year) || new Date().getFullYear(),
      make,
      model,
      trim: titleCase(donor.trim),
      category: normaliseBody(donor.bodyType),
      price,
      mileage: Number(donor.mileage) || 0,
      transmission: cleanText(donor.transmission) || "Manual",
      fuelType: cleanText(donor.fuelType) || "Petrol",
      bodyType: normaliseBody(donor.bodyType),
      color: titleCase(String(donor.color || "White").split("/")[0]) || "White",
      vin: demoVin(rand),
      description: "", // filled below, from the cleaned values
      status: "available",
      images,
      heroImage: images[0],
      photoCount: images.length,
      daysInStock: 3 + Math.floor(rand() * 88),
      source: "true-cars-demo",
      updatedAt: new Date().toISOString(),
    };

    unit.description = demoDescription(unit, rand);

    if (hasTruPrice) {
      unit.truPrice = Math.round((price * (1 - (0.02 + rand() * 0.04))) / 500) * 500;
    }
    if (web3d) unit.web3d = web3d;

    // Inspection data. Donors all carry the same default score, which reads as
    // a broken widget on a grid, so demo units get a spread around it.
    if (Number(donor.vir) > 0) {
      unit.vir = Math.max(78, Math.min(97, Number(donor.vir) + Math.round(rand() * 14) - 8));
      unit.conditionLabel =
        unit.vir >= 92 ? "Excellent" : unit.vir >= 85 ? "Very good" : "Good";
      unit.virReport = `/vir-report.html?stock=${tc}`;
      // Lower-scoring units carry the advisories that explain the score — the
      // point of the module is that it discloses, not that everything is 100%.
      if (unit.vir < 88) {
        unit.damage = ADVISORIES.slice(0, 1 + Math.floor(rand() * 2)).map((d) => ({ ...d }));
      }
    }

    out.push(unit);
    manifest.push({
      demo: tc,
      donorStock: donor.stockNumber,
      donorSlug: donor.donorSlug,
      photos: images.length,
      orbitFrames: web3d ? web3d.frames.length : 0,
      vir: unit.vir ?? null,
    });

    console.log(
      `  ${tc}  ${unit.year} ${unit.make} ${unit.model}  ` +
        `${images.length} photos${web3d ? `, ${web3d.frames.length} orbit frames` : ""}` +
        `${unit.vir ? `, VIR ${unit.vir}` : ""}`
    );
    seq++;
  }

  const catalog = {
    success: true,
    dealer: DEMO_DEALER,
    source: "static-demo",
    updatedAt: new Date().toISOString(),
    count: out.length,
    vehicles: out,
  };

  const banner =
    "/* GENERATED by tools/build-true-cars-catalog.mjs — do not hand-edit.\n" +
    " * Demo stock for the True Cars showroom. Shape matches the public stock\n" +
    " * feed contract exactly, so stock-bridge can prepend real live stock on top.\n" +
    " * Re-run the script to refresh (donor cars sell and prices move).\n" +
    ` * Built: ${catalog.updatedAt}\n */\n`;

  await writeFile(
    CATALOG_JS,
    `${banner}window.TRU_CATALOG = ${JSON.stringify(catalog, null, 1)};\n`,
    "utf8"
  );
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2), "utf8");

  const withOrbit = out.filter((v) => v.web3d).length;
  const withVir = out.filter((v) => v.vir).length;
  console.log(
    `\nWrote ${out.length} units to assets/js/catalog.js ` +
      `(${withOrbit} with TruOrbit, ${withVir} with VIR).`
  );
  console.log(
    "Note: donor photos are Paul's own dealers' already-public listing images; " +
      "number plates are visible as published."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
