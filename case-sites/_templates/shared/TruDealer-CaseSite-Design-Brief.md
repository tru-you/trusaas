# TruDealer Case-Site — Design Brief & Handoff

**Owner:** Paul de Beer · **For:** Design/Front-End · **Date:** 18 Aug 2026 · **Status:** v1 (fold MKR in on connect)

> **How to use this doc.** This is the spec design builds against — not a mood board. Every tier below has a fixed token system, a component contract, and a definition of done. If a decision isn't written here, default to **Cars on Caledon** (our proven bar) and flag it. Ship nothing that a dealer couldn't put live in front of a real buyer tomorrow.

---

## 0. The one-line goal

Three dealer web templates that (a) **beat the generic vendor sites** our prospects currently run, and (b) **each read as bespoke**, not as one skin recolored three times. Config-driven so a real dealer goes live in a 10-line edit, but art-directed so nobody can tell it's a template.

---

## 1. Reference teardown — what to take, what to reject

Ranked by how much we steal from each.

**⓪ TruCars Flagship — `case-sites/tru-cars-flagship-deploy` / true-cars.co.za (our own north star.)**
This is the real premium bar and the source of truth. Multi-page product: inventory, vehicle detail, VIR report, finance, trade-in, RTO360, EV, performance, certified-used, portal. Design tokens live in **`/assets/css/showroom.css`** — Premium tier must align to it, not invent a parallel system. Brand line: **"See it, spec it, settle it."** Stats band: floor count · inspected & scored · 360° walkarounds · same-day finance. Module suite already built: `tru-afford`, `tru-book`, `tru-concierge`, `tru-form`, `tru-repay`, `tru-share`, `truchat`, `tru-loader`. **Rule: Premium reuses these modules and this CSS — design skins the flagship, it does not rebuild it.**

**① Cars on Caledon — carsoncaledon.co.za (our bar. Take the most.)**
Take: WhatsApp-first conversion (every card → pre-filled WA message), VIR + 360 trust badges, TruPrice delta ("R20 000 below TruPrice"), shortlist drawer, warm human copy ("The floor is open. The kettle is on."), workshop trade-in booking with real slots, "10 photographs minimum" trust promise. This is the conversion engine — **do not regress any of it.**
Reject: nothing structural. Lift the polish, not the exact palette.

**② Fratelli X — fratelli-x.com (premium art-direction: the calm.)**
Take: boutique, service-led positioning — *more than just the drive*. Sales is one of five services (Sales, Storage, Servicing, Detailing/PPF, Sale-or-Return). Editorial dark luxury, restrained type, founder voice ("I look forward to welcoming you personally — Geoff Baughan"), credibility flex (BTCC partnership, "1000+ cars over 15 years"). All-caps micro-nav. Consultation, not "enquiry."
Reject: sparse stock display — we have more inventory and need it shoppable. Keep the calm, add the grid.

**②b GKirby Collection — gkirby.com (premium: the trust mechanics.)**
Take: supercar credibility done via *people, not polish* — named salespeople the reviews thank by name ("ask for Jez / Grant"), enthusiast-founder story ("by enthusiasts, for enthusiasts, 35 years combined"), a 5.0/50-review wall with each review tagged to the exact car bought (Lamborghini Urus, Aston Vantage F1), big **photo-count chips** per card (24, 31, 33 shots), WhatsApp support called out explicitly, all-caps prestige type. Featured-collection carousel over a static grid.
Reject: infinite-repeat carousel padding and Autotrader dependence — our stock is native.

**③ / ④ Broadfield & FS Performance (the floor we beat.)**
These are the **same template vendor** — identical boilerplate copy, identical search widget. This is what our prospect currently pays for. Take the *feature completeness* only: registration-plate instant valuation, monthly-budget search, AA Cars/warranty/servicing trust marks, compliant APR line ("Representative 8.9% APR. We are a credit broker not a lender."), Instagram social proof (FS has 16.4K followers front-and-centre). **Reject the design entirely** — flat, generic, no motion, no art direction. If our template looks like these, we've failed.

**③b TrueCar — truecar.com (the affordability-UX reference, marketplace not dealer.)**
Take: the **shop-by-budget entry** done properly — down-payment + monthly-payment + **credit-score band (Excellent 800+ … Poor 300-579) → "See your matches."** Value-prop-led hero ("save time and money · 10% or more"), New/Used/Hybrid segmentation, shop-by-brand-or-type icon rail, ZIP localization, rankings/reviews/comparisons resources. This is exactly what **TruAfford** should feel like — buyer states affordability, we return matched stock.
Reject: the marketplace model itself — we're single-dealer. Steal the affordability funnel, not the aggregator UX. (Note: `truecars.com`/`trucars.com` are dead; the real one is `truecar.com`, singular.)

