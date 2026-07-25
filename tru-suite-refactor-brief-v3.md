# Tru Suite — Colour System Migration + Claims Integrity Sweep
**Handoff brief for Claude Code — v3**
Repo root: `TruSaaS/`

---

# ⛔ HARD STOP — READ FIRST

**Do not push. Do not merge. Do not deploy. Do not touch Render.**

Work on a **local branch only**: `feat/tru-token-system`

Commit locally in the staged sequence below, then **stop and report**. The owner reviews before anything leaves the machine.

Forbidden without explicit go-ahead:
- `git push`
- Opening a PR or merging to `main`
- Any Render action — deploy, env change, service config
- Deleting any file (rename and flag instead)
- Renaming anything in a database, env var, or public route without approval

Allowed: local branch, local commits, local dev server, screenshots, reports.

If a step seems to require deployment to verify — **stop and say so.** Don't improvise.

---

## STEP 0 — NAMING VERIFICATION (do this before any code)

The canonical product name is **TruFlow**. On-disk naming has drifted and must be audited, not assumed.

```bash
# What is it actually called on disk?
find . -iname "*flow*" -not -path "*/node_modules/*" | head -50
grep -rn "Flow" apps/ packages/ --include="*.tsx" --include="*.json" \
  --include="*.ts" -l | head -30
```

Produce a **rename manifest** before changing anything:

| Current | Location type | Proposed | Risk |
|---|---|---|---|
| e.g. `Flow` | UI display string | `TruFlow` | none |
| e.g. `flow` | route `/flow/*` | `truflow` | **breaks links** |
| e.g. `FLOW_API_KEY` | env var | — | **do not change** |

**Rules:**
- **Display strings, component names, CSS classes:** rename freely to TruFlow
- **Routes, DB values, env vars, API contracts, external integrations:** flag only. Do **not** rename. These need a migration plan and a redirect strategy
- Same audit for `Trueafford` → `TruAfford`, and any `True*` in user-facing copy

Report the manifest and wait for approval on anything marked risky.

---

## APP REGISTRY (canonical)

| Product | `data-app` | Tier | Purpose |
|---|---|---|---|
| TruLens | `trulens` | Field · **Capture** | Dealer merchandising photography. Feeds TruFlow. **Colour-critical** |
| TruInspect | `truinspect` | Field · Assessment | VIR generation only |
| TruView | `truview` | **Live** | Buyer-side live video vehicle viewing, dealer-guided |
| TruTrade | `trutrade` | **Live** | Seller-side live video appraisal → trade-in / buyout offer |
| TruAfford | `truafford` | Consumer · **widget** | Affordability estimate, embedded in 3rd-party dealer sites |
| TruFlow | `truflow` | Workstation | Dealer desktop. Base tier |
| TruFlow Premium | `truflow` + `data-tier="premium"` | Workstation | Feature tier of TruFlow — **same app** |
| TruCRM | `trucrm` | Workstation | Dealer desktop |

**Naming law:** `Tru` prefix, no space, never "True".

**OUT OF SCOPE — do not touch:** Tru-Cars demo site, TruSaaS marketing site.

**Chat:** excluded from rollout (per-client design), but must import the token layer as its base so client themes are L2 overrides, never a fork.

**Four tiers, four colour problems:**
- **Field** — sunlight legibility. TruLens additionally colour-critical (photography)
- **Live** — real-time video drives a money decision. Neutral around the stream, dark UI
- **Workstation** — long desk sessions, dark, information density
- **Consumer** — embedded in a third party's page, light-first, style-isolated

---

# PART 1 — COLOUR SYSTEM

## 1.1 Governing rule

> Cyan is never a background for text. Cyan is never body copy. Cyan appears only where the eye should go next.

Ink and paper carry ~95% of every interface. Cyan carries ~5%.

**Field-Capture and Live tiers have a second, stricter rule — §1.3 and §1.4.**

## 1.2 Single source of truth

Create `packages/tokens/tru-tokens.css` at repo root. Import **first** in every app entry point. The only file in the monorepo permitted to contain a raw hex value.

