/**
 * TruInspect server integration tests — auth (shared code + TruFlow-central
 * verification via a mock), per-dealer settings persistence, setup status,
 * buyer scoping, and Imagin8 demo isolation.
 *
 * Spawns a REAL server against a throwaway DATA_DIR on an ephemeral port,
 * plus a tiny mock of TruFlow Premium speaking the two contracts Inspect
 * consumes: POST /api/auth/verify-code (dealer-scoped tokens) and the
 * /api/internal/imagin8/* chargeable-call gateway (the ONE ledger).
 *
 * OPT-IN: process-spawning is unreliable on some dev machines (Windows .env
 * injection, tsx grandchildren). Set RUN_INTEGRATION=1 to enable.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createServer as createHttpServer } from "node:http";

if (process.env.RUN_INTEGRATION !== "1") {
  console.log("TruInspect integration tests skipped (set RUN_INTEGRATION=1 to enable).");
  process.exit(0);
}

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
const require = createRequire(import.meta.url);
const tsxCli = join(dirname(require.resolve("tsx/package.json")), "dist", "cli.mjs");

const PORT = 3912;
const MOCK_FLOW_PORT = 3921;
const BASE = `http://127.0.0.1:${PORT}`;
const SYNC_KEY = "test-sync-key";

let child;
let dataDir;
let mockFlow;
// Minted once in before() — auth endpoints rate-limit to 10/min/IP and the
// suite would otherwise burn the budget on repeated logins.
let yardToken;
let sharedToken;
let ownerToken;

const authed = (token, path, init = {}) =>
  fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

const postJson = (token, path, body) =>
  authed(token, path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

async function waitForReady() {
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(`${BASE}/api/version`);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("TruInspect server did not become ready in 45s");
}

before(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "truinspect-test-"));

  // Flow holds THE Imagin8 ledger now — Inspect keeps none locally. Funded
  // buckets live here, keyed by dealership slug, exactly like Premium's
  // imagin8-bundles.json.
  const flowLedger = {
    default: { valuation: 9, regCheck: 9, accidentReport: 9 },
    "mock-yard": { valuation: 9, regCheck: 9, accidentReport: 9 },
  };
  const zeros = { valuation: 0, regCheck: 0, accidentReport: 0 };

  // Mock of TruFlow Premium: POST /api/auth/verify-code (fixed code map) plus
  // the internal Imagin8 gateway — bundles read mirrors the real route's
  // unlimited/demo/ledger precedence; regcheck deducts on success so the
  // proxy chain is provable end-to-end.
  const CODES = {
    flowcode123: { dealerSlug: "mock-yard", dealerName: "Mock Yard" },
    ownercode456: { dealerSlug: "true-cars", dealerName: "Owner Yard" },
  };
  mockFlow = createHttpServer((req, res) => {
    if (!req.url) return res.writeHead(404).end();
    const path = req.url.split("?")[0];
    const syncOk = req.headers["x-tru-sync-key"] === SYNC_KEY;

    if (req.method === "POST" && path === "/api/auth/verify-code") {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        if (!syncOk) return void res.writeHead(403).end(JSON.stringify({ ok: false }));
        const hit = CODES[JSON.parse(raw || "{}").code];
        if (!hit) return void res.writeHead(403).end(JSON.stringify({ ok: false }));
        res.writeHead(200).end(JSON.stringify({ ok: true, ...hit }));
      });
      return;
    }

    if (path === "/api/internal/imagin8/bundles") {
      if (!syncOk) return void res.writeHead(403).end(JSON.stringify(zeros));
      const id = new URL(req.url, "http://mock").searchParams.get("dealershipId") || "";
      if (id === "true-cars") {
        return void res.writeHead(200).end(JSON.stringify({ ...zeros, unlimited: true }));
      }
      if (id.startsWith("demo")) return void res.writeHead(200).end(JSON.stringify(zeros));
      return void res.writeHead(200).end(JSON.stringify(flowLedger[id] || zeros));
    }

    if (path === "/api/internal/imagin8/regcheck") {
      if (!syncOk) return void res.writeHead(403).end(JSON.stringify({ error: "bad sync key" }));
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        const id = JSON.parse(raw || "{}").dealershipId || "";
        const bucket = flowLedger[id];
        if (!bucket || (bucket.regCheck || 0) <= 0) {
          return void res.writeHead(402).end(JSON.stringify({ error: "No regcheck bundles remaining" }));
        }
        bucket.regCheck -= 1;
        res.writeHead(200).end(JSON.stringify({ stolen: false, financePending: false, bundlesRemaining: { ...bucket } }));
      });
      return;
    }

    res.writeHead(404).end();
  });
  await new Promise((r) => mockFlow.listen(MOCK_FLOW_PORT, "127.0.0.1", r));

  child = spawn(
    process.execPath,
    [tsxCli, "server.ts"],
    {
      cwd: appRoot,
      env: {
        ...process.env,
        PORT: String(PORT),
        DATA_DIR: dataDir,
        TRUINSPECT_ACCESS_CODE: "sharedcode123",
        TRUFLOW_SYNC_KEY: SYNC_KEY,
        TRUFLOW_DMS_URL: `http://127.0.0.1:${MOCK_FLOW_PORT}`,
        DEMO_ENABLED: "1",
        IMAGIN8_API_KEY: "test-key",
        IMAGIN8_CUSTOMER_ID: "test-cust",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});
  await waitForReady();

  yardToken = (await (await postJson(null, "/api/auth/device", { code: "flowcode123" })).json()).token;
  sharedToken = (await (await postJson(null, "/api/auth/device", { code: "sharedcode123" })).json()).token;
  ownerToken = (await (await postJson(null, "/api/auth/device", { code: "ownercode456" })).json()).token;
});

after(async () => {
  if (child) child.kill();
  if (mockFlow) mockFlow.close();
  await new Promise((r) => setTimeout(r, 300));
  try { rmSync(dataDir, { recursive: true, force: true }); } catch { /* best effort */ }
});

