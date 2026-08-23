/**
 * TruLens server integration tests — auth, and the Imagin8 proxy chain.
 *
 * Spawns a REAL TruLens server plus a mock TruFlow gateway.
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
  console.log("TruLens integration tests skipped (set RUN_INTEGRATION=1 to enable).");
  process.exit(0);
}

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
const require = createRequire(import.meta.url);
const tsxCli = join(dirname(require.resolve("tsx/package.json")), "dist", "cli.mjs");

const PORT = 3911;
const MOCK_FLOW_PORT = 3922;
const BASE = `http://127.0.0.1:${PORT}`;
const SYNC_KEY = "test-sync-key";

let child;
let dataDir;
let mockFlow;
/** Module-level so cleanup/debug hooks can always read it. */
const childOut = [];

/** How many chargeable calls reached the gateway — demo assertions prove this
 *  counter does NOT move when a prospect spends nothing. */
let gatewayChargeHits = 0;

/** In-memory credit ledger inside the MOCK Flow. 'test-yard' starts funded on
 *  valuation only, so exhaustion/402 paths are reachable without real TU. */
const ledger = {
  default: { valuation: 0, regCheck: 0, accidentReport: 0 },
  "test-yard": { valuation: 2, regCheck: 0, accidentReport: 0 },
};
const ZEROS = { valuation: 0, regCheck: 0, accidentReport: 0 };

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
  throw new Error("TruLens server did not become ready in 45s");
}

before(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "trulens-test-"));

  // Mock of Flow's sync-key internal Imagin8 gateway + the setup-status
  // endpoint the bridge proxies to.
  const UNLIMITED = new Set(["true-cars"]);
  const bundleView = (id) => {
    if (UNLIMITED.has(id)) return { ...ZEROS, unlimited: true };
    return { ...(ledger[id] || ZEROS) };
  };
  mockFlow = createHttpServer((req, res) => {
    if (req.headers["x-tru-sync-key"] !== SYNC_KEY) {
      res.writeHead(403).end(JSON.stringify({ error: "Forbidden" }));
      return;
    }
    const url = req.url || "";
    const mInternal = url.match(/^\/api\/internal\/imagin8\/(valuation|regcheck|accident-report)$/);
    if (req.method === "POST" && mInternal) {
      gatewayChargeHits++;
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        const body = JSON.parse(raw || "{}");
        const id = String(body.dealershipId || "");
        const feature = mInternal[1];
        if (id.startsWith("demo") || id === "demo") {
          res.writeHead(402).end(JSON.stringify({ error: "No bundles remaining", bundles: ZEROS }));
          return;
        }
        const b = ledger[id] || ledger.default || ZEROS;
        if (!UNLIMITED.has(id) && (b[feature] || 0) <= 0) {
          res.writeHead(402).end(JSON.stringify({ error: `No ${feature} bundles remaining`, bundles: bundleView(id) }));
          return;
        }
        if (!UNLIMITED.has(id)) b[feature] = Math.max(0, (b[feature] || 0) - 1);
        res.writeHead(200).end(JSON.stringify({ ok: true, source: "mock-gateway", bundlesRemaining: bundleView(id) }));
      });
      return;
    }
    if (req.method === "GET" && url.startsWith("/api/internal/imagin8/bundles")) {
      const id = decodeURIComponent((url.split("dealershipId=")[1] || "").split("&")[0]);
      res.writeHead(200).end(JSON.stringify(bundleView(id)));
      return;
    }
    if (req.method === "GET" && url.startsWith("/api/dealership/setup-status")) {
      res.writeHead(200).end(JSON.stringify({ complete: true, requiredComplete: true, acknowledgedAt: null, skipPrompt: false, items: [] }));
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
        TRULENS_ACCESS_CODE: "",
        TRULENS_DEALER_CODES: "test-yard:testcode123,true-cars:truecode456",
        TRULENS_TOKEN_SECRET: "test-secret",
        TRUFLOW_SYNC_KEY: SYNC_KEY,
        TRUFLOW_DMS_URL: `http://127.0.0.1:${MOCK_FLOW_PORT}`,
        DEMO_ENABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (d) => childOut.push(String(d)));
  child.stderr.on("data", (d) => childOut.push(String(d)));
  child.on("exit", (code, sig) => childOut.push(`[exit code=${code} sig=${sig}]`));
  try {
    await waitForReady();
    // Probe again after a beat: if the child dies right after listen, say so
    // here (where we CAN print its captured output) instead of failing every
    // test later with opaque 'fetch failed'.
    await new Promise((r) => setTimeout(r, 1200));
    const probe = await fetch(`${BASE}/api/version`);
    if (!probe.ok) throw new Error(`post-boot probe ${probe.status}`);

    // Mint tokens HERE, inside the same hook as the boot — node:test runs
    // multiple root before() hooks concurrently, so a second hook racing
    // this one hits ECONNREFUSED against a server that is still booting.
    // Two logins — well inside the 10/min/IP auth rate limit.
    const yard = await postJson(null, "/api/auth/device", { code: "testcode123" });
    if (!yard.ok) throw new Error(`yard login ${yard.status}: ${await yard.text()}`);
    yardToken = (await yard.json()).token;
    const owner = await postJson(null, "/api/auth/device", { code: "truecode456" });
    if (!owner.ok) throw new Error(`owner login ${owner.status}: ${await owner.text()}`);
    ownerToken = (await owner.json()).token;
  } catch (e) {
    console.error("---- server output ----\n" + childOut.slice(-60).join(""));
    throw e;
  }
});

