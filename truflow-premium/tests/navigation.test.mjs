/**
 * Every screen must be reachable, and every menu entry must lead somewhere.
 *
 * This encodes a defect found on 2026-07-27: eight sections were fully built,
 * rendered on `activeSection === "..."`, and had no navigation entry pointing at
 * them. One was the sales pipeline — the only place in the app where a vehicle
 * can be moved from floor stock to pending to sold — so a dealer could not mark
 * a car as sold anywhere, and the screen that did it had been sitting there the
 * whole time.
 *
 * Static analysis on purpose: it needs no browser, no build and no compilation,
 * so it runs in under a second and cannot rot the way a mocked render can.
 *
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const APP = join(here, "..", "src", "App.tsx");
const source = readFileSync(APP, "utf8");

/** Sections deliberately not in the menu, each with the reason it is withheld.
 *
 *  This is not a to-do list of things to wire up later — it is a record of
 *  screens that must NOT ship until their data is real. Removing a name from
 *  here is a decision to show a dealer what it displays, so read the reason
 *  first. */
const WITHHELD = {
  analytics:
    "Reports 12,847 monthly page views and 8,432 filter views as hard-coded " +
    "literals, and computes conversion as leads.length / 8432 — a real " +
    "numerator over an invented denominator, presented to a dealer as a " +
    "measurement of their own website. Needs a genuine page-view source.",
  scoring:
    "Ranks leads by digitalScore, which is assigned Math.random() * 41 + 50 at " +
    "creation. 'Hot targets - high purchase velocity' is a random number with a " +
    "label on it, and a salesperson working that order would call the wrong " +
    "customer first. Needs a real formula over data already held.",
  customer_form:
    "Duplicates the Lead CRM capture already in the menu and reports success " +
    "with a raw alert().",
};

function navIds(src) {
  const start = src.indexOf("const groupedNavigation");
  const end = src.indexOf("// Filter navigation items");
  assert.ok(start !== -1 && end > start, "could not locate groupedNavigation");
  return new Set([...src.slice(start, end).matchAll(/id:\s*"([a-z_]+)"/g)].map((m) => m[1]));
}

function renderedSections(src) {
  return new Set(
    [...src.matchAll(/activeSection === "([a-zA-Z_]+)"/g)].map((m) => m[1])
  );
}

test("every menu entry renders a section", () => {
  const dead = [...navIds(source)].filter((id) => !renderedSections(source).has(id));
  assert.deepEqual(
    dead,
    [],
    `Menu entries with no matching section — clicking these shows a blank page: ${dead.join(", ")}`
  );
});

test("every built section is reachable, or documented as withheld", () => {
  const nav = navIds(source);
  const orphans = [...renderedSections(source)].filter(
    (id) => !nav.has(id) && !(id in WITHHELD)
  );
  assert.deepEqual(
    orphans,
    [],
    `Built but unreachable — no menu entry and no recorded reason. Either add a ` +
      `nav entry or record why it is withheld in WITHHELD: ${orphans.join(", ")}`
  );
});

test("withheld list has no stale entries", () => {
  const rendered = renderedSections(source);
  const gone = Object.keys(WITHHELD).filter((id) => !rendered.has(id));
  assert.deepEqual(
    gone,
    [],
    `WITHHELD names sections that no longer exist — delete them: ${gone.join(", ")}`
  );
});

test("a withheld section is never given a menu entry by accident", () => {
  const nav = navIds(source);
  const leaked = Object.keys(WITHHELD).filter((id) => nav.has(id));
  assert.deepEqual(
    leaked,
    [],
    `These are in the menu but recorded as withheld. If the data behind them is ` +
      `real now, remove them from WITHHELD deliberately: ${leaked.join(", ")}`
  );
});

test("role menus only name sections that exist", () => {
  // The role filters list ids as string literals; a typo silently hides a screen
  // from that role with no error anywhere.
  const rendered = renderedSections(source);
  const nav = navIds(source);
  for (const role of ["salesperson", "manager"]) {
    const block = source.slice(source.indexOf(`selectedRole === '${role}'`));
    const list = block.slice(block.indexOf("["), block.indexOf("]") + 1);
    const ids = [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    assert.ok(ids.length > 0, `could not parse the ${role} menu list`);
    const bogus = ids.filter((id) => !rendered.has(id) && !nav.has(id));
    assert.deepEqual(
      bogus,
      [],
      `${role} menu names ids that are neither rendered nor in the menu — likely a typo: ${bogus.join(", ")}`
    );
  }
});