```css
/* ==========================================================
   TRU DESIGN TOKENS — single source of truth
   L1 primitives → L2 semantic → components consume L2 only.
   NEVER reference an L1 primitive from a component.
   NEVER write a raw hex outside this file.
   ========================================================== */

:root {
  /* ---------- L1 · PRIMITIVES ---------- */
  --tru-ink-900: #06080D;
  --tru-ink-800: #0D1117;
  --tru-ink-700: #161B22;
  --tru-ink-600: #21262D;
  --tru-ink-500: #30363D;
  --tru-ink-300: #6E7681;
  --tru-ink-100: #B1BAC4;
  --tru-paper:      #E8EAE6;
  --tru-paper-pure: #FFFFFF;

  --tru-cyan-400: #22D3EE;   /* accent — dark surfaces only */
  --tru-cyan-500: #06B6D4;   /* accent — light surfaces only */
  --tru-cyan-600: #0891B2;   /* hover / pressed */

  --tru-amber-500: #F59E0B;  /* attention / retake — NOT error */
  --tru-red-500:   #EF4444;  /* system error · LIVE recording */
  --tru-green-500: #10B981;  /* connected; otherwise sparing */

  /* ---------- L2 · SEMANTIC (components use these) ---------- */
  --bg-base:       var(--tru-ink-900);
  --bg-raised:     var(--tru-ink-800);
  --bg-overlay:    var(--tru-ink-700);
  --bg-inset:      var(--tru-ink-600);
  --border-subtle: var(--tru-ink-500);
  --border-strong: var(--tru-ink-300);

  --text-primary:   var(--tru-paper);
  --text-secondary: var(--tru-ink-100);
  --text-muted:     var(--tru-ink-300);
  --text-on-accent: var(--tru-ink-900);

  --accent:         var(--tru-cyan-400);
  --accent-hover:   var(--tru-cyan-600);
  --accent-surface: rgba(34, 211, 238, 0.10);
  --accent-border:  rgba(34, 211, 238, 0.35);
  --focus-ring:     var(--tru-cyan-400);

  --state-attention: var(--tru-amber-500);
  --state-error:     var(--tru-red-500);
  --state-success:   var(--tru-green-500);

  --glass-bg:     rgba(255, 255, 255, 0.04);
  --glass-border: rgba(255, 255, 255, 0.08);
  --glass-blur:   blur(20px) saturate(140%);
}

/* ==========================================================
   TIER OVERRIDES
   Set data-app on <html> or the app shell root. One line per app.
   Nothing works without this attribute.
   ========================================================== */

/* ---------- FIELD · CAPTURE (colour-critical) ----------
   TruLens — dealer merchandising photography.
   Neutral viewing environment is a hard product requirement. §1.3 */
[data-app="trulens"] {
  color-scheme: dark;
  --bg-base:        #000000;
  --bg-raised:      #0A0A0A;
  --bg-overlay:     #141414;
  --text-primary:   #FFFFFF;
  --text-secondary: #C9D1D9;
  --accent:         #2DE1F5;
  --accent-hover:   #14C4D8;
  --focus-ring:     #2DE1F5;

  --photo-surround: #1A1A1A;   /* zero-saturation grey */
  --photo-void:     #000000;
  --photo-proof:    #FFFFFF;   /* white-background proofing mode */
}

/* ---------- FIELD · ASSESSMENT ----------
   TruInspect — VIR generation. Outdoor, high contrast.
   No colour-accuracy constraint; accent used freely for state. */
[data-app="truinspect"] {
  color-scheme: dark;
  --bg-base:        #000000;
  --bg-raised:      #0A0A0A;
  --bg-overlay:     #141414;
  --text-primary:   #FFFFFF;
  --text-secondary: #C9D1D9;
  --accent:         #2DE1F5;
  --accent-hover:   #14C4D8;
  --focus-ring:     #2DE1F5;
}

/* ---------- LIVE TIER ----------
   TruView (buyer viewing) · TruTrade (seller appraisal).
   Real-time video of a vehicle drives a money decision.
   Dark UI, zero saturation around the stream. §1.4 */
[data-app="truview"],
[data-app="trutrade"] {
  color-scheme: dark;
  --bg-base:        #0A0A0A;
  --bg-raised:      #141414;
  --bg-overlay:     #1F1F1F;
  --border-subtle:  #2A2A2A;
  --text-primary:   #FFFFFF;
  --text-secondary: #C9D1D9;
  --text-muted:     var(--tru-ink-300);
  --accent:         var(--tru-cyan-400);
  --accent-hover:   var(--tru-cyan-600);
  --focus-ring:     var(--tru-cyan-400);

  --video-surround: #1A1A1A;   /* zero-saturation grey */
  --video-void:     #000000;   /* fullscreen stream */

  --state-live:      var(--tru-red-500);    /* recording — NEVER cyan */
  --state-waiting:   var(--tru-amber-500);
  --state-connected: var(--tru-green-500);
  --state-degraded:  var(--tru-amber-500);
}

/* ---------- WORKSTATION TIER ----------
   TruFlow (+ Premium tier), TruCRM. Inherits :root. */
[data-app="truflow"],
[data-app="trucrm"] {
  color-scheme: dark;
}

/* ---------- CONSUMER TIER ----------
   TruAfford only — form widget inside a 3rd-party dealer page.
   LIGHT is default. §1.5 */
[data-app="truafford"] {
  color-scheme: light;
  --bg-base:       var(--tru-paper-pure);
  --bg-raised:     #F6F7F5;
  --bg-overlay:    #EDEFEC;
  --bg-inset:      #E4E7E2;
  --border-subtle: #D4D8D2;
  --border-strong: #A8AFA6;

  --text-primary:   var(--tru-ink-900);
  --text-secondary: var(--tru-ink-700);
  --text-muted:     var(--tru-ink-300);
  --text-on-accent: var(--tru-paper-pure);

  --accent:         var(--tru-cyan-500);
  --accent-hover:   var(--tru-cyan-600);
  --accent-surface: rgba(6, 182, 212, 0.08);
  --accent-border:  rgba(6, 182, 212, 0.30);
  --focus-ring:     var(--tru-cyan-500);

  --glass-bg:     rgba(255, 255, 255, 0.65);
  --glass-border: rgba(0, 0, 0, 0.06);
}

/* TruAfford on a dark dealer host site */
[data-app="truafford"][data-theme="dark"] {
  color-scheme: dark;
  --bg-base:       var(--tru-ink-900);
  --bg-raised:     var(--tru-ink-800);
  --bg-overlay:    var(--tru-ink-700);
  --border-subtle: var(--tru-ink-500);
  --text-primary:   var(--tru-paper);
  --text-secondary: var(--tru-ink-100);
  --text-on-accent: var(--tru-ink-900);
  --accent:        var(--tru-cyan-400);
  --focus-ring:    var(--tru-cyan-400);
  --glass-bg:     rgba(255, 255, 255, 0.04);
  --glass-border: rgba(255, 255, 255, 0.08);
}

/* ---------- CHAT ----------
   Per-client theming. Client overrides L2 semantic tokens ONLY,
   injected at runtime. Never override L1. Never fork this file. */
[data-app="chat"] { }
```

