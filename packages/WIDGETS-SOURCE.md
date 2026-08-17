# Widget source of truth

**Decision (2026-08): `packages/standalone/` is the single active source for the
dealer widgets. `packages/tru-*` (the old "canonical" copies) are FROZEN.**

## Why

`packages/standalone/` is a strict, backward-compatible **superset** of the old
canonical widgets:

- Lead delivery: `data-webhook` (Zapier/CRM) **and/or** CallMeBot, falling back to
  TruFlow (`data-slug` + `data-flow`) exactly like canonical did — so an ecosystem
  dealer that sets no webhook behaves identically to before.
- Plus: responsive icon-FAB, shimmer, matched launcher sizes, `data-text` /
  `data-scale`, higher z-index, per-widget forwarding via the loader.

It is also what ships to production: it deploys to **`cdn.tru-saas.com`**
(Netlify site `trudealer-widgets`, id `bca2fe0a-8055-4ae9-be49-389c2cce27b4`) and
drives the **TruWidgets** WordPress plugin (`packages/truwidgets-wp/`) and every
dealer rollout (YCG and onward).

## Rules

- **All widget development happens in `packages/standalone/`.** Fix bugs and add
  features there, then redeploy the CDN:
  ```bash
  netlify deploy --dir packages/standalone --prod --site bca2fe0a-8055-4ae9-be49-389c2cce27b4
  ```
- **`packages/tru-*` is frozen.** Do not add features. It stays as-is only for the
  existing case-site deploy copies under `case-sites/` that still reference it.
- If a case-site needs an update, migrate it to the standalone build (the tag /
  loader are compatible) rather than reviving canonical.

## Layout

| Path | Status |
|---|---|
| `packages/standalone/` | ✅ **Active source** — deploys to `cdn.tru-saas.com` |
| `packages/truwidgets-wp/` | ✅ WordPress plugin (injects the loader from the CDN) |
| `packages/tru-afford`, `tru-repay`, `tru-form`, `tru-book`, `tru-share`, `tru-loader` | 🧊 **Frozen** canonical copies |
