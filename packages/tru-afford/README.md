# TruAfford — canonical widget

Soft affordability / pre-qual widget, embedded in third-party dealer sites.

`tru-afford.js` here is the **source of truth**. The copies under
`case-sites/*/` and `truweb/*/` are deploy artefacts. Fix here, then re-copy.

---

## Embed

```html
<script src="tru-afford.js"
        data-dealer="Cars on Caledon"
        data-wa="27618759389"
        data-accent="#e30613"></script>
```

## Attributes

| Attribute | Default | Purpose |
|---|---|---|
| `data-dealer` | `this dealership` | Name shown in the header, copy and WhatsApp message |
| `data-wa` | *(none)* | WhatsApp number, digits only. **No number = no send button action** |
| `data-accent` | `#4FE3DC` | Dealer brand colour. Everything else derives from it |
| `data-accent-2` | derived | Far end of the gradient sweep. Default: accent darkened 34% |
| `data-accent-3` | derived | Trust/confirm chips. Default: the accent |
| `data-rate` | `0.1175` | Illustrative interest rate, shown in the disclaimer |
| `data-position` | `right` | `right` or `left` |
| `data-bottom` | `88px` | Bottom offset — the default clears a WhatsApp FAB |
| `data-z` | `999990` | z-index |

### Theming

Set **`data-accent` only**. Shades, glows, focus rings, slider tracks,
result-card tints and the gradient are all derived from it in JS, so a dealer
recolour is an embed-tag edit — never a JS edit.

Two colours are deliberately **not** themeable:

- **WhatsApp green** on the send button. It is WhatsApp's brand, and it is the
  affordance that tells the customer where the button goes.
- **Amber** on a `Tight` affordability band. That is a state, not a brand — it
  must read the same on every dealer's site.

### Current dealer accents

| Dealer | Accent |
|---|---|
| TruSaaS default | `#4FE3DC` |
| Cars on Caledon | `#e30613` |
| Your Car Guy | `#e30613` |
| MKR Auto Sales | `#0B5BD7` |

---

## Isolation

The widget renders inside a **shadow root**. This is not optional polish.

An earlier version used `all:initial` on a light-DOM container, which does
**not** work: `all:initial` resets only that container, never its descendants,
so an ordinary dealer theme rule like

```css
button { background:#ff00ff !important; font-family:"Comic Sans MS" !important; }
```

wins over the widget's own styles. This was reproduced in `demo.html` — the
primary button rendered magenta in Comic Sans.

Inside a shadow root the host page cannot reach the widget at all. `all:initial`
on `:host` additionally blocks *inherited* properties — font, colour,
letter-spacing — which do still cross the shadow boundary.

**Consequence for the DOM:** nothing inside the widget is reachable via
`document.getElementById`. All lookups go through the `$` / `$$` helpers, which
are scoped to the shadow root. A stray `document.` query returns `null` silently.

`window.TruAfford.open()` / `.close()` remain available to host pages.

---

## demo.html — QA harness

```bash
python -m http.server 5183 --directory packages/tru-afford
```

Then open <http://localhost:5183/demo.html>.

Switch dealer accent and light/dark host. The page ships **deliberately hostile**
global CSS — magenta Comic Sans buttons, dashed-red yellow inputs, upside-down
SVGs, lowercase italic bold — of the kind badly-scoped dealer themes really do.
Those rules visibly hit the demo page's own controls. If anything inside the
widget picks them up, isolation has a hole.

Covers the brief's §3.2 requirement to test TruAfford in a light dealer page
**and** a dark one.

---

## Compliance — do not weaken

The NCA disclaimer in step 4 is the sharpest legal edge in the suite. It must
stay **in the output body**, not a footer, and must keep stating that this is:

- an estimate only
- not a credit decision, quotation, or offer of finance
- not an affordability assessment under the National Credit Act

Never introduce language implying approval, pre-approval or qualification.

---

## Known gap

The four deployed copies have drifted from each other and from this file. They
still carry the old hardcoded purple palette (`#7C3AED`, pre-rebrand), a dead
`data-brand` attribute, and the light-DOM isolation that does not hold. Bringing
them onto this file is a **client-site release** for each dealer, not a refactor
step — it needs sign-off and per-site QA.