**⑤ MKR (pending — connect `case-sites\MKR`.)**
Slot reserved. Expect a real SA skin; fold its art direction + any tier signals into §4 once available.

**The synthesis:** competitor *feature parity* (reg valuation, budget search, APR compliance, services, social) + Caledon *conversion mechanics* + Fratelli *art direction and calm*. That trifecta is the brief.

---

## 2. Non-negotiable principles (all tiers)

1. **Config is king.** Identity (name, contact, colour tokens, hours, modules) lives in one `SITE_CONFIG` object. Never hard-code dealer specifics in markup. Design must survive a name + palette swap without breaking.
2. **WhatsApp is the primary CTA** in SA-market skins. Every vehicle, every dead-end, routes to a pre-filled WA thread. Phone/email secondary.
3. **Trust is shown, not claimed.** VIR score, TruPrice delta, 360/photo count, condition report — visible on the card, not buried.
4. **Mobile is the design surface, not the afterthought.** 70%+ of SA dealer traffic is mobile. Design the card and the sticky action bar mobile-first, then scale up.
5. **Compliance is a component, not an add-on.** APR representative line + "credit broker not a lender" ship on every finance surface. VAT + E&OE on every price context.
6. **Motion earns its place.** Every animation either signals state, guides the eye, or rewards intent. No decoration-only motion. `prefers-reduced-motion` fully honored.
7. **Performance budget: LCP < 2.5s on 4G, CLS < 0.1.** Hero and above-the-fold cars are the LCP — no layout shift from lazy images (reserve aspect-ratio boxes).

---

## 3. Shared design tokens (the system)

One token spine; tiers differ by **palette, type pairing, and motion budget** — not by re-inventing structure.

**Spacing scale (8px base):** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96
**Radii:** sm 12 · md 18 · lg 26 · pill 100
**Elevation:** use layered soft shadows, never a single hard drop. Card rest `0 12px 32px -16px rgba(ink,.10)`; card hover `0 40px 80px -32px rgba(ink,.5)`.
**Motion:** ease-smooth `cubic-bezier(.22,1,.36,1)`, ease-spring `cubic-bezier(.34,1.56,.64,1)`. Durations: micro 150–250ms, card/hover 350–500ms, section reveal 600–800ms.
**Grid:** 12-col, max-width 1280, gutter 24–32. Card grid: `repeat(auto-fill, minmax(300px, 1fr))`.

**Type:** every tier uses a **display/serif or character face for headings** + a **clean grotesk for UI/body**. Fluid scale with `clamp()`:
`--h1: clamp(34px, 6vw, 76px)` · `--h2: clamp(28px, 4vw, 46px)` · `--body: 16–17px` · `--eyebrow: 12px / .2em tracked / uppercase`.

**Colour contract:** each palette must define `--primary --accent --ink --paper` and pass **WCAG AA (4.5:1)** for body text on paper and on primary. Provide a **verified dark surface** for premium.

---

## 4. Per-tier art direction

Tiers map to our packages: **Entry = Starter/Small Floor · Mid = Premium/Full Floor · Premium = Enterprise/Dealer Group.**

### 4.1 ENTRY — "Fast, honest, gets you driving"
- **Who:** 5–20 units, value floor. Demo skin: *Reef City Motors, Boksburg.*
- **Bar to beat:** Broadfield / FS Performance. We must look 3× more trustworthy at the same price point.
- **Palette:** confident single-accent (demo: forest green `#0F5C3F` / `#2FA36B`), light paper, high contrast. One accent, used decisively.
- **Type:** friendly grotesk throughout, one weight step for headings. No serif — keep it plain-spoken.
- **Feel:** clean, bright, fast. Big price, big "Drive away today," big WhatsApp. Zero luxury pretension.
- **Must-have sections:** hero + inline search (make/body/max-price/sort) · body-type quick tiles · stock grid · finance calculator with **APR compliance line** · trade-in (reg-plate quick valuation) · why-us trust row · visit/contact with map + hours · sticky mobile action bar.
- **Motion budget: LOW.** Reveal-on-scroll, card hover lift, that's it. Speed reads as honesty here.
- **Don't:** dark mode, splash screens, 3D. Overproduction reads as "hiding something" at this tier.

