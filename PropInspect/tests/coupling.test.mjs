/**
 * Lead ↔ Vehicle status coupling.
 *
 * A car and the deal that sold it are one real-world event recorded twice, and
 * every screen that reports on the business — Stock Health's capital in stock,
 * Units sold, Deal Readiness — reads one or the other. When they disagree the
 * dealer has no way to tell which number is lying.
 *
 * The rules used to live in React event handlers, which meant the Light console
 * (public/light/index.html), TruLens sync and any direct API call bypassed them
 * entirely: selling a car from Light never moved its lead. They now live in the
 * server's write handlers, which is the one path every surface shares.
 *
 * These assert against server.ts source, the way tenancy.test.mjs does — the
 * point is that the rule exists in the shared path, not that one caller happens
 * to get it right.
 *
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const body = readFileSync(join(here, "..", "server.ts"), "utf8");

/** The PUT /api/leads/:id handler, up to its response. */
function leadPutHandler() {
  const start = body.indexOf('app.put("/api/leads/:id"');
  assert.ok(start !== -1, "could not locate PUT /api/leads/:id");
  const rest = body.slice(start);
  const end = rest.indexOf("app.delete(");
  assert.ok(end !== -1, "could not find the end of the lead PUT handler");
  return rest.slice(0, end);
}

test("closing a deal Won moves its car to SOLD", () => {
  const handler = leadPutHandler();
  assert.match(
    handler,
    /const sell = [\s\S]*applyVehicleStatus\([^)]*"SOLD"/,
    "selling must go through applyVehicleStatus"
  );
  assert.match(
    handler,
    /heldNow\s*=\s*lead\.status === "Closed Won"/,
    "the car a deal holds must be derived from it being Closed Won"
  );
});

test("reassigning a closed deal to another car moves both", () => {
  /* Changing the vehicle on a Closed Won deal otherwise leaves the original
     sold with nothing holding it while the replacement sits in stock — one
     edit producing two contradictions at once. */
  const handler = leadPutHandler();
  assert.match(
    handler,
    /heldBefore\s*=\s*prevStatus === "Closed Won"\s*\?\s*prevVehicleId/,
    "must track which car the deal held before the edit"
  );
  assert.match(
    handler,
    /if\s*\(\s*heldBefore\s*!==\s*heldNow\s*\)[\s\S]{0,200}free\(heldBefore\)[\s\S]{0,80}sell\(heldNow\)/,
    "when the held car changes, the old one is freed and the new one sold"
  );
});