after(async () => {
  // Cleanup must be unconditional — a throw above this point would orphan the
  // spawned server and wedge the whole runner.
  try {
    console.error("---- server output (last 60) ----\n" + childOut.slice(-60).join(""));
  } catch { /* ignore */ }
  try {
    // tsx spawns a grandchild on Windows; child.kill() only takes the parent,
    // leaving the actual server orphaned to poison the next run's port.
    if (child?.pid) {
      const { execSync } = await import("node:child_process");
      try { execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: "ignore" }); } catch { /* already gone */ }
    }
  } catch { /* ignore */ }
  try { if (mockFlow) mockFlow.close(); } catch { /* ignore */ }
  await new Promise((r) => setTimeout(r, 300));
  try { rmSync(dataDir, { recursive: true, force: true }); } catch { /* best effort */ }
});

let yardToken = "";
let ownerToken = "";

test("rejects unauthenticated inventory reads", async () => {
  const r = await fetch(`${BASE}/api/inventory`);
  assert.equal(r.status, 401);
});

test("rejects an unknown access code", async () => {
  const r = await postJson(null, "/api/auth/device", { code: "wrong-code" });
  assert.equal(r.status, 401);
});

test("a per-dealer code yields a slug-attributed token", async () => {
  const inv = await authed(yardToken, "/api/inventory");
  assert.equal(inv.status, 200);
});

test("bundle balance is read from the central ledger, not a local file", async () => {
  const r = await authed(yardToken, "/api/imagin8/bundles");
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.valuation, 2);
  assert.equal(b.regCheck, 0);
  assert.equal(b.accidentReport, 0);
});

test("a funded valuation call relays and deducts centrally", async () => {
  const hitsBefore = gatewayChargeHits;
  const r = await postJson(yardToken, "/api/imagin8/valuation", { mmCode: "12345", year: 2020 });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.source, "mock-gateway"); // proves the relay happened
  assert.equal(body.bundlesRemaining.valuation, 1); // …and the deduction
  assert.equal(gatewayChargeHits, hitsBefore + 1);
});

test("an exhausted feature 402s without reaching the real API", async () => {
  // Spend the last valuation…
  const second = await postJson(yardToken, "/api/imagin8/valuation", { mmCode: "12345", year: 2020 });
  assert.equal(second.status, 200);
  // …then the next one must be refused.
  const third = await postJson(yardToken, "/api/imagin8/valuation", { mmCode: "12345", year: 2020 });
  assert.equal(third.status, 402);
  const body = await third.json();
  assert.match(body.error, /valuation/i);
});

test("reg check 402s for this yard (none purchased)", async () => {
  const r = await postJson(yardToken, "/api/imagin8/regcheck", { identifier: "VIN123" });
  assert.equal(r.status, 402);
});

test("top-ups are refused locally — they are a TruSaaS-side action", async () => {
  const r = await postJson(yardToken, "/api/imagin8/bundles", { bundles: { valuation: 999 } });
  assert.equal(r.status, 403);
  assert.match((await r.json()).error, /TruSaaS/i);
});

test("the owner's yard is unlimited with zeroed counters", async () => {
  const b = await (await authed(ownerToken, "/api/imagin8/bundles")).json();
  assert.equal(b.unlimited, true);
  assert.equal(b.regCheck, 0);
});

test("demo tokens see zero credits WITHOUT touching the gateway", async () => {
  const hitsBefore = gatewayChargeHits;
  const { token } = await (await fetch(`${BASE}/api/auth/demo`, { method: "POST" })).json();
  const b = await (await authed(token, "/api/imagin8/bundles")).json();
  assert.equal(b.valuation, 0);
  const v = await postJson(token, "/api/imagin8/valuation", { mmCode: "12345", year: 2020 });
  assert.equal(v.status, 402);
  assert.equal(gatewayChargeHits, hitsBefore); // never relayed
});

test("setup status passes through the central answer for scoped tokens", async () => {
  const s = await (await authed(yardToken, "/api/setup/status")).json();
  assert.equal(s.skipPrompt, false);
  assert.equal(s.complete, true);
});

test("demo setup status still skips locally", async () => {
  const { token } = await (await fetch(`${BASE}/api/auth/demo`, { method: "POST" })).json();
  const s = await (await authed(token, "/api/setup/status")).json();
  assert.equal(s.skipPrompt, true);
});
