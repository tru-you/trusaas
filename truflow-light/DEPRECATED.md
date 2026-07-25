# TruFlow Lite — retired 2026-07-25

**Not deployed. Do not restart it. Do not point a dealer at it.**

The Render service `trusaas-flow` has been removed and its block deleted from
`render.yaml`. `flow.tru-saas.com` is now a custom domain on **`trusaas-premium`**,
so every dealer embed already pointing at `flow.` resolves to TruFlow.

## Why it went

- A second codebase carrying a stripped copy of TruFlow Premium — every fix had
  to be made twice, and they had already drifted apart
- Its "login" was `password === '2026'`, compared in client-side JavaScript
- No Render disk, so its state reset to the seed on every deploy. That is why
  its six mock cars kept reappearing
- It shipped a public-feed bug that had already been fixed in Premium:
  `"demo"` was still in `AGGREGATE_SLUGS`, so a request with no `?dealer=`
  returned every vehicle in its database, unscoped
- The tier split no longer reflects the product. There is one DMS: **TruFlow**

## If you need something from here

The code is intact — nothing has been deleted. Check whether Premium already
does it before porting anything across; most of Lite was a subset.

## Before deleting this directory

Confirm nothing still references it:

```bash
grep -rn "truflow-light\|trusaas-flow" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.yaml" .
```

Known remaining references at time of retirement: `.env.example` files in
TruLens and TruInspect list the old Lite URL as a comment, and
`Truflow-premium/src/lib/ecosystem.ts` still exports `TRUFLOW_LITE_URL`.
Neither breaks anything — both resolve to TruFlow now.