test("rejects unauthenticated buyer reads", async () => {
  const r = await fetch(`${BASE}/api/buyers`);
  assert.equal(r.status, 401);
});

test("rejects an unknown code", async () => {
  const r = await postJson(null, "/api/auth/device", { code: "nope" });
  assert.equal(r.status, 401);
});

test("the legacy shared code still works but carries no dealership", async () => {
  const r = await postJson(null, "/api/auth/device", { code: "sharedcode123" });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.dealerSlug, null);
});

test("a code verified by TruFlow central yields a scoped token", async () => {
  const r = await postJson(null, "/api/auth/device", { code: "flowcode123" });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.dealerSlug, "mock-yard");
  assert.equal(body.dealerName, "Mock Yard");
});

test("settings persist per slug and drive the setup checklist", async () => {
  // Before anything: required items missing, nothing acknowledged.
  const before = await (await authed(yardToken, "/api/dealership/setup-status")).json();
  assert.equal(before.skipPrompt, false);
  assert.equal(before.requiredComplete, false);

  await authed(yardToken, "/api/dealership/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      settings: { name: "Mock Yard", email: "yard@test.co.za", address: "1 Test Rd" },
    }),
  });
  const saved = await (await authed(yardToken, "/api/dealership/settings")).json();
  assert.equal(saved.settings.name, "Mock Yard");

  const after = await (await authed(yardToken, "/api/dealership/setup-status")).json();
  assert.equal(after.requiredComplete, true); // name/email/address done
  assert.equal(after.complete, false); // VAT/T&Cs still open
  const vatItem = after.items.find((i) => i.id === "vat-reg");
  assert.equal(vatItem.done, false);
  assert.equal(vatItem.required, false); // recommended, never nags
});

test("acknowledging stamps the record; reset re-arms the prompt", async () => {
  await authed(yardToken, "/api/dealership/setup-acknowledge", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  let s = await (await authed(yardToken, "/api/dealership/setup-status")).json();
  assert.ok(s.acknowledgedAt);
  await authed(yardToken, "/api/dealership/setup-acknowledge", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reset: true }),
  });
  s = await (await authed(yardToken, "/api/dealership/setup-status")).json();
  assert.equal(s.acknowledgedAt, null);
});

test("buyer books are scoped per dealership", async () => {
  await authed(yardToken, "/api/buyers", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ buyers: [{ id: "b1", name: "Scoped Buyer" }] }),
  });

  const theirs = await (await authed(yardToken, "/api/buyers")).json();
  assert.equal(theirs.buyers.length, 1);

  // Shared-code device has no slug → different ('local') bucket → sees none.
  const ours = await (await authed(sharedToken, "/api/buyers")).json();
  assert.equal(ours.buyers.length, 0);
});

test("demo settings never persist and setup skips locally", async () => {
  const { token } = await (await fetch(`${BASE}/api/auth/demo`, { method: "POST" })).json();
  const put = await authed(token, "/api/dealership/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ settings: { name: "Sneaky Demo Yard" } }),
  });
  assert.equal((await put.json()).skipped, true);
  const s = await (await authed(token, "/api/dealership/setup-status")).json();
  assert.equal(s.skipPrompt, true);
});

test("demo tokens never inherit the funded default bundle bucket", async () => {
  const { token } = await (await fetch(`${BASE}/api/auth/demo`, { method: "POST" })).json();
  const b = await (await authed(token, "/api/imagin8/bundles")).json();
  assert.equal(b.valuation, 0); // the default bucket holds 9s — demo sees none
  const reg = await postJson(token, "/api/imagin8/regcheck", { identifier: "VIN1" });
  assert.equal(reg.status, 402);
});

test("demo gated calls never reach the gateway or anyone's bucket", async () => {
  const { token } = await (await fetch(`${BASE}/api/auth/demo`, { method: "POST" })).json();
  const reg = await postJson(token, "/api/imagin8/regcheck", { identifier: "VIN2" });
  assert.equal(reg.status, 402); // short-circuited locally — no relay
  // mock-yard's Flow-side allocation is untouched by the demo call.
  const b = await (await authed(yardToken, "/api/imagin8/bundles")).json();
  assert.equal(b.valuation, 9);
  assert.equal(b.regCheck, 9);
});

test("a real yard's gated call relays through the gateway and deducts", async () => {
  const r = await postJson(yardToken, "/api/imagin8/regcheck", { identifier: "VINREAL" });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.stolen, false);
  // One call, one credit — read back through Inspect's bundles proxy.
  const b = await (await authed(yardToken, "/api/imagin8/bundles")).json();
  assert.equal(b.regCheck, 8);
});

test("the owner's yard is unlimited with zeroed counters", async () => {
  const b = await (await authed(ownerToken, "/api/imagin8/bundles")).json();
  assert.equal(b.unlimited, true);
  assert.equal(b.regCheck, 0); // NOT a 9999 sentinel
});
