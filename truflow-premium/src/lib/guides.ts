/**
 * In-app guidance — the "how-to" engine, content-as-data.
 *
 * The whole point of this file: a guide is DATA, not code. Adding or editing a
 * how-to means editing a row here (or, later, a Firestore document) — never a
 * component change and never a redeploy of the guide logic. That is what stops
 * guidance from becoming another thing that constantly changes.
 *
 * Guides are indexed by the DEALER'S JOB ("Get a car listed"), not by our
 * modules ("The Stock screen"), because a dealer thinks in outcomes. Steps are
 * allowed to hop between apps — Lens → Flow → Website — because the real jobs
 * cross app boundaries. That cross-app storyline is the thing no single-app
 * competitor can tell.
 *
 * This is the reference implementation for TruFlow Premium. The same schema and
 * <GuidePanel/> are meant to be reused by the other apps in the suite (TruLens,
 * TruInspect) and mirrored for the property vertical — each just supplies its
 * own GUIDES array.
 */

import { TRULENS_URL, TRUINSPECT_URL } from "./ecosystem";

/** The apps a dealer's journey can pass through. */
export type GuideApp = "flow" | "lens" | "website" | "inspect";

export interface GuideAppMeta {
  label: string;
  /** CSS custom property used for the app's badge tint. */
  tone: string;
  /** Where to send the dealer if a step happens in another app. */
  url?: string;
}

/** Badge metadata per app — keeps the panel colour-consistent with the suite. */
export const GUIDE_APPS: Record<GuideApp, GuideAppMeta> = {
  flow: { label: "TruFlow", tone: "var(--cyan)" },
  lens: { label: "TruLens", tone: "var(--blue)", url: TRULENS_URL },
  website: { label: "Website", tone: "var(--success, #34d399)" },
  inspect: { label: "TruInspect", tone: "var(--warning)", url: TRUINSPECT_URL },
};

export interface GuideStep {
  /** Which app this step happens in — drives the badge and any "open" link. */
  app: GuideApp;
  title: string;
  detail: string;
}

export interface Guide {
  id: string;
  /** Phrased as the dealer's job, not the feature. */
  title: string;
  /** One-line outcome — what "done" looks like. */
  goal: string;
  /** Short label for the list row. */
  blurb: string;
  /** activeSection this guide is most relevant to, for contextual surfacing. */
  section?: string;
  /** Optional product gate (matches App's hasProduct keys). */
  product?: string;
  /** Mark the primary end-to-end journey so first-run can lead with it. */
  spine?: boolean;
  steps: GuideStep[];
}

/**
 * TruFlow Premium guides. Content is deliberately grounded in what the app
 * actually does today (guided shoot → export to DMS, readiness badge, the Web
 * toggle, the Stock List export, the per-photo delete) so nothing here promises
 * a screen that isn't there.
 */
