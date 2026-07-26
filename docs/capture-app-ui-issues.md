# Capture app UI issues — TruLens and TruInspect

Found on TruLens 2026-07-26 during Caledon go-live testing, on an Android phone
at `lens.tru-saas.com`. **TruInspect shares the same components and has the same
faults** — `CameraGuide.tsx`, `InventoryList.tsx` and `App.tsx` are near
duplicates in both apps, so every fix below applies twice.

Paths given relative to each app root (`TruLens/`, `truinspect/`).

---

## 1. Slot chips crush and overlap each other

**Symptom.** The phase row under the viewfinder renders `Fron`, `Front`, `Rear`,
and `Rear Prof` with `NEXT Driver Side Prof` printed on top of its neighbour.
Labels are unreadable and you cannot tell which slot is selected.

**Cause.** `src/components/CameraGuide.tsx` ~1084:

```jsx
<div className="flex gap-2 overflow-x-auto pb-1 px-2 scrollbar-none">
  ...
  <button className="slot-state px-3 py-2 ... whitespace-nowrap ...">
```

The row has `overflow-x-auto`, but the buttons have **no `shrink-0`**. Flex
children shrink by default, so instead of overflowing and scrolling they
compress — and because `whitespace-nowrap` forbids wrapping, the text spills out
of its own box and lands on the next chip.

**Fix.** Add `shrink-0` to the chip button className. The container is already
correct; only the children are wrong.

This is the same bug pattern that broke TruFlow's lead-detail modal tabs, where
six tabs collapsed to 44px wide and 117px tall. Any `flex` + `overflow-x-auto`
row needs `shrink-0` on the children or it will squeeze rather than scroll.

---

## 2. Viewfinder is too short

**Symptom.** On a phone the camera preview is a letterbox strip roughly a third
of the screen, while the shot list, phase row, buttons and hint panel take the
rest. You cannot frame a car in it.

**Cause.** `.capture-preview` is `flex-1` inside a column, so it only gets what
the surrounding chrome leaves over — and that chrome has grown: a shot-list
header with progress dots, a phase strip, a slot row, a three-button utility
row, and a hint panel.

**Fix.** Give the preview a floor rather than leaving it as the remainder, e.g.
`min-h-[46svh]` on the `.capture-preview` container, and let the chrome below it
scroll. `svh` rather than `vh` so the mobile browser's collapsing address bar
does not change the framing mid-shoot.

---

## 3. Remove the guide overlay inside the camera box

The dashed frame, corner brackets and slot caption drawn over the live video are
not helping in practice — they clutter the one area that needs to be readable,
and the caption overlaps the AI status pills ("Lighting Perfect", "Level
LOCKED"), which are the parts a dealer actually uses.

Drawn by `drawViewfinderFrame` in `CameraGuide.tsx`, called from the render loop
around line 595. Remove the overlay draw; keep the status pills and the level
indicator.

---

## 4. A vehicle cannot be edited after it is created

**Symptom.** Get the model or trim wrong on the add-vehicle form and there is no
way back — no edit affordance anywhere in the inventory list.

**This is a UI gap, not a server limitation.** `POST /api/inventory`
(`server.ts` ~703) already **upserts**: given an existing `id` it merges the body
over the stored vehicle and preserves `photos` and `quality`.

```js
const existing = await getVehicle(vehicleData.id, userId);
if (existing) {
  const updatedVehicle = { ...existing, ...vehicleData, ... };
```

`App.tsx` even has `handleUpdateVehicle(vehicle, patch)` wired through to
`InventoryList` as `onUpdateVehicle` — but it is used for exactly one thing, the
publish toggle (`InventoryList.tsx` ~1066).

**Fix.** Reuse the existing add-vehicle form as an edit form: seed its state from
the selected vehicle, and on submit call `onUpdateVehicle(vehicle, patch)`
instead of `onAddVehicle`. No new endpoint, no new state shape.

Worth including in the same pass: **mileage, transmission and fuel** were added
to that form on 2026-07-26 and are the fields most likely to need correcting
later, because they are typed at the car rather than read off a disc scan.

---

## 5. Related: failed saves were silent

Fixed on TruLens in the same session, listed here because TruInspect still has
it.

`handleSaveProcessedImage` in `App.tsx` cleared the pending shot **before** the
upload and, on failure, set a status flag and nothing else. A failed save looked
identical to a successful one — the shot vanished from the screen either way.
This is how four consecutive 360 walkaround exports appeared to succeed while
the video never left the phone.

A 360 clip is ~20MB against ~60KB for a still, and a desktop webcam can ignore
the 4 Mbps bitrate hint and record far larger, so the walkaround is the shot most
likely to hit a size ceiling and the least likely to be noticed when it does.

TruLens now surfaces the reason, including the clip size when it looks like a
limit, and states that the shot was **not** kept.

---

## Checklist

| # | Issue | File | Lens | Inspect |
|---|---|---|---|---|
| 1 | Chips crush — add `shrink-0` | `CameraGuide.tsx` ~1094 | | |
| 2 | Viewfinder floor — `min-h-[46svh]` | `CameraGuide.tsx` / `index.css` | | |
| 3 | Remove guide overlay | `CameraGuide.tsx` ~595 | | |
| 4 | Edit a vehicle after creation | `InventoryList.tsx`, `App.tsx` | | |
| 5 | Surface failed saves | `App.tsx` | done | |

---

## 6. Fallback if the 360 video cannot be made reliable: spin from photos

Decision taken 2026-07-26. If the walkaround video is still not landing, drop it
and build the spin from the exterior stills instead. This is the better
engineering answer regardless, and the pieces already exist.

**Why photos win.** A 30-second clip is ~20MB base64 against ~60KB for a still,
and a desktop webcam can ignore the 4 Mbps hint and record far larger — so the
video is the one payload that hits ceilings, times out, and fails silently.
Stills have never failed once in testing: they went 2 → 5 → 7 across three
exports on the same vehicle while the video never arrived at all.

**What already exists.**

- `case-sites/true-cars/assets/js/web3d-mock.js` — a working orbit viewer:
  *"orbit frames · drag scrub · play · damage tags by azimuth. Uses mock frames
  (SVG turntable) or gallery photos when present."* Proven on True Cars.
- `case-sites/cars-at-caledon/coc-media.js` already reads `car.spin`,
  `car.spinImages`, `car.images360`, `car.spin360` and `car.threeSixty` — the
  consuming side needs no work at all.
- TruLens already exposes `GET /api/public/web3d/:stockNumber`.

**What to build.** Publish the exterior stills as an ordered array on the feed
(`spinImages`), so `coc-media.js` can scrub them. The capture side already
guides the shooter around the car in order, which is exactly the frame sequence
an orbit viewer wants — the shot list *is* the turntable.

**What this removes.** The 30-second recording cap, the 50MB body limit, the
silent-failure class this whole investigation was chasing, and roughly 20MB per
vehicle out of `data.json`.

Keep `walkaroundVideo` on the feed as an optional field — it costs nothing, and
a dealer who does manage to shoot a good clip should still be able to publish
one.
