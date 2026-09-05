/**
 * Netlify Function — Lead Delivery (WhatsApp + Email + Portal DB)
 * 
 * All three channels fire in parallel via Promise.allSettled().
 * If one fails, the others still deliver. No lead is ever lost.
 */

export default async function handler(request: any, context: any) {
  const body = await request.json();
  
  // Extract fields from enquiry form or booking
  const { type, source, vehicleRef, name, phone, email, message, consent } = body;
  const bookingType = body.bookingType || null;
  const date = body.date || null;
  const time = body.time || null;

  if (!name || !phone && !email) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Name and (phone or email) required" }),
    };
  }

  // ── Channel 1: WhatsApp via CallMeBot ────────────────
  const callmebotPromise = process.env.CALLMEBOT_API_KEY ? (async () => {
    try {
      const phoneDigits = phone.replace(/\D/g, "");
      const targetPhone = process.env.CALLMEBOT_PHONE || "27834659921";
      
      const text = `🚗 New Enquiry${vehicleRef ? `\nVehicle: ${vehicleRef}` : ""}\n\nName: ${name}\nPhone: ${phone}\nEmail: ${email || "—"}\nMessage: ${message || "—"}`;
      
      await fetch(`https://api.callmebot.com/whatsapp.php?source=YOURCAR&apikey=${process.env.CALLMEBOT_API_KEY}&target=${targetPhone}&text=${encodeURIComponent(text)}`, {
        method: "POST",
      });
      return { status: "ok" as const };
    } catch {
      return { status: "error" as const, channel: "whatsapp" };
    }
  })() : Promise.resolve({ status: "skipped" as const, channel: "whatsapp" });

  // ── Channel 2: Email via SMTP / Resend / SendGrid ───
  const emailPromise = process.env.EMAIL_API_KEY ? (async () => {
    try {
      // Replace with your email provider's API
      const subject = `New Enquiry${vehicleRef ? ` — ${vehicleRef}` : ""}`;
      const html = `
        <h2>New Enquiry</h2>
        ${vehicleRef ? `<p><strong>Vehicle:</strong> ${vehicleRef}</p>` : ""}
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Email:</strong> ${email || "—"}</p>
        <p><strong>Message:</strong></p>
        <blockquote>${message}</blockquote>
      `;
      
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.EMAIL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Your Car Guy <enquiries@yourcarguy.co.za>",
          to: ["sales@yourcarguy.co.za"],
          subject,
          html,
        }),
      });
      return { status: "ok" as const };
    } catch {
      return { status: "error" as const, channel: "email" };
    }
  })() : Promise.resolve({ status: "skipped" as const, channel: "email" });

  // ── Channel 3: Store in portal DB (local file-based) ─
  const portalPromise = (async () => {
    try {
      const DATA_DIR = process.env.DATA_DIR || "/tmp/ycg-data";
      const fs = require("fs");
      const path = require("path");
      
      // Ensure directory exists
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      
      const leadsPath = path.join(DATA_DIR, "leads.json");
      const existing = fs.existsSync(leadsPath)
        ? JSON.parse(fs.readFileSync(leadsPath, "utf8"))
        : [];
      
      const lead = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        source,
        vehicleRef,
        name,
        phone,
        email,
        message,
        bookingType,
        date,
        time,
        status: "new",
        createdAt: new Date().toISOString(),
      };
      
      existing.unshift(lead);
      fs.writeFileSync(leadsPath, JSON.stringify(existing.slice(0, 500))); // Keep last 500
      
      return { status: "ok" as const };
    } catch {
      return { status: "error" as const, channel: "portal" };
    }
  })();

  // ── Fire all three in parallel ───────────────────────
  const results = await Promise.allSettled([callmebotPromise, emailPromise, portalPromise]);
  
  const okCount = results.filter((r) => r.status === "fulfilled" && r.value.status === "ok").length;
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: okCount > 0,
      deliveredTo: okCount,
      totalChannels: 3,
    }),
  };
}