## 1.3 TruLens — photography colour neutrality (hard requirement)

TruLens is a camera. Its UI cannot introduce a colour cast anywhere near an image.

A photographer reviewing a shot with cyan chrome in peripheral vision adapts to it and misjudges white balance and exposure. The result is a listing set with a subtle cast — instantly visible when those images appear on a white background, and blamed on the product, not the shooter.

```css
[data-app="trulens"] .capture-preview,
[data-app="trulens"] .photo-review,
[data-app="trulens"] .panel-thumb {
  background: var(--photo-surround);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
[data-app="trulens"] .photo-review :where(*) { --accent: transparent; }
[data-app="trulens"] .photo-review--fullscreen { background: var(--photo-void); }
```

**Rules:**
- No glass, blur, or `saturate()` adjacent to or over an image preview
- No cyan inside the image frame or immediate surround — controls sit **outside** the sterile zone
- Chrome around a photo is zero-saturation grey only
- Never tint a thumbnail container
- State indicators live on the panel list/grid, never overlaid on the image

**Ship the proofing toggle.** Review screen gets black / mid-grey / white switching via `--photo-void` / `--photo-surround` / `--photo-proof`. The shooter must be able to proof on the surface the buyer will actually see.

## 1.4 Live tier — video colour neutrality + session state

