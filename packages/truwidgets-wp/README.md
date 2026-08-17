# TruWidgets — WordPress Plugin (canonical rig)

The **dealer-agnostic** WordPress plugin for the TruDealer standalone widgets.
Carries no dealer-specific content — install it unchanged on any dealer's site
and configure everything from **Settings → TruWidgets**.

It is *not* the YCG chatbot plugin. No knowledge base, no Claude brain, no email,
no PWA portal — just the widgets and a settings page. (The YCG TruChat plugin
stays separate; a site can run both.)

## What it does

Injects **one** TruLoader `<script>` tag in the footer, built from your settings:

```html
<script src="https://cdn.tru-saas.com/tru-loader/tru-loader.js"
        data-dealer="…" data-accent="…" data-wa="…"
        data-widgets="form,book,share" data-webhook="…" …></script>
```

The loader (canonical source: `packages/standalone/`) mounts the enabled widgets
and handles placement, stacking, responsiveness and per-widget config.

## Install

1. Zip the `truwidgets-wp/` folder → **Plugins → Add New → Upload** → activate.
2. **Settings → TruWidgets**: set dealer name, colour, WhatsApp; tick the widgets;
   set lead delivery (webhook and/or CallMeBot); Save.
3. Done. TruForm appears on its own; wire triggers for Book/Share (below).

## Hosting dependency

Widget code is served from a **CDN**, not bundled — so one fix ships to every
site at once. Default base is `https://cdn.tru-saas.com`; override in
**Advanced → Widget CDN base** to self-host. Deploy `packages/standalone/` there
(see `packages/standalone/INSTALL-WORDPRESS.md`).

## The 20-site model

- **Code**: hosted once on the CDN. Fix once → every site updates.
- **Config**: per-dealer, entirely in this plugin's settings — no code edits.
- **Onboarding a dealer**: install this plugin, fill the settings form. That's it.

## Triggers for Book & Share

TruForm self-mounts. The other two open on demand — add buttons:

```html
<!-- anywhere -->
<button onclick="TruDealer.open('book')">Book a Test Drive</button>

<!-- on each vehicle, populated from that car -->
<button onclick="TruShare.open({year:'2019', make:'VW', name:'Polo', price:199900, img:'…'})">Share</button>
```

## Settings reference

Brand (name, colour, accent-2, text colour, size, theme, WhatsApp) · Widgets
(enable each) · Placement (side per widget) · **Where they show** (per-widget
page targeting) · Lead delivery (webhook, CallMeBot) · Per-widget options (repay
mode/target/price/vehicle, book address, share site/path) · Advanced (CDN base).

### Where they show (per-widget targeting)

Each widget has a **show on** rule, evaluated per page request:

| Mode | Shows on |
|---|---|
| `everywhere` | the whole site (default) |
| `home` | the front page only |
| `singular` | any single post/page |
| `path` | pages whose URL path contains your text (e.g. `/vehicle`) |
| `ids` | a comma-separated list of page/post IDs |

So you can run TruForm everywhere, TruRepay only on `/vehicle` pages, and
TruShare only on the stock listing — all from the settings page, per dealer.