test("coupling goes through applyVehicleStatus, not a bare assignment", () => {
  /* applyVehicleStatus carries three side effects the inventory PUT owns:
     pulling the car off the website, stamping fieldMeta so a stale Lens
     re-export cannot overwrite the edit, and collecting the Lens push. A
     direct `vehicle.status = ...` would silently drop all three — the car
     would stay live on the dealer's website after being sold. */
  const handler = leadPutHandler();
  assert.doesNotMatch(
    handler,
    /vehicle\.status\s*=\s*["']/,
    "must not assign vehicle.status directly — use applyVehicleStatus"
  );
  assert.match(handler, /applyVehicleStatus\(/);
});

test("reopening does not un-sell a car another deal still holds", () => {
  /* A vehicle carries many leads. Without this guard, moving lead B off Closed
     Won returns the car to stock even though lead A legitimately bought it —
     re-listing a sold car on the public feed. */
  const handler = leadPutHandler();
  assert.match(
    handler,
    /stillHeld[\s\S]*l\.id\s*!==\s*lead\.id[\s\S]*"Closed Won"/,
    "freeing a car must check no other lead on it is still Closed Won"
  );
  assert.match(
    handler,
    /if\s*\(\s*stillHeld\s*\)\s*return;/,
    "the INVENTORY write must be gated on that check"
  );
});

test("reopening restores the real prior stage, not a hardcoded one", () => {
  /* Deals close from New and Test Drive Scheduled too. Hardcoding "Negotiating"
     on reopen rewrites history for every deal that did not come from there. */
  const handler = leadPutHandler();
  assert.match(
    handler,
    /statusBeforeClose\s*=\s*prevStatus/,
    "closing must record where the deal came from"
  );
  assert.doesNotMatch(
    handler,
    /status\s*[:=]\s*["']Negotiating["']/,
    "reopening must not hardcode Negotiating"
  );
});

test("coupling is transition-based, never state-based", () => {
  /* State-based coupling would let any edit to a sold car — a price correction
     months later — reach out and close a lead, and would fight every reopen. */
  const handler = leadPutHandler();
  assert.match(
    handler,
    /prevStatus\s*!==\s*"Closed Won"/,
    "closing must compare against the previous status"
  );
  assert.match(
    handler,
    /prevStatus\s*===\s*"Closed Won"/,
    "reopening must compare against the previous status"
  );
});

test("coupling refuses to cross dealerships, whatever the role", () => {
  /* mayTouch lets undefined === undefined pass, the vehicle lookup is global,
     and admin bypasses both — so a cross-tenant pairing is representable
     without a dedicated check. */
  assert.match(
    body,
    /function mayCouple/,
    "a dedicated cross-collection tenancy guard must exist"
  );
  const start = body.indexOf("function mayCouple");
  const fn = body.slice(start, body.indexOf("\napp.", start));
  assert.match(
    fn,
    /lead\.dealershipId\s*===\s*vehicle\.dealershipId/,
    "both rows must belong to the same dealership"
  );
  assert.match(
    fn,
    /!!lead\.dealershipId/,
    "an untagged row must not couple by matching undefined to undefined"
  );
  assert.match(
    leadPutHandler(),
    /mayCouple\(/,
    "the lead PUT must actually call the guard"
  );
});

/** The PUT /api/inventory/:id handler, up to its response. */
function inventoryPutHandler() {
  const start = body.indexOf('app.put("/api/inventory/:id"');
  assert.ok(start !== -1, "could not locate PUT /api/inventory/:id");
  const rest = body.slice(start);
  const end = rest.indexOf("app.delete(");
  assert.ok(end !== -1, "could not find the end of the inventory PUT handler");
  return rest.slice(0, end);
}

test("closeLeadId never reaches the persisted vehicle row", () => {
  /* The merge is a blind {...current, ...body}. Left in, a caller-supplied id
     would be written onto the vehicle permanently and echoed back to every
     client that reads stock. It must be removed before the patch is applied. */
  const handler = inventoryPutHandler();
  const beforePatch = handler.slice(0, handler.indexOf("applyVehiclePatch("));
  assert.match(
    beforePatch,
    /delete body\.closeLeadId/,
    "closeLeadId must be stripped from the body before the merge"
  );
});

test("selling a car closes a deal only when it is unambiguous", () => {
  /* Light and raw API callers cannot name a deal. Closing one of several open
     deals by guessing would close the wrong customer's; a car sold outside the
     system has none at all and must stay untouched. */
  const handler = inventoryPutHandler();
  assert.match(
    handler,
    /openLeads\.length === 1/,
    "the no-id fallback must require exactly one open deal"
  );
  assert.match(
    handler,
    /openLeads\.length > 1[\s\S]{0,220}console\.log/,
    "an ambiguous sale must be logged rather than silently guessed"
  );
});

test("a named closeLeadId is validated, not trusted", () => {
  const handler = inventoryPutHandler();
  const block = handler.slice(handler.indexOf("if (closeLeadId)"));
  assert.match(block, /named\.vehicleId === vehicle\.id/, "the deal must be on this car");
  assert.match(block, /named\.status !== "Closed Won"/, "an already-closed deal must not re-close");
  assert.match(block, /mayCouple\(named, vehicle\)/, "must not cross dealerships");
});

test("returning a car to stock reopens every deal that closed on it", () => {
  /* The old client-side version used .find(), reopening one deal and silently
     leaving any others sitting at Closed Won on a car back in stock. */
  const handler = inventoryPutHandler();
  assert.match(
    handler,
    /backInStock[\s\S]*for \(const l of state\.leads/,
    "must iterate every lead, not just the first match"
  );
  assert.match(
    handler,
    /l\.statusBeforeClose \|\| "Negotiating"/,
    "must restore the recorded prior stage, falling back only for legacy rows"
  );
});

/** The DELETE /api/inventory/:id handler. */
function inventoryDeleteHandler() {
  const start = body.indexOf('app.delete("/api/inventory/:id"');
  assert.ok(start !== -1, "could not locate DELETE /api/inventory/:id");
  const rest = body.slice(start);
  const end = rest.indexOf("\napp.");
  return rest.slice(0, end === -1 ? undefined : end);
}

test("a car sold outside the DMS can still be deleted", () => {
  /* The old rule refused every SOLD unit and told the dealer to "archive it
     instead" — but no archive existed, so a cash sale off the floor was stuck
     in the stock list permanently. Deletion must be blocked only by an actual
     record of the transaction, never by the status alone. */
  const handler = inventoryDeleteHandler();
  assert.doesNotMatch(
    handler,
    /status === "SOLD"[\s\S]{0,120}return res\.status\(4/,
    "SOLD alone must not block deletion"
  );
  assert.match(handler, /sealedTotal > 0/, "only a recorded sale may block deletion");
});

test("deleting a recorded sale is refused in favour of archiving", () => {
  const handler = inventoryDeleteHandler();
  const guard = handler.slice(handler.indexOf("const sealed"));
  for (const evidence of ["closedDeals", "invoices", "agreements", "signedDocuments"]) {
    assert.match(guard, new RegExp(evidence), `${evidence} must count as a record of the sale`);
  }
  assert.match(handler, /res\.status\(409\)/, "must refuse with a conflict, not silently delete");
});

test("deleting a vehicle leaves nothing dangling", () => {
  /* The handler used to remove the row and stop, leaving leads, documents and
     docEvents pointing at an id that no longer resolves. */
  const handler = inventoryDeleteHandler();
  assert.match(
    handler,
    /if \(l\.vehicleId === gone\) delete l\.vehicleId/,
    "leads must be unlinked, not left pointing at a deleted car"
  );
  assert.match(handler, /state\.documents = /, "documents on that vehicle must be removed");
  assert.match(handler, /state\.docEvents = /, "their audit rows must go too");
});

test("only the deal that sold a car may un-sell it", () => {
  /* `sell()` no-ops when the car is already SOLD, so without an ownership test
     `free()` would reverse a sale it never made. Reproduced before the fix:
     sell a car from Light with two open enquiries (coupling closes neither),
     toggle an unrelated lead to Closed Won and back, and the car returned to
     stock. A car sold outside the system has no owner, so no lead can free it. */
  const handler = leadPutHandler();
  assert.match(
    handler,
    /soldByLeadId = lead\.id/,
    "selling must record which deal owns the sale"
  );
  assert.match(
    handler,
    /if \(vehicle\.soldByLeadId !== lead\.id\) return;/,
    "freeing must refuse unless this deal owns the sale"
  );
});

test("a car returning to stock goes back on the website", () => {
  /* Selling forces showOnWebsite false. Without restoring it the car came back
     to the floor invisible online, while the UI said it was re-listed. */
  assert.match(leadPutHandler(), /freed\.showOnWebsite = true/);
  assert.match(inventoryPutHandler(), /vehicle\.showOnWebsite = true/);
});

test("a named closeLeadId cannot resurrect a lost deal", () => {
  /* The no-id fallback excludes Closed Lost; the named branch checked only for
     Closed Won, so a dead deal was a valid close target and came back as
     revenue. The two predicates must agree. */
  const handler = inventoryPutHandler();
  const block = handler.slice(handler.indexOf("if (closeLeadId)"));
  assert.match(block, /named\.status !== "Closed Lost"/);
});

test("archiving forces SOLD and off the website", () => {
  /* Archiving once set only archivedAt, so the unit kept status INVENTORY —
     counted as live stock and still published to the dealer's own site. */
  const helper = body.slice(body.indexOf("function applyVehiclePatch"));
  const fn = helper.slice(0, helper.indexOf("\nfunction "));
  assert.match(fn, /if \(patch\.archivedAt\)/);
  assert.match(fn, /patch\.status = "SOLD"/);
  assert.match(fn, /patch\.showOnWebsite = false/);
});

test("the public feed never publishes an archived unit", () => {
  /* Guarded independently of status rather than trusting archiving to have set
     SOLD — this feed is consumed by live dealer websites. */
  const start = body.indexOf("function toPublicVehicle");
  const fn = body.slice(start, body.indexOf("\nfunction ", start + 10));
  assert.match(
    fn,
    /const published = [^;]*!v\.archivedAt/,
    "the publish predicate must exclude archived units"
  );
});

test("a document cannot name another dealership's lead", () => {
  /* mayTouch guards the document, which is created under the caller's own
     dealership and always passes. Finalize and void then write docStage,
     docFlowCompletedAt and dealChecklist onto whatever lead was named. */
  const start = body.indexOf('app.post("/api/documents"');
  const handler = body.slice(start, body.indexOf("\napp.", start + 10));
  assert.match(handler, /const ownerLead = state\.leads\.find/);
  assert.match(
    handler,
    /ownerLead\.dealershipId !== dealershipId/,
    "the named lead must belong to the caller"
  );
});

test("a stage cannot be finalised before the ones ahead of it", () => {
  /* Without ordering, a lone handover document finalised on an untouched deal
     stamped it complete with no proforma, deed, compliance or invoice — and
     the deal then dropped off Deal Readiness. */
  const start = body.indexOf('app.post("/api/documents/:id/finalize"');
  const handler = body.slice(start, body.indexOf("\napp.", start + 10));
  assert.match(handler, /missingEarlier/);
  assert.match(handler, /DOC_STAGES\.slice\(0, DOC_STAGES\.indexOf\(doc\.stage\)\)/);
});

test("voiding an invoice unticks the checklist it ticked", () => {
  const start = body.indexOf('app.post("/api/documents/:id/void"');
  const handler = body.slice(start, body.indexOf("\napp.", start + 10));
  assert.match(handler, /doc\.stage === "invoice"[\s\S]{0,140}invoiced: false/);
});

test("a recorded sale cannot be deleted even once archived", () => {
  /* The archived-unit exemption let a dealer archive a documented sale and then
     delete it — the one outcome archiving exists to prevent. */
  const handler = inventoryDeleteHandler();
  assert.doesNotMatch(handler, /sealedTotal > 0 && !target\.archivedAt/);
  assert.match(handler, /if \(sealedTotal > 0\) \{/);
});

test("deleting a vehicle re-derives the stages its documents proved", () => {
  const handler = inventoryDeleteHandler();
  assert.match(handler, /affectedLeadIds/);
  assert.match(handler, /recomputeDocStage\(/);
  assert.match(handler, /if \(t\.vehicleId === gone\) delete t\.vehicleId/, "tasks must be unlinked too");
});

test("the seed is never handed out by reference", () => {
  /* readState falls back to the seed when a data file cannot be read. Returning
     the module-level object let a write handler mutate it in place and
     writeState persist it — one unreadable dealer file turned the seed into the
     live data, and every later request in that process compounded it. */
  assert.match(body, /function freshDefaultState/);
  assert.doesNotMatch(
    body,
    /return DEFAULT_MOCK_STATE;/,
    "readState must return a clone, never the shared object"
  );
  assert.doesNotMatch(
    body,
    /writeState\(DEFAULT_MOCK_STATE\)/,
    "the reset endpoint must write a copy — writeState re-buckets rows in place"
  );
});

test("ids cannot collide within a millisecond", () => {
  /* `prefix + Date.now()` collides for records created in the same
     millisecond — routine, since a document and its audit row are written in
     one request. findIndex then resolves only the first, so the twin is
     unaddressable, and guards comparing `l.id !== lead.id` match the wrong row. */
  assert.match(body, /function newId\(prefix: string\)/);
  assert.doesNotMatch(
    body,
    /id: "[a-z_]+_" \+ Date\.now\(\)/,
    "no id may still be built straight from Date.now()"
  );
});

test("a closed deal cannot be deleted out from under its paperwork", () => {
  /* Deleting a Closed Won lead also unblocked vehicle deletion: sealed.closedDeals
     dropped to zero, so the car and its signed documents became freely
     deletable — the opposite rule to the one DELETE /api/documents enforces. */
  const start = body.indexOf('app.delete("/api/leads/:id"');
  const handler = body.slice(start, body.indexOf("\napp.", start + 10));
  assert.match(handler, /target\.status === "Closed Won" \|\| signedDocs > 0/);
  assert.match(handler, /res\.status\(409\)/);
});

test("deleting a lead takes its dependants and releases its car", () => {
  const start = body.indexOf('app.delete("/api/leads/:id"');
  const handler = body.slice(start, body.indexOf("\napp.", start + 10));
  assert.match(handler, /if \(t\.leadId === gone\) delete t\.leadId/, "tasks must be unlinked");
  assert.match(handler, /state\.documents = /, "its documents must go with it");
  assert.match(handler, /state\.docEvents = /, "and their audit rows");
  assert.match(
    handler,
    /soldByLeadId === gone/,
    "a car this deal sold must be released, not stranded SOLD"
  );
  assert.match(handler, /stillHeld/, "unless another deal still holds it");
});

test("tax invoice numbers are sequential, per dealer, and never reused", () => {
  /* SARS requires the number on a tax invoice to be sequential and
     non-repeating. It was `INV-2026-00${invoices.length + 1}`: derived from a
     count across ALL dealers, frozen at 2026, and overridable by the caller —
     so two dealerships drew from one sequence and a client could name its own
     number twice. */
  assert.match(body, /function nextDocNumber/);
  const start = body.indexOf("function nextDocNumber");
  const fn = body.slice(start, body.indexOf("\napp.", start));
  assert.match(fn, /dealer\[opts\.seqKey\] = next/, "the counter must persist on the dealership");
  assert.match(fn, /Math\.max\(highest,/, "it must never fall below what was already issued");
  assert.match(fn, /getFullYear\(\)/, "the year must not be hardcoded");
  assert.doesNotMatch(
    body,
    /invoiceNumber: req\.body\.invoiceNumber/,
    "a caller must not be able to choose its own invoice number"
  );
  /* Agreements carried the identical defect and are fixed by the same helper.
     Scoped to actual assignments so the comment explaining the old code does
     not trip the check. */
  assert.doesNotMatch(
    body,
    /Number: req\.body\.\w+ \|\| `\w+-\d{4}-00\$\{state\./,
    "no document number may be derived from a row count or chosen by the caller"
  );
});

test("finalising the last stage records completion distinguishably", () => {
  /* docStage goes null when handover finalises — exactly what a never-started
     lead carries. Without a separate stamp a finished deal renders as if it had
     never begun, and completed deals cannot be filtered off Deal Readiness. */
  assert.match(
    body,
    /nextStage === null[\s\S]{0,220}docFlowCompletedAt/,
    "completing the flow must stamp docFlowCompletedAt"
  );
});

test("completion is backfilled from evidence, not guessed", () => {
  /* Rows that completed before the field existed carry docStage: null with no
     stamp. A signed handover document proves completion, so those can be
     recovered rather than left ambiguous forever. */
  assert.match(body, /function backfillDocFlowCompletion/);
  const start = body.indexOf("function backfillDocFlowCompletion");
  const fn = body.slice(start, body.indexOf("\ntry {", start));
  assert.match(fn, /"handover"/, "must key off the handover document");
  assert.match(fn, /"Signed"/, "must require the document to be signed");
  assert.match(
    fn,
    /if\s*\(\s*lead\.docFlowCompletedAt\s*\)\s*continue/,
    "must be idempotent — never overwrite an existing stamp"
  );
});
