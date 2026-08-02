# TruFlow Light — LIVE PRODUCT (do not delete)

This folder is a **shipping product** in the TruSaaS suite, not scratch work.

**TruFlow Light** is the lightweight dealer console — a single self-contained
`index.html` (vanilla JS, no build) that signs into the Premium API with a
dealer code to manage leads, inventory and vehicle uploads.

## How it deploys
- It is **not** its own Render service. `trusaas-premium` serves it at
  **flow.tru-saas.com/light** (`server.ts` → `express.static` on `public/light`).
- **Source of truth:** `Truflow-light/index.html` (this folder).
- **Deploy copy:** `truflow-premium/public/light/index.html`.
- On any change: edit here, then copy across to `public/light`
  (and `dist/light`, which is gitignored build output).

## Not to be confused with "Lite"
The old **TruFlow *Lite*** (a second full codebase, `password === '2026'`
client login, no disk) was **retired 2026-07-25**. That is dead. **This**
(Light) is alive and maintained. See the §2 note in `render.yaml`.

## Branding
Cyan suite identity (`#4FE3DC`; blue retired suite-wide). Canonical tokens:
`truflow-premium/src/brand.css` + `packages/tokens/tru-tokens.css`.
