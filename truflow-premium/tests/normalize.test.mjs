/**
 * The vehicle make/model/trim normaliser. The risk here is OVER-stripping — a
 * real hyphenated model (CX-5, C-Class) mistaken for a disc M&M prefix — so the
 * "leaves real models untouched" test matters as much as the "cleans the junk"
 * one. Run: npx tsx --test tests/normalize.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { tidyStr, cleanModelName } from "../saNormalize.ts";

test("strips the SA disc M&M prefix (the real Caledon values)", () => {
  const cases = [
    ["Vw 370 - Golf", "Golf"],
    ["Vw 250 - Polo", "Polo"],
    ["Vw 216 - T-cross", "T-cross"],
    ["Au 37x-a3", "a3"], // glued variant, no spaces around the dash
  ];
  for (const [input, want] of cases) {
    assert.equal(cleanModelName(input), want, `"${input}" should clean to "${want}"`);
  }
});

test("leaves real hyphenated / coded models untouched", () => {
  // None of these have the <2-3 letters> <short code> - <name> shape.
  for (const m of ["CX-5", "X-Trail", "C-Class", "A-Class", "3 Series", "i20", "Golf Sportsvan", "Polo", "Hilux", "Corolla Cross"]) {
    assert.equal(cleanModelName(m), m, `"${m}" must be left alone`);
  }
});

test("tidyStr trims and collapses whitespace; passes non-strings through", () => {
  assert.equal(tidyStr("Volkswagen "), "Volkswagen");
  assert.equal(tidyStr("  Toyota"), "Toyota");
  assert.equal(tidyStr("Tiguan  2.0   TSI "), "Tiguan 2.0 TSI");
  assert.equal(tidyStr(""), "");
  assert.equal(tidyStr(undefined), undefined);
  assert.equal(tidyStr(null), null);
});

test("cleanModelName also tidies whitespace when no prefix matches", () => {
  assert.equal(cleanModelName("Polo vivo "), "Polo vivo");
  assert.equal(cleanModelName("Tiguan 2.0 TSI "), "Tiguan 2.0 TSI");
  assert.equal(cleanModelName(undefined), undefined);
});
