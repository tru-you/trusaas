/**
 * One dealer's data must never reach another dealer.
 *
 * This is the highest-consequence property in the system and the one that had
 * the most bugs on 2026-07-27. Every write path treated a missing dealership as
 * "use the default", and the default is d1 — MKR, a real dealership with a live
 * website, not a neutral bucket. That single fallback produced, separately:
 *
 *   - a capture filing into another dealer's inventory, and with the publish
 *     flag set, onto their website;
 *   - a 360 orbit overwriting the orbit on a different dealer's car that
 *     happened to share a stock number;
 *   - a website enquiry landing in a pipeline its sender never chose;
 *   - a delete removing every vehicle sharing a stock number across ALL
 *     dealerships, destroying another dealer's photos.
 *
 * These tests read the server source rather than booting it, so they run in
 * milliseconds and cannot be satisfied by a mock that drifts from the real
 * thing. The property being guarded is "the code cannot express the unsafe
 * comparison", which is exactly what source inspection can prove.
 *
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SERVER = join(here, "..", "server.ts");
const source = readFileSync(SERVER, "utf8");

/** Strip comments, so prose describing an old bug never fails a test. */
function code(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const body = code(source);

test("no comparison falls back to the default dealership", () => {
  /* `row.dealershipId || DEFAULT_DEALERSHIP_ID` inside a comparison is the bug.
     It reads "untagged belongs to d1", which silently reassigns rather than
     failing — the failure mode nobody sees. Rows are stamped once on load
     instead, so an absent id means the row belongs to nobody and is invisible. */
  const offenders = [...body.matchAll(/\|\|\s*DEFAULT_DEALERSHIP_ID/g)];
  assert.equal(
    offenders.length,
    0,
    `Found ${offenders.length} fallback(s) to DEFAULT_DEALERSHIP_ID. Stamp the ` +
      `row in readState instead of defaulting at the comparison.`
  );
});

test("the default is only ever used to stamp rows, never to match them", () => {
  const uses = [...body.matchAll(/.*DEFAULT_DEALERSHIP_ID.*/g)].map((m) => m[0].trim());
  for (const line of uses) {
    const isDeclaration = /^const DEFAULT_DEALERSHIP_ID/.test(line);
    const isAssignment = /=\s*DEFAULT_DEALERSHIP_ID\s*;?$/.test(line);
    assert.ok(
      isDeclaration || isAssignment,
      `DEFAULT_DEALERSHIP_ID should only be declared or assigned, never compared: ${line}`
    );
  }
});

test("push-photos refuses a capture with no dealership", () => {
  /* An unknown slug was already refused; an ABSENT one fell through to the
     default. Guarding the typo while accepting nothing at all is backwards —
     the absent case is the one that silently misfiles a car. */
  const handler = body.slice(body.indexOf('app.post("/api/sync/push-photos"'));
  const guard = handler.slice(0, handler.indexOf("const pushDealerId"));
  assert.match(guard, /if\s*\(\s*!dealerSlug\s*\)/, "must reject an absent dealerSlug");
  assert.match(guard, /dealerIdForSlug\(dealerSlug\)/, "must reject an unknown dealerSlug");
});

test("the 360 orbit refuses a package with no dealership", () => {
  const handler = body.slice(body.indexOf('app.post("/api/sync/web3d"'));
  const guard = handler.slice(0, handler.indexOf("const state"));
  assert.match(guard, /if\s*\(\s*!dealerSlug\s*\)/, "must reject an absent dealerSlug");
  /* Stock numbers are dealer-chosen and collide across yards, so without this an
     orbit could overwrite the 360 on someone else's car. */
  assert.match(guard, /dealerIdForSlug\(dealerSlug\)/, "must reject an unknown dealerSlug");
});

test("a public enquiry must name the dealership it came from", () => {
  const handler = body.slice(body.indexOf('app.post("/api/integration/webhook-lead"'));
  const guard = handler.slice(0, handler.indexOf("const newLead"));
  assert.match(
    guard,
    /leadDealershipId/,
    "must resolve a dealership before building the lead"
  );
  assert.match(
    guard,
    /return res\.status\(400\)/,
    "must refuse rather than default — a misrouted lead is never noticed"
  );
});

test("the delete callback names the owning dealership", () => {
  /* TruFlow sent only { stockNumber } and TruLens deleted EVERY vehicle
     carrying it, across all dealerships — one dealer's deletion destroying
     another dealer's captures and photos. */
  const del = body.slice(body.indexOf('app.delete("/api/inventory/:id"'));
  const callback = del.slice(0, del.indexOf("res.json({ message"));
  assert.match(callback, /dealerSlug:\s*ownerSlug/, "must send the owning dealer");
});

test("a vehicle is created carrying its dealership", () => {
  /* `dealershipId: ... || undefined` left the row untagged, and an untagged row
     read as the default everywhere it was scoped. */
  const handler = body.slice(body.indexOf('app.post("/api/sync/push-photos"'));
  assert.match(
    handler.slice(0, handler.indexOf("state.vehicles.unshift")),
    /dealershipId:\s*pushDealerId/,
    "a created vehicle must carry the dealership that pushed it"
  );
});

test("an edit cannot move a vehicle into another dealership", () => {
  const put = body.slice(body.indexOf('app.put("/api/inventory/:id"'));
  const handler = put.slice(0, put.indexOf("writeState"));
  assert.match(
    handler,
    /dealershipId:\s*state\.vehicles\[index\]\.dealershipId/,
    "the owner must come from the stored row, never from the request body"
  );
});

test("the inventory list read is dealer-scoped", () => {
  /* GET /api/inventory requires a token, so its only callers are signed-in
     dealer consoles (the Light console's stock tab). It returned
     state.vehicles unscoped, so any dealer saw every other dealer's cars —
     the same leak /api/state and /api/leads already guard. The read must run
     through scopeToDealer, like every other tenant-scoped list. */
  const get = body.slice(body.indexOf('app.get("/api/inventory"'));
  const handler = get.slice(0, get.indexOf('app.get("/api/all-vehicles"'));
  assert.match(
    handler,
    /scopeToDealer\(\s*state\.vehicles\s*,\s*req\.auth\s*\)/,
    "GET /api/inventory must scope vehicles to the caller's dealership"
  );
  assert.doesNotMatch(
    handler,
    /let\s+results\s*=\s*state\.vehicles\s*;/,
    "must not start from the full, unscoped vehicle list"
  );
});

test("every tenant-scoped collection is stamped on load", () => {
  /* If a collection holds dealer data but is not listed, its rows stay untagged
     — and now that the fallbacks are gone, untagged means invisible. */
  const list = body.slice(
    body.indexOf("const TENANT_SCOPED_COLLECTIONS"),
    body.indexOf("] as const", body.indexOf("const TENANT_SCOPED_COLLECTIONS"))
  );
  for (const name of ["vehicles", "leads", "tasks", "invoices", "agreements", "users"]) {
    assert.match(list, new RegExp(`"${name}"`), `${name} must be tenant-scoped`);
  }
});
