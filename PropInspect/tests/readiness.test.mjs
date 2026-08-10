/**
 * Gallery readiness must count the whole gallery.
 *
 * Encodes a defect found on 2026-07-27: computeDmsGalleryReadiness counted
 * v.images alone. mapAutoLensPhotos files only the eight exterior slots there
 * and sends every interior, engine, detail and document shot to extrasPhotos —
 * so a full 22-photo capture scored 8 against a target of 12 and could never
 * reach web-ready however much the dealer shot.
 *
 * The counted set must stay in step with what the public feed publishes:
 * toPublicVehicle concatenates images + extrasPhotos. If those two ever
 * disagree, a car reads as web-ready and publishes a different number of photos
 * than the badge promised.
 *
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "src", "lib", "dmsReadiness.ts"), "utf8");

/* Imported as TypeScript directly — the suite runs under tsx, which is already
   a dependency of this package. An earlier version stripped the annotations with
   regexes and evaluated the result, which broke on the first `export interface`
   it met; testing the real module is both simpler and honest. */
async function loadReadiness() {
  return import("../src/lib/dmsReadiness.ts");
}

const img = (n) => Array(n).fill("data:image/jpeg;base64,x");

test("counts images + extrasPhotos, not images alone", async () => {
  const { computeDmsGalleryReadiness, WEB_GALLERY_TARGET } = await loadReadiness();

  // The real shape of a completed TruLens capture: 8 exterior, 14 everything else.
  const yaris = { images: img(8), extrasPhotos: img(14), status: "INVENTORY" };
  const r = computeDmsGalleryReadiness(yaris);

  assert.equal(r.photoCount, 22, "must count both arrays");
  assert.ok(
    r.photoCount >= WEB_GALLERY_TARGET,
    `22 photos should clear the target of ${WEB_GALLERY_TARGET}`
  );
  assert.equal(r.webReady, true, "a full capture must be able to reach web-ready");
  assert.equal(r.level, "ready");
});

test("a complete 10-shot core capture reads as web-ready", async () => {
  const { computeDmsGalleryReadiness } = await loadReadiness();
  // TruLens core = 8 exterior-lap panels (images) + interior + odometer (extras).
  const core = { images: img(8), extrasPhotos: img(2), status: "INVENTORY" };
  const r = computeDmsGalleryReadiness(core);
  assert.equal(r.photoCount, 10, "8 exterior + 2 extras = the 10-shot core");
  assert.equal(r.webReady, true, "a full core capture must reach web-ready");
  assert.equal(r.level, "ready");
});

test("a genuinely thin gallery is still held back", async () => {
  const { computeDmsGalleryReadiness } = await loadReadiness();

  assert.equal(computeDmsGalleryReadiness({ status: "INVENTORY" }).level, "capture");
  assert.equal(
    computeDmsGalleryReadiness({ images: img(3), status: "INVENTORY" }).webReady,
    false,
    "three photos is not a web gallery"
  );
  assert.equal(
    computeDmsGalleryReadiness({ images: img(8), status: "INVENTORY" }).webReady,
    false,
    "exterior-only, below target, must not read as ready"
  );
});

test("a sold car is never web-ready", async () => {
  const { computeDmsGalleryReadiness } = await loadReadiness();
  const sold = computeDmsGalleryReadiness({
    images: img(8),
    extrasPhotos: img(14),
    status: "SOLD",
  });
  assert.equal(sold.webReady, false, "sold stock must come off the website");
});

test("the counted arrays match what the public feed publishes", () => {
  /* toPublicVehicle builds its gallery as images + extrasPhotos. Readiness must
     count the same two, or the badge promises a different gallery than the one
     the dealer's website receives. Guarded as text because the server is a
     separate build. */
  const server = readFileSync(join(here, "..", "server.ts"), "utf8");
  const feed = server.slice(server.indexOf("function toPublicVehicle"));
  const allImages = feed.slice(feed.indexOf("const allImages"), feed.indexOf("const allImages") + 120);

  assert.match(allImages, /images/, "feed gallery should include images");
  assert.match(allImages, /extras/, "feed gallery should include extrasPhotos");
  assert.match(src, /count\(v\.images\)\s*\+\s*count\(v\.extrasPhotos\)/,
    "readiness should count images + extrasPhotos, matching the feed");
});
