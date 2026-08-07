/**
 * canAdvance() enforces the field requirements for each TruContract stage,
 * plus two conditional rules that must NOT fire in the wrong situation:
 *   - ncaDisclosure is required only when the lead has finance in play
 *     (a cash-paid car doesn't need an NCA disclosure)
 *   - buyerAddress is required only when the invoice total exceeds R5,000
 *     (VAT Act §20(5) — below that a till-slip-style invoice is legal)
 * A version of the validator that ignored those conditionals would either
 * block legitimate finalisations or let non-compliant docs through.
 *
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";

async function loadValidator() {
  return import("../src/lib/docValidator.ts");
}

test("proforma requires vin, priceBreakdown, validityWindow", async () => {
  const { canAdvance } = await loadValidator();
  assert.deepEqual(
    canAdvance("proforma", {}).missing.sort(),
    ["priceBreakdown", "validityWindow", "vin"],
  );
  const complete = canAdvance("proforma", {
    vin: "AHT12345",
    priceBreakdown: { list: 250000, discount: 10000 },
    validityWindow: "7 days",
  });
  assert.equal(complete.ok, true);
  assert.deepEqual(complete.missing, []);
});

test("deed does NOT require ncaDisclosure for a cash deal", async () => {
  const { canAdvance } = await loadValidator();
  const cashDeal = canAdvance(
    "deed",
    { voetstootsClause: "as-is", tradeInLine: "none" },
    { dealChecklist: { financeStatus: "N/A" } },
  );
  assert.equal(cashDeal.ok, true, `expected ok, got missing=${JSON.stringify(cashDeal.missing)}`);
});

test("deed DOES require ncaDisclosure when finance is submitted", async () => {
  const { canAdvance } = await loadValidator();
  const financedNoDisclosure = canAdvance(
    "deed",
    { voetstootsClause: "as-is", tradeInLine: "none" },
    { dealChecklist: { financeStatus: "Submitted" } },
  );
  assert.equal(financedNoDisclosure.ok, false);
  assert.deepEqual(financedNoDisclosure.missing, ["ncaDisclosure"]);

  const financedWithDisclosure = canAdvance(
    "deed",
    {
      voetstootsClause: "as-is",
      tradeInLine: "none",
      ncaDisclosure: "acknowledged",
    },
    { dealChecklist: { financeStatus: "Approved" } },
  );
  assert.equal(financedWithDisclosure.ok, true);
});

test("compliance requires rwcRef, rwcDate, natisMatch", async () => {
  const { canAdvance } = await loadValidator();
  const partial = canAdvance("compliance", { rwcRef: "RWC-99", rwcDate: "2026-08-01" });
  assert.equal(partial.ok, false);
  assert.deepEqual(partial.missing, ["natisMatch"]);
  // natisMatch is a boolean confirmation; false must be treated as missing.
  const denied = canAdvance("compliance", {
    rwcRef: "RWC-99",
    rwcDate: "2026-08-01",
    natisMatch: false,
  });
  assert.equal(denied.ok, false);
  assert.deepEqual(denied.missing, ["natisMatch"]);
});

test("invoice buyerAddress is required only above R5,000", async () => {
  const { canAdvance } = await loadValidator();
  const smallInvoice = canAdvance("invoice", {
    invoiceNo: "INV-1",
    vatBreakdown: { ex: 4000, vat: 600 },
    vin: "AHT12345",
    total: 4600,
  });
  assert.equal(smallInvoice.ok, true);

  const bigInvoice = canAdvance("invoice", {
    invoiceNo: "INV-2",
    vatBreakdown: { ex: 250000, vat: 37500 },
    vin: "AHT12345",
    total: 287500,
  });
  assert.equal(bigInvoice.ok, false);
  assert.deepEqual(bigInvoice.missing, ["buyerAddress"]);
});

test("handover requires warrantyDoc and natisUpdated", async () => {
  const { canAdvance } = await loadValidator();
  const missing = canAdvance("handover", {});
  assert.deepEqual(missing.missing.sort(), ["natisUpdated", "warrantyDoc"]);
  const done = canAdvance("handover", {
    warrantyDoc: "warranty-2026-08-07.pdf",
    natisUpdated: true,
  });
  assert.equal(done.ok, true);
});

test("empty strings and null/undefined are all treated as missing", async () => {
  const { canAdvance } = await loadValidator();
  const result = canAdvance("proforma", {
    vin: "",
    priceBreakdown: null,
    validityWindow: undefined,
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing.sort(), ["priceBreakdown", "validityWindow", "vin"]);
});