Same neutrality principle as TruLens, different reason: the **buyer** is judging paint, panel gaps, and interior wear off a live stream. A tinted UI around that stream distorts the judgement, and the dispute lands on you.

```css
[data-app="truview"] .stream-surface,
[data-app="trutrade"] .stream-surface {
  background: var(--video-surround);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
[data-app="truview"] .stream-surface :where(*),
[data-app="trutrade"] .stream-surface :where(*) { --accent: transparent; }

[data-app="truview"] .stream-surface--fullscreen,
[data-app="trutrade"] .stream-surface--fullscreen { background: var(--video-void); }
```

**Rules:**
- Dark UI, always. A white frame around video blows out perceived contrast and buries shadow detail — which is exactly where damage hides on a used car
- Zero-saturation grey immediately around the stream
- No glass panels overlapping the video. Controls sit outside the frame, or on a solid neutral scrim
- Cyan is banned inside the stream surface

### Session state colours

| State | Token | Treatment |
|---|---|---|
| **LIVE / recording** | `--state-live` (red) | Persistent, prominent, unmissable. **Never cyan.** Red is the universal recording signal |
| Connecting / waiting | `--state-waiting` (amber) | |
| Connected, not recording | `--state-connected` (green) | Subtle |
| Connection degraded | `--state-degraded` (amber) | Banner — see below |
| Ended | `--text-muted` | Neutral |

**Recording consent:** if a TruTrade appraisal or TruView session is recorded, the participant must know before it starts and the indicator must persist throughout. POPIA requirement, not a UI preference. Flag to owner if consent capture is missing from the flow — do not build it unprompted.

**Low-bandwidth state — build this.** Eastern Cape buyer on a weak connection is the real user. When stream quality drops, say so:

> "Connection quality reduced — request a still photo for detail."

`--state-degraded` banner, outside the stream surface. A pixelated bumper reads as damage; a compressed panel *hides* damage. This single line prevents disputes in both directions and is the cheapest liability control in the suite.

## 1.5 TruAfford widget — style isolation (critical)

The only app living inside someone else's HTML. Without isolation, host CSS bleeds in and yours bleeds out — a support ticket you cannot debug remotely.

**Preferred — Shadow DOM:**
```js
const host = document.querySelector('#truafford-widget');
const shadow = host.attachShadow({ mode: 'open' });
// inject tru-tokens.css + widget styles into the shadow root
```
Custom properties inherit **through** shadow boundaries — re-declare all tokens inside the shadow root defensively.

**Fallback — namespaced tokens + reset:**
```css
.truafford-root {
  all: initial;
  --taf-bg-base:      #FFFFFF;
  --taf-text-primary: #06080D;
  font-family: system-ui, sans-serif;
}
.truafford-root *, .truafford-root *::before, .truafford-root *::after {
  box-sizing: border-box;
}
```

Never style `html`, `body`, or `*` unscoped. Test in a light dealer site **and** a dark one.

## 1.6 TruFlow Premium gating

Premium is a feature tier of the same app: `data-app="truflow" data-tier="premium"`.

**Do not use cyan to mark premium or locked features.** Cyan means "you are here." Overloading it to mean "you can't have this" destroys the only signal you have.

Locked feature treatment: lock icon + `--text-muted` + reduced opacity. Upgrade CTA uses `--accent` — because that *is* where the eye should go next.

## 1.7 Where cyan is allowed

| ✅ Allowed | ❌ Banned |
|---|---|
| Primary CTA fill (with `--text-on-accent` text) | Body copy |
| Active nav indicator / underline | Headings |
| Focus rings | Card / panel backgrounds |
| Data-viz primary series | Table row fills (tint ≤10% only) |
| Progress + capture-state rings | Any surface behind a paragraph |
| Icon accent on **active** state only | Placeholder text |
| Selected-row tint via `--accent-surface` | Headers, sidebars, footers as block fill |
| Upgrade CTA (TruFlow) | Locked/premium feature marking |
| — | **TruLens image sterile zones** |
| — | **Live tier stream surfaces** |
| — | **LIVE / recording indicator** |

