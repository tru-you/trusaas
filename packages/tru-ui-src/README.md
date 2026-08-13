# tru-ui-src

Shared React components used verbatim by both TruLens and Truinspect. Files
here are the **source of truth**; a small `sync.mjs` copies them into each
app's `src/components/` directory at `predev`/`prebuild` time.

## Why this and not a proper npm package

Each app is deployed on Render with `rootDir: {App}/` and `npm install` runs
inside that subfolder — incompatible with npm workspaces or file: deps.
Publishing to a registry works but is overkill for three files. Copy-on-build
is honest: source lives in one place, apps get an editable local copy at
build time. Zero registry, zero workspace config, zero Render change.

## Editing

1. Edit files in `packages/tru-ui-src/src/`.
2. Run `npm run dev` (or `npm run build`) in the consuming app — the sync
   script fires as a pre-hook and rewrites the local copy.
3. Commit the source file **and** both apps' regenerated copies together.

## Safety net

The synced files stay tracked in git on purpose. If `sync.mjs` ever fails on
Render, each app's tracked copy is still there and the build proceeds.
Once the wiring has proved itself in production, the tracked copies can be
`.gitignore`d for a cleaner state.

## Adding a new shared component

1. Drop the `.tsx` file into `packages/tru-ui-src/src/`.
2. Add the same file to each app's `src/components/` (so it's tracked and
   the safety net covers it before the sync runs).
3. Add the `// SHARED SOURCE — edit only in packages/tru-ui-src/src/...`
   banner as the first line.
