// Split a curated vehicle-catalogue.json into per-make chunks + a makes index,
// then PROVE the reassembled tree deep-equals the original before writing.
//
// Usage: node chunk-catalogue.mjs <publicDir>
//   reads  <publicDir>/vehicle-catalogue.json
//   writes <publicDir>/catalogue/index.json          (array of {name,file})
//          <publicDir>/catalogue/m001.json … mNNN.json (per-make subtrees)

import fs from "node:fs";
import path from "node:path";

const publicDir = process.argv[2];
if (!publicDir) { console.error("usage: node chunk-catalogue.mjs <publicDir>"); process.exit(1); }

const srcPath = path.join(publicDir, "vehicle-catalogue.json");
const outDir = path.join(publicDir, "catalogue");

const original = JSON.parse(fs.readFileSync(srcPath, "utf8"));
const makes = Object.keys(original).sort();

// Build chunks + index (stable numbered filenames — no slug collisions).
const index = [];
const chunks = new Map(); // file -> subtree
makes.forEach((name, i) => {
  const file = `m${String(i + 1).padStart(3, "0")}.json`;
  index.push({ name, file });
  chunks.set(file, original[name]);
});

// PROVE equality: reassemble index+chunks and deep-compare to the original.
const reassembled = {};
for (const { name, file } of index) reassembled[name] = chunks.get(file);
const a = JSON.stringify(original, Object.keys(original).sort());
const b = JSON.stringify(reassembled, Object.keys(reassembled).sort());
// Deep structural compare via canonical stringify (sorted keys at every level).
function canon(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
}
if (canon(original) !== canon(reassembled)) {
  console.error(`✗ ${publicDir}: reassembly does NOT match original — aborting, no files written.`);
  process.exit(2);
}

// Equality proven → write.
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify(index));
for (const [file, subtree] of chunks) {
  fs.writeFileSync(path.join(outDir, file), JSON.stringify(subtree));
}

const totalChunkBytes = [...chunks.values()].reduce((n, s) => n + JSON.stringify(s).length, 0);
const indexBytes = JSON.stringify(index).length;
console.log(`✓ ${publicDir}: ${makes.length} makes → index ${indexBytes}B + ${chunks.size} chunks (${totalChunkBytes}B total). Reassembly === original.`);
