/**
 * Photos must end up on disk, and must never end up in the state file.
 *
 * The whole point of the photo store is that data.json stops carrying image
 * bytes: one vehicle with a 22-shot capture made its dealer's public feed
 * 3.4 MB and 2.9 seconds, and readState() parses that on 58 request paths. After
 * the move the same feed is 2.7 KB.
 *
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const store = await import("../photoStore.ts");

function freshStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "photostore-"));
  store.initPhotoStore(dir);
  return dir;
}

/** A real 1x1 JPEG, so the magic bytes and extension mapping are exercised. */
const JPEG_B64 =
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
  "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA" +
  "AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
const JPEG_URI = `data:image/jpeg;base64,${JPEG_B64}`;

test("a data URI becomes a file on disk", () => {
  const dir = freshStore();
  const ref = store.put(JPEG_URI);

  assert.ok(ref, "should return a reference");
  assert.match(ref, /^\/media\/[a-f0-9]{64}\.jpg$/, "reference is /media/<sha256>.jpg");

  const onDisk = store.resolveRef(ref);
  assert.ok(fs.existsSync(onDisk), "file must exist");

  // The name must be the hash of the bytes — that is what makes the URL cacheable forever.
  const bytes = fs.readFileSync(onDisk);
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  assert.equal(path.basename(onDisk), `${hash}.jpg`);
  assert.deepEqual(bytes, Buffer.from(JPEG_B64, "base64"), "bytes must round-trip intact");

  fs.rmSync(dir, { recursive: true, force: true });
});

test("identical bytes are stored once", () => {
  const dir = freshStore();
  const a = store.put(JPEG_URI);
  const b = store.put(JPEG_URI);

  assert.equal(a, b, "same bytes must give the same reference");
  assert.equal(fs.readdirSync(path.join(dir, "media")).length, 1, "must not duplicate");

  /* This is not a micro-optimisation: TruLens re-exports the ENTIRE capture
     every time a dealer adds one more shot, so without dedupe a 22-photo car
     would accumulate a fresh copy of all 22 on every export. */
  fs.rmSync(dir, { recursive: true, force: true });
});

test("an already-stored reference passes through untouched", () => {
  const dir = freshStore();
  const ref = store.put(JPEG_URI);

  assert.equal(store.put(ref), ref, "re-storing a reference must be a no-op");
  assert.equal(
    fs.readdirSync(path.join(dir, "media")).length,
    1,
    "must not write a second file"
  );

  // This is what makes the boot migration safe to re-run and safe to interrupt.
  fs.rmSync(dir, { recursive: true, force: true });
});

test("non-photos are refused rather than stored", () => {
  const dir = freshStore();

  assert.equal(store.put(undefined), null);
  assert.equal(store.put(""), null);
  assert.equal(store.put("https://example.com/car.jpg"), null, "remote URLs are not ours");
  assert.equal(store.put("data:text/html;base64,PHNjcmlwdD4="), null, "not a media type we serve");
  assert.equal(store.put("data:image/jpeg;base64,"), null, "empty payload");
  assert.equal(fs.readdirSync(path.join(dir, "media")).length, 0, "nothing written");

  fs.rmSync(dir, { recursive: true, force: true });
});

test("resolveRef refuses anything that escapes the media directory", () => {
  const dir = freshStore();

  // Traversal must not resolve, or a crafted reference reads arbitrary files.
  assert.equal(store.resolveRef("/media/../data.json"), null);
  assert.equal(store.resolveRef("/media/../../etc/passwd"), null);
  assert.equal(store.resolveRef("/etc/passwd"), null);
  assert.equal(store.resolveRef("/media/not-a-hash.jpg"), null);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("putAll converts an array and keeps order", () => {
  const dir = freshStore();
  const png = "data:image/png;base64," + Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64");

  const out = store.putAll([JPEG_URI, png, "rubbish", null]);
  assert.equal(out.length, 2, "unusable entries are dropped, not carried as broken images");
  assert.match(out[0], /\.jpg$/);
  assert.match(out[1], /\.png$/);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("isStoredRef distinguishes a stored file from a data URI", () => {
  freshStore();
  assert.equal(store.isStoredRef(`/media/${"a".repeat(64)}.jpg`), true);
  assert.equal(store.isStoredRef(JPEG_URI), false, "a data URI is not a stored reference");
  assert.equal(store.isStoredRef("/media/short.jpg"), false);
  assert.equal(store.isDataUri(JPEG_URI), true);

  /* The migration decides what to rewrite on this test alone — a loose version
     would let base64 through as though it were already a file, and the state
     would never actually shrink. */
});