### 4.2 MID — "The established floor you can trust"
- **Who:** 20–80 units, full DMS, social publishing. Demo skin: *Cape Auto Collection, Bellville.*
- **Bar to beat:** Cars on Caledon *is* this tier. Match its conversion, raise its finish.
- **Palette:** ink navy `#0A1626` + electric blue `#0B5BD7` + a **gold accent** `#C8A24B` for premium cues, bone paper. Gold used sparingly — badges, dividers, the one hero flourish.
- **Type:** serif display (Fraunces/Playfair energy) for headlines + grotesk (Archivo/Inter) body. This pairing is the "we've arrived" signal.
- **Feel:** confident, warm, credible. Editorial section intros ("Three ways in.", "Come see us in person."). Testimonials with real names + vehicle. TruPrice deltas prominent.
- **Must-have sections:** everything in Entry **plus** 3D-tilt vehicle cards, nationwide delivery, social wall / publishing proof, richer trade-in (workshop slot booking à la Caledon), finance with multi-bank logos (WesBank/MFC/Absa/Standard Bank/Capitec), "Load more" pagination.
- **Motion budget: MEDIUM.** Cursor-reactive card tilt (±5° clamped), staggered reveals, animated finance calculator, hover sheen on media.
- **Don't:** go full dark. Keep it bright and human — this tier sells on *warmth + credibility*, not exclusivity.

### 4.3 PREMIUM — "The art of the approved drive"
- **Who:** Enterprise / dealer group / prestige. White-label. Demo skin: *Atlantic Prestige, V&A Waterfront.*
- **Bar to beat:** our own **TruCars Flagship** (align to `/assets/css/showroom.css` + reuse the `tru-*` modules) — then match Fratelli's boutique *calm* and GKirby's *named-human trust* (photo-count chips, review-wall tagged to each car, "ask for [name]"). Exceed all three on shoppability.
- **Palette:** deep near-black ink `#0A1420`, electric blue `#1466E0` + teal `#15C7C0` gradient accents, gold `#C9A24B` for restraint, bone `#F4F8FC` for light breaks. **Dark-luxury default.**
- **Type:** high-contrast serif display + precise grotesk. Generous negative space. All-caps tracked micro-labels (Fratelli move).
- **Feel:** editorial, concierge, calm. Sales is one of several services (Sales · 360 Showroom · Finance · Trade/Sale-or-Return · Delivery/Concierge). Founder/credibility moment. Session-gated splash (respect reduced-motion + once-per-session). Liquid Glass 2.0 surfaces, gradient-hairline borders, sheen-sweep on card media.
- **Must-have sections:** cinematic hero · stats band · services grid (Fratelli-style, 4–6 cards) · how-it-works · showroom with **orbit360** on by default · live-market pricing / TruPrice explainer · finance ("financing made effortless") · trade-in ("your car has value") · testimonials · concierge visit/about with founder line · white-label-ready footer.
- **Motion budget: HIGH (but disciplined).** Splash, scroll-choreography, orbit360, glass refraction, hover sheen, spring CTAs. Everything gated behind `prefers-reduced-motion`. Never janky — 60fps or cut it.
- **Don't:** clutter. Premium is what you *remove*. If a section doesn't raise perceived value, kill it.

---

## 5. Component contract (spec, all tiers scale the same parts)

**Vehicle card (the atom — get this right first):**
- Media (16:9, reserved aspect box, lazy) · VIR badge (frosted pill, colour-coded by score band) · body-type tag · 360/photo-count chip · "Just arrived / Price reduced / X below TruPrice" status ribbon.
- Title (make model) · variant · year · meta row (mileage · transmission · fuel) · price (large) + monthly-from + TruPrice delta (▲/▼).
- Actions: **WhatsApp (pre-filled)** + View detail/VIR + Save-to-shortlist (♥).
- States: rest / hover (lift + media zoom + sheen + gradient border) / saved / sold overlay. Reduced-motion strips transform/zoom.

