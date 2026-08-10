# Website widgets

*The embeddable options a dealer can add to their site — each is a single script tag, branded from one colour, and each captures a lead.*

Every widget renders in isolation (a shadow root, so the host site's styles can't break it), themes from one `data-accent`, and — where a dealer slug + Flow URL are set — files the enquiry straight into the [TruFlow](./truflow.md) CRM via `/api/integration/webhook-lead`. Add one, some, or all.

| Widget | What it does | Captures a lead? | Notes |
|---|---|---|---|
| **[TruChat](./truchat.md)** | 24/7 assistant — answers, stock search, bookings, WhatsApp handoff | Yes (DMS-connected build) | Also a standalone WordPress build whose leads stay in its own portal |
| **[TruAfford](./truafford.md)** | Affordability / soft pre-qual (budget → what they can spend) | Yes (Send + WhatsApp) | NCA disclaimer in the result body |
| **[TruRepay](./trurepay.md)** | Finance calculator (price → monthly instalment) | Yes (capture → webhook + WhatsApp) | Balloon-PMT math; the finance-page calculator |
| **[TruForm](./truform.md)** | General enquiry / contact form | Yes (Send + WhatsApp) | Base fields + optional vehicle / trade-in / finance / location blocks |

## How they're added

Each is a `<script>` tag with the dealer's details — for example TruRepay on a finance page:

```html
<div id="finance-calc"></div>
<script src="tru-repay.js"
        data-dealer="True Cars" data-slug="true-cars"
        data-flow="https://premium.tru-saas.com" data-wa="27620502091"
        data-accent="#1466E0" data-mode="inline" data-target="#finance-calc"></script>
```

TruAfford, TruForm and TruChat follow the same shape — set `data-slug` + `data-flow` so leads reach the DMS, `data-accent` to brand it, and `data-wa` to enable WhatsApp. Widgets can run inline (in the page) or as a floating launcher; on a page that already has floating widgets, keep the corners from colliding.

## Related

- **[TruFlow](./truflow.md)** — where the leads land.
- **[Integrations](./integrations.md)** — the `/api/integration/webhook-lead` endpoint behind every widget.
- **[Showrooms](./showrooms.md)** — the live-video and 360° options (TruLive, TruTrade, TruOrbit), a separate cluster from these embed widgets.