## 1.8 Contrast floors — non-negotiable

- Body text ≥ **7:1** · Secondary ≥ **4.5:1** · Interactive borders ≥ **3:1**
- Known-good: `#E8EAE6` on `#06080D` = 16.8:1 · `#22D3EE` on `#06080D` = 10.2:1
- **Known-bad — the reported bug:** `#22D3EE` on `#FFFFFF` = **1.9:1**

Any cyan text on a light surface is a defect. Highest risk in TruAfford. Fix with `--tru-cyan-500` or darker, restricted to large text and icons. Never cyan body copy on light.

## 1.9 Glass layer rewrite

Glass currently tints cyan. It must tint **neutral**. Cyan appears only on active border or an inner CTA.

```css
.glass {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
}
.glass--active,
.glass:focus-within { border-color: var(--accent-border); }
```

Delete every `background: rgba(34,211,238, …)` on a container. **Glass is banned entirely from TruLens image surfaces and Live tier stream surfaces.**

## 1.10 Field-tier capture states

TruLens panel capture and TruInspect assessment steps.

| State | Treatment |
|---|---|
| Not captured | `--border-subtle` outline, no fill |
| In progress | `--accent` ring, animated |
| Captured / passed | White check on `--bg-overlay`. **Neutral — success is quiet** |
| Failed / retake | `--state-attention` (amber). **Not red** — red reads as system fault; amber reads as "do it again" |
| System error | `--state-error` (red) — upload/connection failure only |

## 1.11 Migration procedure

**Step 1 — Inventory.** Present the table before mass-replacing:
```bash
grep -rEn "#[0-9a-fA-F]{3,8}\b|rgba?\(" apps/ packages/ \
  --include="*.css" --include="*.scss" --include="*.tsx" \
  --include="*.jsx" --include="*.ts" --include="*.html" \
  | grep -v "tru-tokens.css"
```
Output: file · line · value · proposed token.

**Step 2 — Map, don't guess.**
- Background → `--bg-base` / `--bg-raised` / `--bg-overlay`
- Text → `--text-primary` / `--text-secondary` / `--text-muted`
- Border → `--border-subtle` / `--border-strong`
- Cyan → check §1.7. **On a banned surface it becomes neutral, not a lighter cyan.**

**Step 3 — Wire `data-app`.** Every app shell root. One line each. Nothing works without it.

**Step 4 — Tailwind.** Utilities resolve to tokens; no palette values in config:
```js
theme: { extend: { colors: {
  base: 'var(--bg-base)', raised: 'var(--bg-raised)',
  overlay: 'var(--bg-overlay)', accent: 'var(--accent)',
  ink: 'var(--text-primary)', muted: 'var(--text-muted)',
}}}
```
Purge all `text-cyan-*`, `bg-cyan-*`, `border-cyan-*` from markup.

**Step 5 — Focus states.** No `outline: none` without a replacement:
```css
:where(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
```

**Step 6 — Lock it.** `.stylelintrc.json`, wired into the lint script (**not** a deploy gate yet):
```json
{
  "rules": {
    "color-no-hex": [true, { "ignoreFiles": ["**/tru-tokens.css"] }],
    "declaration-property-value-disallowed-list": {
      "/^(color|background|background-color|border-color)$/": ["/^#/", "/^rgb/"]
    }
  }
}
```

---

# PART 2 — CLAIMS INTEGRITY SWEEP

Apps don't carry marketing copy — they carry something with more exposure.

## 2.1 Surfaces to sweep

- **Generated PDF / report / offer templates** ← highest risk
- Onboarding + empty-state copy
- Tooltips, helper text, field descriptions
- Error and validation messages
- In-app upsell / feature-gate copy (TruFlow Premium)
- Transactional email templates
- Settings + permissions descriptions
- Runtime AI-generated summary text

## 2.2 What to remove

