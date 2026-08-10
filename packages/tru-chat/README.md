# TruChat — canonical widget

Shared AI showroom-chat widget, embedded in dealer sites. `shared/chat-core.js`,
`shared/qualifier.js` and `shared/widget.js` here are the **source of truth**.
Per-dealer copies under `case-sites/*/truchat/shared/` are deploy artefacts —
fix here, then re-copy. Each dealer keeps its own `truchat/<dealer>/config.js`.

## Known issue — fixed here, not yet re-copied everywhere (2026-08-04)

`qualifier.js`'s name-capture regex used to be:

```js
const nameMatched = raw.match(/(?:my name is|i am|i'm|call me)\s+([a-zA-Z\s]{2,20})/i);
```

This matches `i'm` inside **any** sentence, not just a name introduction, and
then swallows up to 20 characters of whatever follows as the "name". A buyer
typing `"I'm interested in a Hilux"` got logged — and greeted back — as
**"interested in a Hilu"** (truncated at the 20-char cap). Fixed in this
package's `shared/qualifier.js` by requiring `my name is` / `call me` to stop
at the next clause break, and restricting bare `i'm` / `i am` to only count
when the **entire** remaining message is just a 1–2 word name — not a longer
sentence.

**Re-copied to:** `case-sites/cars-at-caledon/truchat/shared/qualifier.js`
(2026-08-04, alongside a TruChat/TruAfford version refresh for that site).

**Still carrying the old buggy regex — not touched, needs the same fix +
re-copy as its own pass:**
- `case-sites/MKR/truchat/shared/qualifier.js`
- `case-sites/tru-cars-flagship-deploy/truchat/shared/qualifier.js`

Left alone deliberately per instruction to scope that session's work to
Cars on Caledon only.