export const GUIDES: Guide[] = [
  {
    id: "list-a-car",
    title: "Get a car listed on your website",
    goal: "A new arrival goes from the yard to live on your showroom site.",
    blurb: "The full spine — capture, price, publish.",
    section: "inventory",
    spine: true,
    steps: [
      {
        app: "flow",
        title: "Add the unit",
        detail:
          "Stock → Add vehicle. Capture the stock number, price and specs. This creates the car's record; photos come next.",
      },
      {
        app: "lens",
        title: "Shoot it in TruLens",
        detail:
          "Open TruLens and complete the guided shoot slots. The photos export straight back into the DMS — you never upload by hand.",
      },
      {
        app: "flow",
        title: "Check it's web-ready",
        detail:
          "Back in Stock, the readiness badge on the card turns green once the specs and photos are complete. Amber means something's still missing.",
      },
      {
        app: "website",
        title: "Publish it",
        detail:
          "Flip the Web toggle on the card. The unit appears on your showroom site — no separate upload, no waiting.",
      },
    ],
  },
  {
    id: "fix-a-photo",
    title: "Replace a bad photo",
    goal: "A wrong or blurry shot is off the listing in seconds.",
    blurb: "Fix a shoot mistake without a round-trip.",
    section: "inventory",
    steps: [
      {
        app: "flow",
        title: "Open the vehicle",
        detail:
          "Stock → tap the car to open its detail page. The photo strip shows every image on the listing.",
      },
      {
        app: "flow",
        title: "Delete the shot",
        detail:
          "Tap the photo, then the delete button. It's gone from the listing immediately — you no longer have to go back into TruLens just to remove one bad frame.",
      },
      {
        app: "lens",
        title: "Reshoot if needed",
        detail:
          "Only if you need a replacement: open TruLens, redo that slot, and re-export. The new photo flows back into the same listing.",
      },
    ],
  },
  {
    id: "export-stock",
    title: "Send your stock list somewhere else",
    goal: "A current snapshot of the floor, ready for the bank, an audit or a buyer.",
    blurb: "Download today's stock as a spreadsheet.",
    section: "inventory",
    steps: [
      {
        app: "flow",
        title: "Open Stock",
        detail:
          "Go to the Stock screen. Filter first if you only want part of the floor — the list you see is what you'll want to send.",
      },
      {
        app: "flow",
        title: "Download the Stock List",
        detail:
          "Tap Stock List in the toolbar. A CSV downloads, stamped with today's date. It's a snapshot of right now — if a price is stale, update the unit first.",
      },
    ],
  },
  {
    id: "sync-social",
    title: "Post your stock to social media",
    goal: "A car goes out to your social channels — from the vehicle page or straight from your website.",
    blurb: "Connect once, post to all your channels.",
    section: "inventory",
    product: "social",
    steps: [
      {
        app: "flow",
        title: "Open a car and find Sync",
        detail:
          "Once TruSocial is switched on for your dealership, a Sync option appears on each vehicle page. Open it — the social channels available to you are listed there.",
      },
      {
        app: "flow",
        title: "Connect your accounts (once)",
        detail:
          "Connect through the secure sign-in popup. It's one connection — approve it and all of your channels come through together, carried by Zernio. You don't link each network separately.",
      },
      {
        app: "flow",
        title: "Choose channels and publish",
        detail:
          "Tick which channels this car should go to, add a caption, and publish. You choose the channels per post, so a unit can go wide or to just one.",
      },
      {
        app: "website",
        title: "Or share straight from your website",
        detail:
          "On your dealer site, open the car and tap Share. A card pops up with WhatsApp, Facebook and Copy link — tap one to go straight there, or tap More… for your device's full share sheet (business page, X, LinkedIn, Telegram, email…). It shares the car's own web page, so the buyer lands on the live listing.",
      },
    ],
  },
  {
    id: "mark-sold",
    title: "Mark a car as sold",
    goal: "The car, its deal and your website all update from one action.",
    blurb: "Close the deal and pull it off the web in a tap.",
    section: "inventory",
    steps: [
      {
        app: "flow",
        title: "Open the car",
        detail:
          "Stock → find the unit on its card, or tap it to open the detail page.",
      },
      {
        app: "flow",
        title: "Tap Mark sold",
        detail:
          "Hit Mark sold on the card or in the detail. If more than one lead is still open on this car, you'll be asked which deal actually closed, so the right one gets the credit.",
      },
      {
        app: "flow",
        title: "Everything moves together",
        detail:
          "The car flips to SOLD, its deal closes as Closed Won, and it's unpublished from your website automatically — so you're not fielding calls on a car that's gone. No second screen to update.",
      },
      {
        app: "flow",
        title: "Changed your mind?",
        detail:
          "Return to stock flips the car back and reopens its deal. Archive retires a sold unit off the floor but keeps it in your money figures.",
      },
    ],
  },
  {
    id: "sync-accounting",
    title: "Connect your accounting package",
    goal: "Deals and expenses flow to Xero, QuickBooks or Zoho automatically.",
    blurb: "Link your ledger so the books keep themselves.",
    section: "settings",
    // No product gate: accounting is a Settings toggle (accountingEnabled) that
    // every premium dealer can switch on, not a separately-sold add-on like
    // TruSocial — so the guide should always be available to explain it.
    steps: [
      {
        app: "flow",
        title: "Turn on Accounting",
        detail:
          "Settings → enable Accounting. Turning it off never deletes a connection — existing links are preserved.",
      },
      {
        app: "flow",
        title: "Connect your ledger",
        detail:
          "Pick Xero, QuickBooks or Zoho and connect. A secure sign-in popup runs the OAuth flow — approve it and it closes on its own.",
      },
      {
        app: "flow",
        title: "Let it keep in sync",
        detail:
          "Once linked, your deals and reconciled expenses flow through to your accounting package, so the books stay current without double capture. Disconnect anytime in Settings.",
      },
    ],
  },
  {
    id: "chase-a-lead",
    title: "Reply to a new lead",
    goal: "A fresh enquiry gets a first response and a next action.",
    blurb: "Turn an enquiry into a conversation.",
    section: "leads",
    steps: [
      {
        app: "flow",
        title: "Open Lead CRM",
        detail:
          "The dashboard flags leads that have never been replied to. Open Lead CRM to see them in one place.",
      },
      {
        app: "flow",
        title: "Reply and log the next step",
        detail:
          "Open the lead, send your reply, and set the next action so it doesn't go quiet. Anything past its date shows as due on the dashboard.",
      },
    ],
  },
  {
    id: "add-vehicle",
    title: "Add a new car to stock",
    goal: "A new arrival has a full record on the floor, ready to shoot and price.",
    blurb: "Create the stock record for an arrival.",
    section: "upload",
    steps: [
      {
        app: "flow",
        title: "Pick a showroom category",
        detail:
          "Leave it on \"Auto — decide from price & model\", or set Premium Used / Select / Performance if you already know where the car sits.",
      },
      {
        app: "flow",
        title: "Fill the specs and price",
        detail:
          "Complete the vehicle specifications, then Retail Price, Cost Price, Mileage and a Stock Number. The stock number is how the car is matched everywhere else, so get it right.",
      },
      {
        app: "flow",
        title: "Publish to Active Stock",
        detail:
          "Tap Publish to Active Stock and the car lands on the floor. Photos come next — they're shot in TruLens, not captured here.",
      },
    ],
  },
  {
    id: "car-gallery-ready",
    title: "Get a car's photos web-ready",
    goal: "A unit has a full gallery and shows as web-ready.",
    blurb: "Take a car from no photos to publishable.",
    section: "media_web",
    steps: [
      {
        app: "flow",
        title: "Find what needs a shoot",
        detail:
          "Stock media shows counters — Need shoot vs Web-ready gallery. Pick a car flagged \"No gallery yet\" or incomplete.",
      },
      {
        app: "lens",
        title: "Shoot it in TruLens",
        detail:
          "Tap Shoot to open TruLens for that stock number, complete the guided slots (aim for a full set — a short gallery still reads as incomplete), then Export to DMS.",
      },
      {
        app: "flow",
        title: "Refresh and check",
        detail:
          "Reload Stock media — the badge turns to \"Gallery web-ready\" and the last-sync line updates. The Public stock feed link shows exactly what your website receives.",
      },
    ],
  },
  {
    id: "repayment",
    title: "Work out a monthly repayment",
    goal: "A live monthly instalment you can quote a buyer on the spot.",
    blurb: "Model a finance deal in seconds.",
    section: "payment",
    steps: [
      {
        app: "flow",
        title: "Set price and deposit",
        detail:
          "Enter the Vehicle Total Price and the Deposit. It's seeded with a car's price so you can start fast.",
      },
      {
        app: "flow",
        title: "Add rate, term and balloon",
        detail:
          "Type the Interest rate, then drag the Term (12–84 months) and Balloon (0–40%) sliders to match the deal on the table.",
      },
      {
        app: "flow",
        title: "Read the instalment",
        detail:
          "The Monthly Installment updates live, with Principal, Interest, Balloon and Lifetime cost beside it. Nothing to save — it's a working calculator.",
      },
    ],
  },
  {
    id: "deal-ready",
    title: "Get a deal ready to close",
    goal: "Every outstanding item on a live deal is ticked or accounted for.",
    blurb: "Track NATIS, finance and handover on a deal.",
    section: "deal_readiness",
    steps: [
      {
        app: "flow",
        title: "Open the deal (on a computer)",
        detail:
          "Deal Readiness is a desktop job. A deal appears here once its lead reaches Negotiating.",
      },
      {
        app: "flow",
        title: "Work the checklist",
        detail:
          "Tick NATIS, Roadworthy, Invoiced, Deposit and Delivered, and set the Finance state (Submitted / Approved / Declined). The progress bar fills as you go.",
      },
      {
        app: "flow",
        title: "Clear any conflicts",
        detail:
          "An amber glyph means the checklist and the paperwork disagree — e.g. Compliance signed but NATIS un-ticked. Open DocHub to resolve it.",
      },
    ],
  },
  {
    id: "paperwork",
    title: "Generate and sign the paperwork",
    goal: "A deal's documents are created, signed and marked complete.",
    blurb: "Run a deal through DocHub, start to finish.",
    section: "documents",
    steps: [
      {
        app: "flow",
        title: "Open DocHub (on a computer)",
        detail:
          "Documents is a desktop job. Pick a live deal and tap Open DocHub.",
      },
      {
        app: "flow",
        title: "Work each stage",
        detail:
          "Move through Proforma → Offer to Purchase → Compliance → Invoice → Handover. For each: Generate, Upload or Export the document — or Skip with a reason.",
      },
      {
        app: "flow",
        title: "Sign and finalise",
        detail:
          "Tap Sign & finalise, then Type name or Draw. If it blocks you, a required field is missing (a proforma needs the VIN and price breakdown, for example) — fill it and finalise.",
      },
      {
        app: "flow",
        title: "Finish the deal",
        detail:
          "Advance all five stages until the deal reads Complete.",
      },
    ],
  },
  {
    id: "add-staff",
    title: "Add a staff member",
    goal: "A salesperson or manager has their own login, scoped to your dealership.",
    blurb: "Give a team member their own access.",
    section: "manager",
    steps: [
      {
        app: "flow",
        title: "Open Team and Add staff",
        detail:
          "Team & Users → Add staff. Note it adds a billable seat.",
      },
      {
        app: "flow",
        title: "Enter their details",
        detail:
          "Full name, email, role (Salesperson or Manager) and contact number, then Add & issue code. They'll only ever see this dealership's stock and leads.",
      },
      {
        app: "flow",
        title: "Hand over the code",
        detail:
          "Copy the one-time access code and give it to them — it won't be shown again. Tap Done. Rotate it later with New code, or Remove access anytime.",
      },
    ],
  },
  {
    id: "stock-health",
    title: "See what your stock is costing you",
    goal: "A clear read on capital tied up and where it's ageing.",
    blurb: "Spot the money stuck in aged stock.",
    section: "stock_health",
    steps: [
      {
        app: "flow",
        title: "Read the headline numbers",
        detail:
          "Capital in stock, Projected margin, Realised margin, and Tied up over 60 days — that last one is the figure that hurts.",
      },
      {
        app: "flow",
        title: "See where it's ageing",
        detail:
          "The Ageing bars show how your capital splits across age bands. The Oldest stock first table lists units worst-first.",
      },
      {
        app: "flow",
        title: "Act on the worst",
        detail:
          "Click any row to open that car and decide — reprice, push it on social, or move it. Aged stock is the cheapest margin you'll ever recover.",
      },
    ],
  },
  {
    id: "mobile-app",
    title: "Use TruFlow on your phone",
    goal: "Manage leads, stock and deals from the showroom floor.",
    blurb: "Your Premium companion — on your phone.",
    section: "settings",
    steps: [
      {
        app: "flow",
        title: "Open the mobile app",
        detail:
          "Go to app.tru-saas.com on your phone. Sign in with your dealer code — the same one you use on desktop.",
      },
      {
        app: "flow",
        title: "Add it to your home screen",
        detail:
          "Tap Share → Add to Home Screen (iOS) or the install banner (Android). It opens full-screen like a native app, no browser chrome.",
      },
      {
        app: "flow",
        title: "Work the floor",
        detail:
          "Leads, stock, walk-in adds, activity — it all syncs with your desktop Premium. Changes you make on mobile show up on desktop and vice versa.",
      },
    ],
  },
  {
    id: "api-stock-feed",
    title: "Feed your stock to other platforms",
    goal: "Your website or third-party tools pull live stock data from TruFlow's API.",
    blurb: "The public stock API — your inventory, anywhere.",
    section: "inventory",
    steps: [
      {
        app: "flow",
        title: "Find your public stock URL",
        detail:
          "Your stock feed lives at /api/public/stock?dealer=your-slug. Open Stock media and tap 'Public stock feed link' to see it and copy the URL.",
      },
      {
        app: "website",
        title: "Plug it into your website",
        detail:
          "Your dealer website already fetches this feed. Third-party sites, aggregators or your own tools can call the same URL — it returns JSON with every published vehicle, photos included.",
      },
      {
        app: "flow",
        title: "Keep it current",
        detail:
          "The feed is live — publish or unpublish a car and the API reflects it immediately. No export step, no sync delay.",
      },
    ],
  },
  {
    id: "dealer-assist",
    title: "Ask the Dealer Assist AI",
    goal: "Get instant answers about your stock, leads and deals without leaving TruFlow.",
    blurb: "Your AI assistant — built into the top bar.",
    section: "dashboard",
    steps: [
      {
        app: "flow",
        title: "Open Dealer Assist",
        detail:
          "Tap the chat icon in the top bar (desktop) or the floating button (mobile). It knows your inventory and lead data.",
      },
      {
        app: "flow",
        title: "Ask a question",
        detail:
          "Try things like 'What stock is over 60 days?', 'How many new leads this week?', or 'Best seller this month'. It searches your data and gives a straight answer.",
      },
      {
        app: "flow",
        title: "Use suggestions",
        detail:
          "After each reply, tap a suggested follow-up or type your own. The assistant remembers the conversation context.",
      },
    ],
  },
  {
    id: "inspect-vehicle",
    title: "Run an inspection report",
    goal: "A vehicle has a professional condition report with AI damage detection.",
    blurb: "AI-powered inspection in TruInspect.",
    section: "inventory",
    steps: [
      {
        app: "inspect",
        title: "Open TruInspect",
        detail:
          "Go to inspect.tru-saas.com and sign in. Start a new inspection for the vehicle.",
      },
      {
        app: "inspect",
        title: "Capture the panels",
        detail:
          "Follow the guided walk-around. The AI detects dents, scratches and paint work as you shoot — damage is flagged on-screen in real time.",
      },
      {
        app: "inspect",
        title: "Generate the PDF",
        detail:
          "Once complete, tap Generate Report. A branded PDF inspection report downloads with photos, damage markers, and a condition score.",
      },
    ],
  },
];

/** Guides relevant to a given section, spine first — used for contextual help. */
export function guidesForSection(section: string, has: (p: string) => boolean): Guide[] {
  return GUIDES.filter((g) => (!g.product || has(g.product)))
    .filter((g) => !section || g.section === section)
    .sort((a, b) => Number(b.spine) - Number(a.spine));
}

/** All guides available to this dealer, spine first. */
export function availableGuides(has: (p: string) => boolean): Guide[] {
  return GUIDES.filter((g) => !g.product || has(g.product)).sort(
    (a, b) => Number(b.spine) - Number(a.spine),
  );
}
