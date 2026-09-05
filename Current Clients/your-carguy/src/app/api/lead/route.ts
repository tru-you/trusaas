import { NextResponse } from "next/server";

/**
 * Lead intake for the real TruSaaS widgets (TruForm / TruAfford / TruRepay /
 * TruValue / TruBook). Each widget POSTs this shape to data-webhook:
 *
 *   { dealerSlug, firstName, lastName, phone, email, source, notes }
 *
 * We normalise, then fan out to email + portal store server-side. WhatsApp
 * ping is ALSO handled server-side here (one reliable channel, no client key
 * exposure) rather than by each widget's browser-side CallMeBot.
 */

interface WidgetLead {
  dealerSlug?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  phone?: string;
  email?: string;
  source?: string;
  notes?: string;
  product?: string;
  _honey?: string;
  [k: string]: unknown;
}

interface Normalised {
  id: string;
  type: string;
  source: string;
  name: string;
  phone: string;
  email: string;
  message: string;
  vehicleRef: string | null;
  createdAt: string;
  raw: WidgetLead;
}

function normalise(b: WidgetLead): Normalised {
  const name =
    b.name ||
    [b.firstName, b.lastName].filter(Boolean).join(" ").trim() ||
    "";
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: (b.source || "enquiry").toLowerCase().includes("book") ? "booking" : "enquiry",
    source: b.source || "TruWidget",
    name,
    phone: (b.phone || "").trim(),
    email: (b.email || "").trim(),
    message: b.notes || "",
    vehicleRef: null,
    createdAt: new Date().toISOString(),
    raw: b,
  };
}

async function sendWhatsApp(lead: Normalised): Promise<boolean> {
  const key = process.env.CALLMEBOT_API_KEY;
  if (!key) return false;
  const target = process.env.CALLMEBOT_PHONE || "27834659921";
  const text =
    `🚗 New ${lead.type} — Your Car Guy\n` +
    `Source: ${lead.source}\n` +
    `Name: ${lead.name || "—"}\n` +
    `Phone: ${lead.phone || "—"}\n` +
    `Email: ${lead.email || "—"}\n` +
    (lead.message ? `Notes: ${lead.message}` : "");
  try {
    const url =
      `https://api.callmebot.com/whatsapp.php` +
      `?phone=${encodeURIComponent(target)}` +
      `&apikey=${encodeURIComponent(key)}` +
      `&text=${encodeURIComponent(text)}`;
    const res = await fetch(url, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendEmail(lead: Normalised): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.DEALER_EMAIL || "sales@yourcarguy.co.za";
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Your Car Guy Website <enquiries@yourcarguy.co.za>",
        to: [to],
        subject: `New ${lead.type} — ${lead.source}`,
        html: `
          <h2>New ${lead.type} from yourcarguy.co.za</h2>
          <p><strong>Source:</strong> ${lead.source}</p>
          <p><strong>Name:</strong> ${lead.name || "—"}</p>
          <p><strong>Phone:</strong> ${lead.phone || "—"}</p>
          <p><strong>Email:</strong> ${lead.email || "—"}</p>
          ${lead.message ? `<p><strong>Notes:</strong></p><blockquote>${lead.message}</blockquote>` : ""}
        `,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function storeLead(lead: Normalised): Promise<boolean> {
  try {
    const fs = await import("fs");
    const path = await import("path");
    const dir = process.env.DATA_DIR || ".data";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "leads.json");
    const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
    existing.unshift(lead);
    fs.writeFileSync(file, JSON.stringify(existing.slice(0, 500), null, 2));
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  let body: WidgetLead;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Honeypot filled → silently "succeed" without delivering anything.
  if (body._honey) return NextResponse.json({ ok: true });

  const lead = normalise(body);
  if (!lead.name && !lead.phone && !lead.email) {
    return NextResponse.json({ error: "No contact details" }, { status: 400 });
  }

  const results = await Promise.allSettled([
    sendWhatsApp(lead),
    sendEmail(lead),
    storeLead(lead),
  ]);

  const stored = results[2].status === "fulfilled" && results[2].value === true;
  const delivered = results.filter((r) => r.status === "fulfilled" && r.value === true).length;

  // Portal store is our system of record — surface failure so the widget can
  // fall back to its WhatsApp/CallMeBot path rather than showing a false "sent".
  return NextResponse.json({ ok: stored, deliveredChannels: delivered }, { status: stored ? 200 : 500 });
}