**A. Fabricated numbers** — %, multiples, counts, uptime figures without a source.

**B. Fake social proof** — invented testimonials, logo walls of non-clients, ratings.

**C. Invented credentials** — awards, ISO, SOC 2, "certified partner". The Autoxloo relationship is described exactly as the agreement permits: **Allied Partner**. Nothing inflated.

**D. Unverified compliance** — POPIA/GDPR: state design intent and actual data handling. Do **not** claim certification or audit without documentation. Delete "bank-grade", "military-grade", "SOC 2" unless documented.

**E. Unshipped features** — roadmap in present tense; dead integrations listed as live; overstated AI capability.

**F. Fabricated entities** — fake team, offices, addresses. Live placeholders (`hello@example.com`, `+27 XX XXX XXXX`). Demo data visibly marked `DEMO`.

**G. Naming drift** — every user-facing string reads `Tru`, never `True`. `TruAfford`, never `Trueafford`. `TruFlow`, never bare `Flow`.

## 2.3 Detection

```bash
# Numeric claims
grep -rEn "[0-9]+(\.[0-9]+)?\s*(%|x)\b|[0-9,]{3,}\+" apps/ packages/ \
  --include="*.tsx" --include="*.jsx" --include="*.html" --include="*.md" --include="*.json"

# Trust / proof language
grep -rniE "trusted by|used by|join [0-9]|testimonial|rating|award|certified|accredited|ISO |SOC 2|bank-grade|military-grade|industry.lead|#1|best.in.class|guarantee" apps/ packages/

# Compliance + consent
grep -rniE "POPIA|GDPR|compliant|compliance|audited|consent|record(ing|ed)|end.to.end encrypt|99\.9" apps/ packages/

# Placeholders
grep -rniE "lorem ipsum|example\.com|placeholder|TODO|FIXME|XXX XXX|coming soon" apps/ packages/

# Naming drift
grep -rn "True\|Trueafford" apps/ packages/ \
  --include="*.tsx" --include="*.html" --include="*.md" \
  | grep -v "=true\|: true\|isTrue\|true-cars.co.za"
```

## 2.4 Generated-document audit

**TruLens is excluded** — it produces images, not assertions. Only claims surface is EXIF/watermark text stamped on exports. Verify no stale branding or "certified" language is baked there.

### TruInspect — the VIR *is* the product
Lands with buyers, finance houses, and potentially in a dispute.
- No "certified" / "guaranteed" / "approved" / "warranty" unless contractually backed
- Condition grading scale **defined on the document**, not implied
- Describe what was **observed**. Never conclude mechanical condition not physically tested — especially anything AI-generated
- **Scope statement:** what the inspection covered and what it explicitly did **not**
- Inspector identity, timestamp, VIN on every page

### TruTrade — a video appraisal is not a physical inspection
The offer document carries the same weight as a VIR.
- **Offer validity period** stated on the document
- **Explicit condition:** offer subject to physical inspection. A video appraisal cannot detect mechanical faults, flood damage, or structural repair
- Statement of what the video assessment covered and what it could not
- No "guaranteed" price language
- Recording consent status referenced if the session was recorded

### TruAfford — NCA exposure. Non-negotiable.
Output must carry a clear, **prominent** statement that it is an estimate only: not a credit decision, not a quotation, not an offer of finance, and not an affordability assessment under the National Credit Act. Remove any language implying approval, pre-approval, or qualification.

Disclaimer goes in the output body — not buried in a footer. This is the sharpest legal edge in the suite.

## 2.5 Deliverable — claims register

`docs/claims-register.md`:

| Claim | Location(s) | Status | Evidence / Source | Action |
|---|---|---|---|---|

Status: `VERIFIED` · `NEEDS EVIDENCE` · `REMOVED` · `REWRITTEN`

Nothing is considered resolved unless `VERIFIED`. Hand `NEEDS EVIDENCE` rows back for a decision — do not guess, do not silently delete.

---

# PART 3 — VERIFY (LOCAL ONLY)

## 3.1 Checklist

