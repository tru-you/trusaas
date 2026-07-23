# TruChat — Ray (Your Car Guy)

AI showroom assistant for the Your Car Guy website: a conversational, knowledge-
driven chatbot that answers questions, searches stock, books slots, hands off to
WhatsApp, and emails confirmations to the customer and the yard.

## 👉 The product is the WordPress plugin

Everything ships as one WordPress plugin. Start here:

- **[wordpress-plugin/](wordpress-plugin/)** — the plugin + standalone leads portal
- **[wordpress-plugin/README.md](wordpress-plugin/README.md)** — install & setup guide

### How it works (hybrid)

- **Knowledge-first** — common questions (hours, location, contact, finance,
  trade-in, warranty basics, greetings) are answered instantly from your settings
  with **no API call and no cost**.
- **Claude fallback** — only novel or transactional messages go to Claude (Haiku,
  with the knowledge base cached), which drives the tools: stock search, slot
  booking, lead capture, WhatsApp handoff.
- **Leads** persist server-side → viewable in **Settings → TruChat Leads** and in
  the mobile **portal.html**; every booking/lead also emails the customer and the yard.

## Folder map

| Path | What it is |
|------|-----------|
| `wordpress-plugin/truchat/` | The plugin (install this) |
| `wordpress-plugin/portal.html` | Standalone mobile leads inbox (PIN) |
| `wordpress-plugin/README.md` | Install & setup guide |
| `shared/` | Source of the widget JS + the legacy keyword engine (offline fallback). The plugin bundles copies under `truchat/assets/`. |
| `Truechat - YCG/` | **Legacy** standalone/demo pages (pre-plugin). Superseded — kept for reference only. |
| `true-cars/` | Sibling tenant scaffold (True Cars) |

> The old `Truechat - YCG/WORDPRESS.md` script-tag install is **superseded** by the
> plugin — don't follow it. Use the plugin and its README.
