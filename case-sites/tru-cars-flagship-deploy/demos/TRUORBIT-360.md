# TruOrbit 360° — how it works on this site (and how to keep it working)

Practical notes for Cars on Caledon. Also the checklist to make the 360 work
out-of-the-box on any future dealer site cloned from this one.

## Where the 360 comes from
- Captured in **TruLens**. The orbit "package" is written to the **Lens server**
  (`lens.tru-saas.com`) — **not** to TruFlow — by either:
  - the **"3D" button** in the TruLens Report Preview (manual), or
  - the **"Push to TruFlow DMS"** button (automatic, when the car has **≥6**
    exterior orbit photos).
  Both POST to Lens `/api/export/web-3d`.
- The site fetches it **lazily**, when a car's detail modal opens:
  `GET https://lens.tru-saas.com/api/public/web3d/{stockNumber}`
  → `{ package: { frames: [{ image, azimuth, ... }], damageTags: [...] } }`.
  Frame images are absolute Lens URLs. Lens sends `Access-Control-Allow-Origin: *`,
  so the cross-origin fetch works with no backend change.
- The **stock feed (Premium) does NOT carry the orbit** — the feed only lists the
  cars. Orbit delivery is Lens direct-fetch only, handled entirely in `coc-media.js`.
  (Premium *can* carry it inline via `/api/sync/web3d`, but nothing populates that,
  so treat Lens direct-fetch as the single delivery path.)

## Files involved
- `coc-media.js` — fetches the orbit and builds the 360 spin (+ inspection pins)
  over the VD stage. Wraps `window.openVehicleDetail`.
- `coc-vd.js` — builds the VD modal and the older mirror-flip "fake 360" base stage
  (`#vdStage`).
- `coc-widgets.css` — `.vd-spin*` styles.

## Two bugs fixed 2026-08-04 (both in `coc-media.js`)
1. **Orbit never loaded.** The consumer fetched by `car.stockNumber`, which
   `mapApiVehicle` never sets — the stock number lives on `car.tag`. The fetch ran
   with `undefined` and bailed, so no 360 ever showed. Fixed with an `orbitUrl(car)`
   resolver: prefer `car.web3dUrl`, else build the Lens URL from
   `car.stockNumber || car.tag`. **`mapApiVehicle` deliberately not edited** — the
   DMS drives it live (Paul's standing rule).
2. **Drag dead / "spun once then froze".** `#vdStage` (in `coc-vd.js`) has its own
   `pointerdown` that calls `stage.setPointerCapture(...)` for the mirror-flip
   illusion. The spin panel lives **inside** the stage, so a drag bubbled up, the
   stage re-captured the pointer, and every move drove the flip illusion (hidden
   under `.media-alt`) instead of scrubbing frames. The auto-spin still ran because
   it's a timer, not pointer-driven — hence "spun once, then nothing". Fixed with
   `e.stopPropagation()` on the spin's pointer handlers. The auto-spin was also
   eased to ~3s/revolution — a near-slow-motion reveal (was a flat 45ms/frame →
   a 0.45s blur on a 10-frame orbit).

## Checklist for a NEW dealer site (so the 360 works on day one)
1. **Expose the stock number to the orbit consumer.** Here it's `car.tag`; pass
   through `web3dUrl` too if the feed supplies it. If the site's vehicle mapper
   drops/renames the stock number, the 360 dies silently with no error.
2. **Isolate the spin's pointer gestures.** The spin's `pointerdown`/`move`/`up`
   must `stopPropagation()` so they never reach a base-stage drag handler — a
   `setPointerCapture` on an ancestor will steal the drag.
3. **Lens must be reachable + CORS-open** for the dealer domain (it sends `*` today).
4. **The dealer must actually export each car's orbit** in TruLens (≥6 orbit
   photos). No export → no package → the site correctly stays on the static stage.
5. **Keep frame thresholds aligned.** Lens saves an orbit at **≥6** frames; this
   site only builds a spin at **≥8** (`enhance()`: `m.spin.length >= 8`). A 6–7-frame
   car is served but silently dropped. Target 8 on both ends.
6. **Stock number is the end-to-end join key** — keep it clean (no stray spaces or
   casing drift, e.g. "Coc 1000") between TruLens capture and the DMS feed.

## Current live state (2026-08-04)
4 cars in the feed (`Coc 1000`, `Coc1001`, `Coc1002`, `Coc1003`); only **Coc1003**
has an orbit exported (10 frames). The other three need exporting from TruLens
before they'll show a 360.