**Hero:** eyebrow · display headline (dealer-first-word emphasis) · sub · dual CTA (Browse / Sell-Trade) · inline search card. Open-status chip ("Open now · 15 on the floor").
**Search:** make · body · max-price · sort. Mid/Premium add monthly-budget mode + reg-plate valuation entry.
**Finance calculator:** principal → monthly (r/12 amortization), rate + term controls, balloon toggle (Mid/Premium), **compliance line always visible.**
**Trade-in:** reg-plate/vehicle quick entry → route to WhatsApp or workshop-slot booker (Mid/Premium). "From a person, not a formula" framing.
**Shortlist drawer:** ♥ accumulates → one-tap WhatsApp the whole list.
**Nav + sticky mobile bar:** glass nav on scroll; mobile bottom bar = Call · WhatsApp · Stock.
**Footer:** showroom links · services · contact · social · VAT/E&OE · "Powered by TruDealer."
**Chat (TruChat, when enabled):** frosted launcher, dealer-named ("Chat with Caledon").

---

## 6. Feature / UX parity checklist (must-have or we lose to the vendor)

- [ ] Registration-plate / vehicle instant valuation (trade-in entry)
- [ ] Monthly-budget search mode (not just full-price)
- [ ] Affordability funnel (TruAfford): down-payment + monthly-payment + **credit-score band → matched stock** (TrueCar pattern)
- [ ] Representative APR line + "credit broker not a lender" on every finance surface
- [ ] Warranty / servicing / after-sale trust marks
- [ ] Social proof block (reviews + Instagram follower flex where strong)
- [ ] Multi-bank finance logos
- [ ] "Drive away today" / availability urgency
- [ ] VAT-inclusive pricing + E&OE
- [ ] Services beyond sales (Premium: storage/detailing/PPF/sale-or-return)

---

## 7. Imagery & art direction (our current weak spot — fix first)

Placeholder stock photos are the single biggest tell. Direction:
- **Real vehicle photography** — minimum 10 shots/car (Caledon promise), consistent framing, neutral or branded backdrop, same focal length. No mismatched web stock.
- **360 / orbit** is the premium differentiator — lead the Premium showroom with it, offer on Mid.
- **Hero:** one strong environmental or studio shot per tier, not a carousel of stock. Entry can go bright/lifestyle; Premium goes dark/editorial/detail-macro.
- **Iconography:** one consistent set per tier (line icons Entry/Mid, fine-weight Premium). No emoji in production.
- Until real capture exists, use TruLens/360 assets — never generic Unsplash in a client build.

---

## 8. Accessibility & performance guardrails (definition-of-done gates)

- WCAG AA contrast on all text; visible focus rings; full keyboard nav; `prefers-reduced-motion` honored everywhere.
- Semantic landmarks (header/nav/main/footer), alt text on every vehicle image, form labels.
- LCP < 2.5s / CLS < 0.1 / INP < 200ms on mid-range Android over 4G.
- No browser-storage dependency for core render. Lazy-load below-fold; reserve image boxes to kill CLS.

---

## 9. Handoff logistics

- **Files:** `case-sites/_templates/{entry,mid,premium}/index.html` + per-tier `stock.js`. Shared demo data lives per-folder now (not `shared/mock-stock.js`).
- **Tokens live in `SITE_CONFIG`** (identity + `colors` + `modules`). Design changes to palette = edit tokens, not CSS.
- **Modules** (`truchat`, `truvalue`, `truafford`, `orbit360`) are feature flags — design must handle both on and off states gracefully.
- Deliver design as: updated `index.html` per tier + a short changelog of what moved. Keep diffs surgical — modernize, don't re-architect.

## 10. Definition of done (per tier)

A tier ships when: it beats the vendor floor on first glance · every §5 component is present and responsive · §6 parity checklist is fully ticked · §8 gates pass · a real dealer's identity drops in via `SITE_CONFIG` with zero markup edits · and it looks bespoke, not skinned.

---

### Appendix — reference set
- **TruCars Flagship (north star):** `case-sites/tru-cars-flagship-deploy` · true-cars.co.za — tokens in `/assets/css/showroom.css`, modules `tru-*`, line "See it, spec it, settle it."
- **Cars on Caledon (conversion bar):** carsoncaledon.co.za
- **Fratelli X (premium — calm):** fratelli-x.com
- **GKirby Collection (premium — trust mechanics):** gkirby.com
- **TrueCar (affordability-UX / marketplace):** truecar.com — shop-by-budget + credit-score matching for TruAfford.
- **Broadfield / FS Performance (the generic floor we beat, same vendor):** broadfieldmotorsales.co.uk · fsperformance.co.uk
- **trucars.com / truecars.com** — dead domains, excluded (real one is truecar.com, singular).
- **MKR** — folder `case-sites\MKR` still not connected; fold its art direction into §1/§4 on connect.
