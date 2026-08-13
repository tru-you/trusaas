#!/usr/bin/env node
/*
 * tru-ui-src — copy shared React components into the consuming app's
 * src/components/ directory. Runs from the consuming app's CWD (predev,
 * prebuild), and writes byte-identical output to what the source files
 * contain — so as long as the tracked copies match the source, git stays
 * clean. When the source changes, `npm run dev` picks it up on next start.
 *
 * Kept intentionally tiny — only Node built-ins, no deps, no fancy paths.
 * If this ever breaks on Render, the tracked app-side copies are still
 * committed and the build proceeds unaffected (safety net by design).
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "src");
const DEST = resolve(process.cwd(), "src", "components");

function isReadable(p) {
  try { statSync(p); return true; } catch { return false; }
}

if (!isReadable(SRC)) {
  console.error(`[tru-ui-src] source dir not found: ${SRC}`);
  process.exit(1);
}
if (!isReadable(resolve(process.cwd(), "src"))) {
  console.error(`[tru-ui-src] no src/ in cwd (${process.cwd()}); skipping — not an app root.`);
  process.exit(0); // exit 0 so it doesn't break tooling run from repo root
}

mkdirSync(DEST, { recursive: true });

const files = readdirSync(SRC).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));
let wrote = 0;
for (const f of files) {
  const contents = readFileSync(join(SRC, f));
  const target = join(DEST, f);
  // Skip write if identical, so filesystem mtime and git status stay clean.
  let current = null;
  try { current = readFileSync(target); } catch { /* first-time */ }
  if (current && current.equals(contents)) continue;
  writeFileSync(target, contents);
  wrote++;
}

if (wrote > 0) console.log(`[tru-ui-src] synced ${wrote}/${files.length} file(s) → ${DEST}`);