- [ ] Rename manifest produced and approved (Step 0)
- [ ] `tru-tokens.css` imported first in all 8 app entry points
- [ ] `data-app` attribute set on every app shell root
- [ ] Zero raw hex outside the token file (grep clean)
- [ ] Stylelint passing locally
- [ ] No cyan text on any light surface, suite-wide
- [ ] Body text ≥ 7:1 on every screen, both themes
- [ ] Focus ring visible on every interactive element (keyboard-tab each app)
- [ ] Glass tints neutral; cyan only on active border / inner CTA
- [ ] **TruLens: zero saturation, zero blur in every image sterile zone**
- [ ] **TruLens: black / grey / white proofing toggle shipped**
- [ ] **Live tier: dark UI, neutral stream surround, no glass over video**
- [ ] **Live tier: LIVE indicator is red, persistent, unmissable**
- [ ] **Live tier: degraded-connection banner implemented**
- [ ] Capture states: neutral pass, amber retake, red for system errors only
- [ ] TruFlow Premium: locked features use lock + muted, never cyan
- [ ] TruAfford widget style-isolated; tested in light **and** dark host pages
- [ ] All strings `Tru`, never `True`
- [ ] `docs/claims-register.md` complete
- [ ] TruInspect VIR: scope statement + grading scale on document
- [ ] TruTrade offer: validity period + physical-inspection condition
- [ ] TruAfford: NCA disclaimer prominent in output body

## 3.2 Manual QA — local, real hardware

**Field apps in direct sunlight**, one-handed, mid-capture. If any label or state indicator is hard to read outdoors, the token values are wrong.

**Live tier on a throttled connection.** Chrome DevTools → Network → Slow 3G. Confirm the degraded banner fires and the stream surround stays neutral.

**Cross-tier image test — highest-value single check:**
```
Shoot a vehicle in TruLens → publish through TruFlow → view the same
images against a white background. Any colour cast, crop, or exposure
issue that only appears on white is a TruLens UI defect, not a
photographer error.
```

Also: 200% browser zoom, OS high-contrast mode, TruAfford embedded in a real dealer page (local copy).

## 3.3 Commit sequence — LOCAL ONLY

Branch: `feat/tru-token-system`. Separate, revertible commits:

```
1. chore(naming): rename manifest + safe display-string renames
2. feat(tokens): tru-tokens.css + data-app wiring
3. feat(tokens): field tier — TruLens sterile zones + proofing toggle
4. feat(tokens): field tier — TruInspect
5. feat(tokens): live tier — TruView, TruTrade + session states
6. feat(tokens): consumer tier — TruAfford + widget isolation
7. feat(tokens): workstation tier — TruFlow, TruCRM
8. refactor(styles): grep purge + glass rewrite
9. chore(lint): stylelint guard
10. content(claims): copy sweep + claims register
```

**Then stop.** Do not push. Do not open a PR. Do not deploy.

## 3.4 Report back for review

1. Rename manifest with risk flags
2. Colour inventory table with mappings applied
3. Before/after screenshots — TruLens capture + review, TruView live session, TruTrade offer screen, TruInspect VIR output, TruCRM dashboard, TruAfford widget embedded
4. Claims register with every `NEEDS EVIDENCE` row listed
5. Every ambiguous mapping decision made
6. Anything that could not be verified without deploying

Owner reviews. Deployment is a separate, explicit instruction.

---

## ORDER OF WORK

```
0.  Naming verification + rename manifest      ← report and wait
1.  tru-tokens.css + data-app across all 8 entry points
2.  TruLens — capture tier, sterile zones, proofing toggle
        ← client complaint origin, colour-critical
3.  TruInspect — assessment tier
4.  Live tier — TruView, TruTrade, session states, degraded banner
5.  TruAfford — consumer tier + widget isolation
6.  TruFlow, TruCRM — workstation tier + premium gating
7.  Grep purge + glass rewrite
8.  Stylelint guard
9.  Document audit — VIR, TruTrade offer, TruAfford NCA (§2.4)
        ← highest liability
10. In-app copy sweep + claims register
11. Local QA — sunlight, throttled network, cross-tier image test
12. STOP. Report. Await owner review before any push or deploy.
```
